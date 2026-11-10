import { NextRequest, NextResponse } from 'next/server';
import { jsonError, requireSession } from '@/lib/server/auth';
import { getStaffAuthRecords } from '@/lib/supabase/services';
import { kvGet, kvListPrefix, kvPut, kvSchoolId } from '@/lib/supabase/kv';
import {
  ALL_STAFF_ROLES,
  POINTAGE_EXEMPT_ROLES,
  POINTAGE_MANAGER_ROLES,
  POINTAGE_VIEW_ALL_ROLES,
  ROLE_LABELS,
} from '@/lib/auth/roles';
import {
  DEFAULT_POINTAGE_CONFIG,
  PointageConfig,
  PointageRecord,
  dayStatus,
  distanceMeters,
  isValidHHMM,
  schoolClock,
} from '@/lib/data/pointage';

export const dynamic = 'force-dynamic';

/**
 * POINTAGE DU PERSONNEL
 * Toute la décision est prise ICI (heure du serveur, position, droits) : l'heure ou la position
 * envoyées par un téléphone ne sont jamais crues sur parole pour l'heure, et la plage horaire est
 * celle fixée par la Direction.
 *  - Chaque membre du personnel pointe pour LUI-MÊME : arrivée, départ, ou motif d'absence.
 *  - Fondateur, Fondateur adjoint, Directeur : règlent les horaires, la position de l'école, et
 *    peuvent saisir / corriger le motif d'absence de n'importe qui.
 *  - Comptable et Informaticien voient le tableau de tout le personnel (lecture).
 *
 * Stockage : table school_kv, clés hors des familles synchronisées (jamais lisibles ni
 * modifiables depuis un navigateur autrement que par cette route) :
 *   sf_private_pointage_config            → réglages
 *   sf_private_pointage_<AAAA-MM-JJ>_<id> → pointage d'une personne pour un jour
 */
const CONFIG_KEY = 'sf_private_pointage_config';
const dayPrefix = (date: string) => `sf_private_pointage_${date}_`;
const recordKey = (date: string, staffId: string) => `${dayPrefix(date)}${staffId}`;
const NO_STORE = { 'Cache-Control': 'no-store' };
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Coordonnées écrites dans un texte : lien Google Maps complet, ou « 5.3600, -4.0083 ». */
function parseCoordinates(text: string): { lat: number; lng: number } | null {
  const ok = (lat: number, lng: number) =>
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)
      ? { lat, lng }
      : null;
  let t = text;
  try {
    t = decodeURIComponent(text);
  } catch {}
  // Ordre : épingle exacte du lieu (!3d…!4d…), puis paramètres q=/ll=/query=, puis centre « @lat,lng ».
  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|ll|query|destination|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const r = ok(Number(m[1]), Number(m[2]));
      if (r) return r;
    }
  }
  return null;
}

/**
 * Lien Google Maps → coordonnées. Les liens courts (maps.app.goo.gl, goo.gl/maps) sont suivis
 * côté serveur (3 redirections au plus, Google uniquement) pour lire l'adresse complète.
 */
async function coordinatesFromMapLink(link: string): Promise<{ lat: number; lng: number } | null> {
  const direct = parseCoordinates(link);
  if (direct) return direct;
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  const allowed = (u: URL) =>
    u.protocol === 'https:' && /(^|\.)(google\.[a-z.]+|goo\.gl|app\.goo\.gl)$/i.test(u.hostname);
  for (let i = 0; i < 3 && allowed(url); i++) {
    try {
      const res = await fetch(url.toString(), { redirect: 'manual', headers: { 'User-Agent': 'SchoolFlow' } });
      const loc = res.headers.get('location');
      if (!loc) {
        // Dernière page : les coordonnées sont parfois dans le contenu.
        const body = (await res.text()).slice(0, 200000);
        return parseCoordinates(body);
      }
      const found = parseCoordinates(loc);
      if (found) return found;
      url = new URL(loc, url);
    } catch {
      return null;
    }
  }
  return null;
}

