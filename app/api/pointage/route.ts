import { NextRequest, NextResponse } from 'next/server';
import { jsonError, requireSession } from '@/lib/server/auth';
import { getStaffAuthRecords } from '@/lib/supabase/services';
import { kvGet, kvListPrefix, kvPut, kvSchoolId } from '@/lib/supabase/kv';
import {
  isStaffRole,
  POINTAGE_EXEMPT_ROLES,
  POINTAGE_MANAGER_ROLES,
  POINTAGE_VIEW_ALL_ROLES,
  ROLE_LABELS,
} from '@/lib/auth/roles';
import { sendPushToRoles } from '@/lib/server/push';
import { randomInt } from 'crypto';
import {
  AbsenceRequest,
  DEFAULT_POINTAGE_CONFIG,
  PhaseOverride,
  PointageConfig,
  PointageRecord,
  dayStatus,
  distanceMeters,
  isValidHHMM,
  phaseState,
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

/*
 * Ouverture / fermeture AUTOMATIQUES : rien n'est écrit à l'heure H. À chaque lecture ou pointage,
 * phaseState() (lib/data/pointage.ts) compare l'heure de l'école aux plages réglées : la plage
 * d'arrivée ouvre à son heure de début et ferme à son heure de fin, idem pour le départ, chaque
 * jour de pointage, sans que la Direction ne touche à rien. Elle peut forcer à la main (ouvrir plus
 * tôt, fermer tout de suite) : le forçage ne vaut que pour la journée en cours.
 */

const reqPrefix = (date: string) => `sf_private_pointage_req_${date}_`;
const reqKey = (date: string, staffId: string) => `${reqPrefix(date)}${staffId}`;

async function readRequest(schoolId: string, date: string, staffId: string): Promise<AbsenceRequest | null | undefined> {
  const row = await kvGet(schoolId, reqKey(date, staffId));
  if (row === undefined) return undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

/** Ce que la personne qui a fait la demande a le droit de voir : jamais le code. */
const publicRequest = (r: AbsenceRequest) => ({ to: r.to, note: r.note, at: r.at, status: r.status, attempts: r.attempts || 0 });

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
    .filter((s) => isStaffRole(s.roleId) && !POINTAGE_EXEMPT_ROLES.includes(s.roleId) && s.status !== 'Verrouillé')
    .map((s) => ({ id: s.id, fullName: s.fullName, roleId: s.roleId, roleLabel: ROLE_LABELS[s.roleId] || s.role || '' }));
}

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if ('error' in auth) return auth.error;
  const { session, slug } = auth;
  if (!isStaffRole(session.roleId)) return jsonError('Réservé au personnel.', 403);

  const schoolId = await kvSchoolId(slug);
  if (!schoolId) return jsonError('Lecture impossible pour le moment. Réessayez.', 503);
  const storedConfig = await readConfig(schoolId);
  if (!storedConfig) return jsonError('Lecture impossible pour le moment. Réessayez.', 503);

  const clock = schoolClock(storedConfig.timezone);
  const config = storedConfig;
  const requested =request.nextUrl.searchParams.get('date');
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

  // Numéros WhatsApp de la Direction (fiches de « Administration & Codes ») : la demande de code
  // d'absence s'ouvre directement dans leur WhatsApp.
  const contacts: Record<string, { name: string; phone: string }> = {};
  const staffAll = await getStaffAuthRecords(slug);
  const meName = staffAll.find((s) => s.id === session.staffId)?.fullName || '';
  for (const s of staffAll) {
    if (!POINTAGE_MANAGER_ROLES.includes(s.roleId) || s.status === 'Verrouillé' || !s.phone || contacts[s.roleId]) continue;
    contacts[s.roleId] = { name: s.fullName, phone: s.phone };
  }

  // Demandes de code d'absence du jour : la Direction voit tout (avec le code), les autres seulement la leur.
  const canManage = POINTAGE_MANAGER_ROLES.includes(session.roleId);
  const myReq = session.staffId ? await readRequest(schoolId, clock.date, session.staffId) : null;
  let requests: (AbsenceRequest & { id: string })[] = [];
  if (canManage) {
    const rows = await kvListPrefix(schoolId, reqPrefix(clock.date));
    for (const row of rows || []) {
      try {
        requests.push({ ...JSON.parse(row.value), id: row.key.slice(reqPrefix(clock.date).length) });
      } catch {}
    }
    requests.sort((a, b) => (a.at < b.at ? 1 : -1));
  }

  return NextResponse.json(
    {
      success: true,
      date,
      today: clock.date,
      now: clock.time,
      weekday: clock.weekday,
      // Heure exacte du serveur : l'écran en déduit l'écart avec le téléphone et fait avancer
      // l'horloge tout seul (le bouton s'ouvre à l'heure pile, sans rafraîchir).
      serverTime: Date.now(),
      config,
      me: me || null,
      myStatus: dayStatus(me || null, config, date, clock),
      canManage,
      canViewAll,
      exempt: POINTAGE_EXEMPT_ROLES.includes(session.roleId),
      roster,
      records,
      contacts,
      meName,
      myRequest: myReq ? publicRequest(myReq) : null,
      requests,
    },
    { headers: NO_STORE }
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if ('error' in auth) return auth.error;
  const { session, slug } = auth;
  if (!isStaffRole(session.roleId)) return jsonError('Réservé au personnel.', 403);

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
  const storedConfig = await readConfig(schoolId);
  if (!storedConfig) return jsonError('Enregistrement impossible pour le moment. Réessayez.', 503);
  const clock = schoolClock(storedConfig.timezone);
  const config = storedConfig;

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
    // Forçage manuel, pour aujourd'hui seulement : « open » / « closed » ; « auto » rend la main aux horaires.
    const force = (v: unknown): PhaseOverride | null => (v === 'open' || v === 'closed' ? { mode: v, date: clock.date } : null);
    if (c.arrivalForce !== undefined) next.arrivalOverride = force(c.arrivalForce);
    if (c.departureForce !== undefined) next.departureOverride = force(c.departureForce);
    // Activer (avec ou sans nouveaux horaires) remet le pointage en mode automatique pour la journée.
    if (c.enabled === true && c.arrivalForce === undefined && c.departureForce === undefined) {
      next.arrivalOverride = null;
      next.departureOverride = null;
    }
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

  // ─── Code d'absence remis par la Direction à une personne qui l'a demandé ───
  if (action === 'grant_code') {
    if (!isManager) return jsonError("Seuls le Fondateur, le Fondateur adjoint et le Directeur remettent un code d'absence.", 403);
    const staffId = String(body?.staffId || '');
    if (!staffId) return jsonError('Membre manquant.', 400);
    const req = await readRequest(schoolId, clock.date, staffId);
    if (req === undefined) return jsonError('Lecture impossible pour le moment. Réessayez.', 503);
    if (!req) return jsonError('Demande introuvable.', 404);
    if (req.status === 'used') return jsonError("Ce code a déjà servi : l'absence est enregistrée.", 409);
    // Code déjà remis : on le redonne tel quel (sauf demande explicite d'un nouveau, ou blocage).
    const keep = req.status === 'granted' && req.code && body?.renew !== true;
    const next: AbsenceRequest = {
      ...req,
      status: 'granted',
      code: keep ? req.code : String(randomInt(1000, 10000)),
      attempts: keep ? req.attempts || 0 : 0,
      grantedAt: keep ? req.grantedAt : new Date().toISOString(),
      grantedBy: keep ? req.grantedBy : actor,
    };
    const saved = await kvPut(schoolId, reqKey(clock.date, staffId), JSON.stringify(next), actor);
    if (!saved) return jsonError('Enregistrement impossible pour le moment. Réessayez.', 503);
    return NextResponse.json({ success: true, request: { ...next, id: staffId } }, { headers: NO_STORE });
  }

  // ─── Pointage personnel : arrivée, départ, demande de code, motif d'absence ───
  if (!['arrive', 'depart', 'absence', 'request_code'].includes(action)) return jsonError('Action inconnue.', 400);
  if (POINTAGE_EXEMPT_ROLES.includes(session.roleId)) return jsonError('La direction générale ne pointe pas.', 403);
  if (!session.staffId) return jsonError('Reconnectez-vous pour pointer (session ancienne).', 401);
  // Pointer exige que la phase soit ouverte (horaires ou forçage) ; le motif d'absence et la demande
  // de code ne dépendent pas de l'heure : on peut les faire dès le matin, ou après la fermeture.
  const isPunch = action === 'arrive' || action === 'depart';
  if (isPunch) {
    const st = phaseState(config, clock, action === 'arrive' ? 'arrival' : 'departure');
    if (!st.open && st.forced) return jsonError('Le pointage a été fermé par la Direction.', 409);
    if (!st.forced) {
      if (!config.enabled) return jsonError("Le pointage n'est pas encore activé par la Direction.", 409);
      if (!config.workDays.includes(clock.weekday)) return jsonError("Pas de pointage aujourd'hui (jour non travaillé).", 409);
    }
  } else {
    if (!config.enabled && config.arrivalOverride?.date !== clock.date) {
      return jsonError("Le pointage n'est pas encore activé par la Direction.", 409);
    }
    if (!config.workDays.includes(clock.weekday) && config.arrivalOverride?.date !== clock.date) {
      return jsonError("Pas de pointage aujourd'hui (jour non travaillé).", 409);
    }
  }

  const roster = await staffRoster(slug);
  const member = roster.find((m) => m.id === session.staffId);
  if (!member) return jsonError("Votre fiche n'est pas active dans l'établissement.", 403);

  const date = clock.date;

  // ─── Demande de code : message à la Direction ───
  if (action === 'request_code') {
    const to = String(body?.to || '');
    if (!POINTAGE_MANAGER_ROLES.includes(to)) return jsonError('Choisissez à qui envoyer la demande (Fondateur, DGA ou Directeur).', 400);
    const todayRec = await readRecord(schoolId, date, member.id);
    if (todayRec === undefined) return jsonError('Lecture impossible pour le moment. Réessayez.', 503);
    if (todayRec?.arrival) return jsonError('Vous avez déjà pointé votre arrivée aujourd’hui.', 409);
    if (todayRec?.absence) return jsonError('Votre absence est déjà enregistrée aujourd’hui.', 409);
    const existing = await readRequest(schoolId, date, member.id);
    if (existing === undefined) return jsonError('Lecture impossible pour le moment. Réessayez.', 503);
    // Demande déjà traitée (code remis ou déjà servi) : on la renvoie. Une demande en attente ou
    // bloquée (trop d'essais) est refaite à neuf.
    if (existing && (existing.status === 'granted' || existing.status === 'used')) {
      return NextResponse.json({ success: true, request: publicRequest(existing) }, { headers: NO_STORE });
    }
    const req: AbsenceRequest = {
      staffId: member.id,
      fullName: member.fullName,
      roleId: member.roleId,
      to,
      note: String(body?.note || '').trim().slice(0, 200) || undefined,
      at: new Date().toISOString(),
      status: 'pending',
    };
    const saved = await kvPut(schoolId, reqKey(date, member.id), JSON.stringify(req), actor);
    if (!saved) return jsonError('Envoi impossible pour le moment. Réessayez.', 503);
    sendPushToRoles(
      schoolId,
      [to],
      {
        title: '✉️ Demande de code d’absence',
        body: `${member.fullName} (${ROLE_LABELS[member.roleId] || 'Personnel'}) demande un code pour déclarer son absence.${req.note ? ` « ${req.note} »` : ''}`,
        url: `/${slug}/admin/pointage`,
        tag: `pointage-code-${member.id}-${date}`,
      },
      { exceptStaffId: member.id }
    ).catch(() => {});
    return NextResponse.json({ success: true, request: publicRequest(req) }, { headers: NO_STORE });
  }

  const current = await readRecord(schoolId, date, member.id);
  if (current === undefined) return jsonError('Lecture impossible pour le moment. Réessayez.', 503);
  const rec: PointageRecord = { ...(current || {}), staffId: member.id, fullName: member.fullName, roleId: member.roleId };

  let usedRequest: AbsenceRequest | null = null;
  if (action === 'absence') {
    const reason = String(body?.reason || '').trim().slice(0, 300);
    if (reason.length < 3) return jsonError("Indiquez le motif de votre absence.", 400);
    if (rec.arrival) return jsonError('Vous avez déjà pointé votre arrivée aujourd’hui.', 409);
    if (rec.absence) return jsonError('Votre absence est déjà enregistrée. Seule la Direction peut modifier le motif.', 409);
    // Le motif ne s'enregistre qu'avec le code remis par la Direction après la demande.
    const req = await readRequest(schoolId, date, member.id);
    if (req === undefined) return jsonError('Lecture impossible pour le moment. Réessayez.', 503);
    if (!req || req.status === 'pending') {
      return jsonError("Demandez d'abord un code à la Direction (Fondateur, DGA ou Directeur) : elle vous le remettra.", 403);
    }
    if (req.status === 'locked') return jsonError('Trop d’essais : redemandez un code à la Direction.', 403);
    if (req.status === 'used' || !req.code) return jsonError('Ce code a déjà servi. Redemandez-en un à la Direction.', 403);
    const given = String(body?.code || '').replace(/\D/g, '');
    if (given !== req.code) {
      const attempts = (req.attempts || 0) + 1;
      const locked = attempts >= 5;
      await kvPut(schoolId, reqKey(date, member.id), JSON.stringify({ ...req, attempts, status: locked ? 'locked' : req.status }), actor);
      return jsonError(locked ? 'Trop d’essais : redemandez un code à la Direction.' : `Code incorrect (${5 - attempts} essai(s) restant(s)).`, 403);
    }
    usedRequest = req;
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
      const st = phaseState(config, clock, 'arrival');
      if (!st.open) {
        if (st.position === 'before') return jsonError(`Le pointage d'arrivée ouvre à ${config.arrivalStart}.`, 409);
        return jsonError(
          `Pointage d'arrivée fermé depuis ${config.arrivalEnd}. Demandez un code à la Direction pour déclarer votre absence ou votre retard.`,
          409
        );
      }
      rec.arrival = stamp;
      delete rec.absence;
    } else {
      if (!rec.arrival) return jsonError("Vous n'avez pas pointé votre arrivée aujourd'hui.", 409);
      if (rec.departure) return jsonError(`Départ déjà pointé à ${rec.departure.time}.`, 409);
      const st = phaseState(config, clock, 'departure');
      if (!st.open) {
        return jsonError(
          st.position === 'before' ? `Le pointage de départ ouvre à ${config.departureStart}.` : `Pointage de départ fermé depuis ${config.departureEnd}.`,
          409
        );
      }
      rec.departure = stamp;
    }
  }

  const saved = await kvPut(schoolId, recordKey(date, member.id), JSON.stringify(rec), actor);
  if (!saved) return jsonError('Enregistrement impossible pour le moment. Réessayez.', 503);
  // Code à usage unique : brûlé seulement une fois l'absence bien enregistrée.
  if (usedRequest) await kvPut(schoolId, reqKey(date, member.id), JSON.stringify({ ...usedRequest, status: 'used' }), actor);

  // Direction prévenue sur son téléphone (même application fermée) : qui, quoi, à quelle heure.
  const roleLabel = ROLE_LABELS[member.roleId] || 'Personnel';
  const what =
    action === 'arrive'
      ? `est arrivé(e) à ${rec.arrival?.time}${rec.arrival?.distance !== undefined ? ` (à ${rec.arrival.distance} m de l’école)` : ''}`
      : action === 'depart'
      ? `est parti(e) à ${rec.departure?.time}`
      : `signale une absence : ${rec.absence?.reason || ''}`;
  sendPushToRoles(
    schoolId,
    POINTAGE_VIEW_ALL_ROLES,
    {
      title: action === 'absence' ? '🟠 Absence signalée' : action === 'arrive' ? '🟢 Pointage — arrivée' : '🔵 Pointage — départ',
      body: `${member.fullName} (${roleLabel}) ${what}.`,
      url: `/${slug}/admin/pointage`,
      tag: `pointage-${member.id}-${date}-${action}`,
    },
    { exceptStaffId: member.id }
  ).catch(() => {});

  return NextResponse.json(
    { success: true, record: rec, status: dayStatus(rec, config, date, clock) },
    { headers: NO_STORE }
  );
}