async function readConfig(schoolId: string): Promise<PointageConfig | null> {
  const row = await kvGet(schoolId, CONFIG_KEY);
  if (row === undefined) return null;
  if (!row) return { ...DEFAULT_POINTAGE_CONFIG };
  try {
    return { ...DEFAULT_POINTAGE_CONFIG, ...JSON.parse(row.value) };
  } catch {
    return { ...DEFAULT_POINTAGE_CONFIG };
  }
}

async function readRecord(schoolId: string, date: string, staffId: string): Promise<PointageRecord | null | undefined> {
  const row = await kvGet(schoolId, recordKey(date, staffId));
  if (row === undefined) return undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

async function staffRoster(slug: string) {
  return (await getStaffAuthRecords(slug))
    .filter((s) => ALL_STAFF_ROLES.includes(s.roleId) && !POINTAGE_EXEMPT_ROLES.includes(s.roleId) && s.status !== 'Verrouillé')
    .map((s) => ({ id: s.id, fullName: s.fullName, roleId: s.roleId, roleLabel: ROLE_LABELS[s.roleId] || s.role || '' }));
}

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if ('error' in auth) return auth.error;
  const { session, slug } = auth;
  if (!ALL_STAFF_ROLES.includes(session.roleId)) return jsonError('Réservé au personnel.', 403);

  const schoolId = await kvSchoolId(slug);
  if (!schoolId) return jsonError('Lecture impossible pour le moment. Réessayez.', 503);
  const config = await readConfig(schoolId);
  if (!config) return jsonError('Lecture impossible pour le moment. Réessayez.', 503);

  const clock = schoolClock(config.timezone);
  const requested = request.nextUrl.searchParams.get('date');
  const date = isDate(requested) ? requested : clock.date;
  const canViewAll = POINTAGE_VIEW_ALL_ROLES.includes(session.roleId);

  const me = session.staffId ? await readRecord(schoolId, date, session.staffId) : null;

  let roster: { id: string; fullName: string; roleId: string; roleLabel: string }[] = [];
  let records: Record<string, PointageRecord> = {};
  if (canViewAll) {
    const [r, rows] = await Promise.all([staffRoster(slug), kvListPrefix(schoolId, dayPrefix(date))]);
    roster = r;
    for (const row of rows || []) {
      try {
        records[row.key.slice(dayPrefix(date).length)] = JSON.parse(row.value);
      } catch {}
    }
  }

  return NextResponse.json(
    {
      success: true,
      date,
      today: clock.date,
      now: clock.time,
      weekday: clock.weekday,
      config,
      me: me || null,
      myStatus: dayStatus(me || null, config, date, clock),
      canManage: POINTAGE_MANAGER_ROLES.includes(session.roleId),
      canViewAll,
      exempt: POINTAGE_EXEMPT_ROLES.includes(session.roleId),
      roster,
      records,
    },
    { headers: NO_STORE }
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if ('error' in auth) return auth.error;
  const { session, slug } = auth;
  if (!ALL_STAFF_ROLES.includes(session.roleId)) return jsonError('Réservé au personnel.', 403);

  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return jsonError('Requête invalide.', 400);
  }
  const action = String(body?.action || '');
  const actor = `${session.roleId}|${session.staffId || ''}`;
  const isManager = POINTAGE_MANAGER_ROLES.includes(session.roleId);

  const schoolId = await kvSchoolId(slug);
  if (!schoolId) return jsonError('Enregistrement impossible pour le moment. Réessayez.', 503);
  const config = await readConfig(schoolId);
  if (!config) return jsonError('Enregistrement impossible pour le moment. Réessayez.', 503);
  const clock = schoolClock(config.timezone);

  // ─── Réglages (Direction) ───
  if (action === 'config') {
    if (!isManager) return jsonError('Seuls le Fondateur, le Fondateur adjoint et le Directeur règlent le pointage.', 403);
    const c = body?.config || {};
    const next: PointageConfig = { ...config };
    if (typeof c.enabled === 'boolean') {
      // Activé après l'heure de fin d'arrivée : on ne compte personne absent aujourd'hui.
      if (c.enabled && !config.enabled) {
        const end = isValidHHMM(c.arrivalEnd) ? c.arrivalEnd : config.arrivalEnd;
        if (clock.time > end) {
          const [y, m, d] = clock.date.split('-').map(Number);
          next.enabledSince = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
        } else {
          next.enabledSince = clock.date;
        }
      }
      next.enabled = c.enabled;
    }
    for (const f of ['arrivalStart', 'arrivalEnd', 'departureStart', 'departureEnd'] as const) {
      if (c[f] !== undefined) {
        if (!isValidHHMM(c[f])) return jsonError('Heure invalide (format HH:MM).', 400);
        next[f] = c[f];
      }
    }
    if (next.arrivalStart >= next.arrivalEnd) return jsonError("L'heure de fin d'arrivée doit être après l'heure de début.", 400);
    if (next.departureStart >= next.departureEnd) return jsonError("L'heure de fin de départ doit être après l'heure de début.", 400);
    if (next.arrivalEnd > next.departureStart) return jsonError('Le départ doit commencer après la fin des arrivées.', 400);
    if (Array.isArray(c.workDays)) {
      next.workDays = Array.from(new Set(c.workDays.map(Number).filter((d: number) => d >= 0 && d <= 6))).sort() as number[];
    }
    if (c.radiusMeters !== undefined) {
      const r = Math.round(Number(c.radiusMeters));
      if (!(r >= 30 && r <= 2000)) return jsonError('Rayon autorisé : entre 30 et 2000 mètres.', 400);
      next.radiusMeters = r;
    }
    // Lien Google Maps de l'école (bouton « Partager » de Maps) : coordonnées extraites ici.
    if (typeof c.mapLink === 'string' && c.mapLink.trim()) {
      const pos = await coordinatesFromMapLink(c.mapLink.trim());
      if (!pos) {
        return jsonError(
          "Impossible de lire la position dans ce lien. Dans Google Maps, appuyez longuement sur l'école, puis « Partager » et copiez le lien (ou collez directement les coordonnées, ex : 5.3600, -4.0083).",
          400
        );
      }
      next.location = { lat: pos.lat, lng: pos.lng, setAt: new Date().toISOString() };
    } else if (c.location === null) next.location = null;
    else if (c.location && typeof c.location === 'object') {
      const lat = Number(c.location.lat);
      const lng = Number(c.location.lng);
      if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return jsonError('Position invalide.', 400);
      next.location = { lat, lng, setAt: new Date().toISOString() };
    }
    const saved = await kvPut(schoolId, CONFIG_KEY, JSON.stringify(next), actor);
    if (!saved) return jsonError('Enregistrement impossible pour le moment. Réessayez.', 503);
    return NextResponse.json({ success: true, config: next }, { headers: NO_STORE });
  }

  // ─── Motif d'absence saisi par la Direction pour quelqu'un ───
  if (action === 'justify') {
    if (!isManager) return jsonError("Seule la Direction peut saisir le motif d'absence d'un autre membre.", 403);
    const staffId = String(body?.staffId || '');
    const date = isDate(body?.date) ? body.date : clock.date;
    const reason = String(body?.reason || '').trim().slice(0, 300);
    if (!staffId) return jsonError('Membre manquant.', 400);
    if (date > clock.date) return jsonError('Date dans le futur.', 400);
    const roster = await staffRoster(slug);
    const member = roster.find((m) => m.id === staffId);
    if (!member) return jsonError('Membre introuvable.', 404);
    const current = await readRecord(schoolId, date, staffId);
    if (current === undefined) return jsonError('Lecture impossible pour le moment. Réessayez.', 503);
    if (current?.arrival) return jsonError('Ce membre a pointé son arrivée ce jour-là : il est présent.', 409);
    const rec: PointageRecord = {
      ...(current || {}),
      staffId,
      fullName: member.fullName,
      roleId: member.roleId,
      absence: reason ? { reason, at: new Date().toISOString(), by: 'direction' } : undefined,
    };
    if (!reason) delete rec.absence;
    const saved = await kvPut(schoolId, recordKey(date, staffId), JSON.stringify(rec), actor);
    if (!saved) return jsonError('Enregistrement impossible pour le moment. Réessayez.', 503);
    return NextResponse.json({ success: true, record: rec }, { headers: NO_STORE });
  }

  // ─── Pointage personnel : arrivée, départ, motif d'absence ───
  if (!['arrive', 'depart', 'absence'].includes(action)) return jsonError('Action inconnue.', 400);
  if (POINTAGE_EXEMPT_ROLES.includes(session.roleId)) return jsonError('La direction générale ne pointe pas.', 403);
  if (!session.staffId) return jsonError('Reconnectez-vous pour pointer (session ancienne).', 401);
  if (!config.enabled) return jsonError("Le pointage n'est pas encore activé par la Direction.", 409);
  if (!config.workDays.includes(clock.weekday)) return jsonError("Pas de pointage aujourd'hui (jour non travaillé).", 409);

  const roster = await staffRoster(slug);
  const member = roster.find((m) => m.id === session.staffId);
  if (!member) return jsonError("Votre fiche n'est pas active dans l'établissement.", 403);

  const date = clock.date;
  const current = await readRecord(schoolId, date, member.id);
  if (current === undefined) return jsonError('Lecture impossible pour le moment. Réessayez.', 503);
  const rec: PointageRecord = { ...(current || {}), staffId: member.id, fullName: member.fullName, roleId: member.roleId };

  if (action === 'absence') {
    const reason = String(body?.reason || '').trim().slice(0, 300);
    if (reason.length < 3) return jsonError("Indiquez le motif de votre absence.", 400);
    if (rec.arrival) return jsonError('Vous avez déjà pointé votre arrivée aujourd’hui.', 409);
    rec.absence = { reason, at: new Date().toISOString(), by: 'self' };
  } else {
    // Position : obligatoire si la Direction a enregistré celle de l'école.
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    const accuracy = Math.max(0, Number(body?.accuracy) || 0);
    const hasPos = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
    let distance: number | undefined;
    if (config.location) {
      if (!hasPos) return jsonError('Activez la localisation de votre téléphone pour pointer.', 400);
      // Position trop imprécise (GPS coupé, seulement le réseau) : on ne peut rien vérifier.
      if (accuracy > 300) {
        return jsonError(
          `Position trop imprécise (± ${Math.round(accuracy)} m). Activez le GPS / « position précise » du téléphone, sortez dans la cour, puis réessayez.`,
          400
        );
      }
      distance = Math.round(distanceMeters(lat, lng, config.location.lat, config.location.lng));
      const tolerance = config.radiusMeters + Math.min(accuracy, 100);
      if (distance > tolerance) {
        return jsonError(
          `Vous êtes à environ ${distance} m de l'école (maximum ${config.radiusMeters} m). Le pointage se fait sur place.`,
          403
        );
      }
    }
    const stamp = {
      at: new Date().toISOString(),
      time: clock.time,
      ...(hasPos ? { lat, lng, accuracy: Math.round(accuracy) } : {}),
      ...(distance !== undefined ? { distance } : {}),
    };

    if (action === 'arrive') {
      if (rec.arrival) return jsonError(`Arrivée déjà pointée à ${rec.arrival.time}.`, 409);
      if (clock.time < config.arrivalStart) return jsonError(`Le pointage d'arrivée ouvre à ${config.arrivalStart}.`, 409);
      if (clock.time > config.arrivalEnd) {
        return jsonError(
          `Pointage d'arrivée fermé depuis ${config.arrivalEnd}. Indiquez le motif de votre absence ou de votre retard.`,
          409
        );
      }
      rec.arrival = stamp;
      delete rec.absence;
    } else {
      if (!rec.arrival) return jsonError("Vous n'avez pas pointé votre arrivée aujourd'hui.", 409);
      if (rec.departure) return jsonError(`Départ déjà pointé à ${rec.departure.time}.`, 409);
      if (clock.time < config.departureStart) return jsonError(`Le pointage de départ ouvre à ${config.departureStart}.`, 409);
      if (clock.time > config.departureEnd) return jsonError(`Pointage de départ fermé depuis ${config.departureEnd}.`, 409);
      rec.departure = stamp;
    }
  }

  const saved = await kvPut(schoolId, recordKey(date, member.id), JSON.stringify(rec), actor);
  if (!saved) return jsonError('Enregistrement impossible pour le moment. Réessayez.', 503);
  return NextResponse.json(
    { success: true, record: rec, status: dayStatus(rec, config, date, clock) },
    { headers: NO_STORE }
  );
}
