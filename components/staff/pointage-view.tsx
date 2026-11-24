'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock,
  LogIn,
  LogOut,
  MapPin,
  Settings2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Save,
  FileText,
  X,
  RefreshCw,
} from 'lucide-react';
import {
  AbsenceRequest,
  PointageConfig,
  PointageRecord,
  PointageStatus,
  STATUS_LABELS,
  WEEKDAY_LABELS,
  dayStatus,
  departureLabel,
  distanceMeters,
  phaseState,
  schoolClock,
} from '@/lib/data/pointage';
import { FrenchDateInput } from '@/components/ui/french-date-input';
import { TimePicker } from '@/components/ui/time-picker';
import { SchoolLocationCard } from '@/components/staff/school-location-card';

type Member = { id: string; fullName: string; roleId: string; roleLabel: string };
type Payload = {
  date: string;
  today: string;
  now: string;
  weekday: number;
  serverTime?: number;
  config: PointageConfig;
  me: PointageRecord | null;
  myStatus: PointageStatus;
  canManage: boolean;
  canViewAll: boolean;
  exempt: boolean;
  roster: Member[];
  records: Record<string, PointageRecord>;
  /** Ma demande de code d'absence du jour (sans le code). */
  /** Numéros WhatsApp de la Direction par poste (fiches de Administration & Codes). */
  contacts: Record<string, { name: string; phone: string }>;
  meName: string;
  myRequest: { to: string; note?: string; at: string; status: AbsenceRequest['status']; attempts: number } | null;
  /** Direction : toutes les demandes du jour, avec le code remis. */
  requests: (AbsenceRequest & { id: string })[];
};

const RECIPIENTS: { id: string; label: string }[] = [
  { id: 'fondateur', label: 'Fondateur' },
  { id: 'fondateur_adjoint', label: 'DGA (Fondateur adjoint)' },
  { id: 'directeur', label: 'Directeur' },
];
const recipientLabel = (id: string) => RECIPIENTS.find((r) => r.id === id)?.label || id;
const hhmm = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const STATUS_STYLES: Record<PointageStatus, string> = {
  present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  parti: 'bg-emerald-600 text-white border-emerald-700',
  absent_justifie: 'bg-amber-50 text-amber-800 border-amber-300',
  absent: 'bg-rose-50 text-rose-700 border-rose-200',
  en_attente: 'bg-slate-100 text-slate-700 border-slate-300',
  non_travaille: 'bg-slate-100 text-slate-500 border-slate-200',
  inactif: 'bg-slate-100 text-slate-500 border-slate-200',
};

function StatusBadge({ status }: { status: PointageStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-[11px] font-bold whitespace-nowrap ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

const frDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

/** Position du téléphone (précision maximale, 20 s au plus). */
function getPosition(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('La localisation n’est pas disponible sur cet appareil.'));
      return;
    }
    const ok = (p: GeolocationPosition) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
    const denied = () =>
      reject(
        new Error(
          'Localisation bloquée pour ce site. Pour la débloquer : touchez le cadenas (ou les deux petits curseurs) à gauche de l’adresse en haut de Chrome → « Autorisations » / « Paramètres du site » → Position → « Autoriser », puis revenez ici et touchez « Réessayer ». ' +
            'Si le problème continue : activez la Localisation du téléphone (menu du haut), et ouvrez le lien dans Chrome (pas dans WhatsApp ou Facebook).'
        )
      );
    navigator.geolocation.getCurrentPosition(
      ok,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) return denied();
        // GPS lent ou indisponible : deuxième essai avec la position réseau (moins précise).
        navigator.geolocation.getCurrentPosition(
          ok,
          (err2) =>
            err2.code === err2.PERMISSION_DENIED
              ? denied()
              : reject(new Error('Position introuvable. Activez la Localisation (GPS) du téléphone, sortez dans la cour et réessayez.')),
          { enableHighAccuracy: false, timeout: 12000, maximumAge: 0 }
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });
}

async function post(body: Record<string, unknown>) {
  const res = await fetch('/api/pointage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(j?.error || 'Enregistrement impossible. Réessayez.');
  return j;
}

export function PointageView({ schoolSlug }: { schoolSlug: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [absenceReason, setAbsenceReason] = useState('');
  const [showAbsence, setShowAbsence] = useState(false);
  const [draft, setDraft] = useState<PointageConfig | null>(null);
  const [justifyFor, setJustifyFor] = useState<Member | null>(null);
  const [justifyReason, setJustifyReason] = useState('');
  // Écart entre l'horloge du téléphone et celle du serveur, et « tic » qui fait avancer l'heure
  // affichée toute seule (le bouton s'ouvre à l'heure pile, sans rafraîchir la page).
  const [offset, setOffset] = useState(0);
  const [tick, setTick] = useState(0);
  // Fenêtre de validation : position vérifiée AVANT d'enregistrer l'arrivée / le départ.
  const [confirm, setConfirm] = useState<{
    action: 'arrive' | 'depart';
    status: 'locating' | 'ready' | 'error';
    pos?: { lat: number; lng: number; accuracy: number };
    distance?: number;
    error?: string;
  } | null>(null);

  const load = useCallback(
    async (d?: string) => {
      try {
        const q = d ? `?date=${encodeURIComponent(d)}` : '';
        const res = await fetch(`/api/pointage${q}`, { cache: 'no-store' });
        const j = await res.json().catch(() => null);
        if (!res.ok || !j?.success) throw new Error(j?.error || 'Lecture impossible.');
        if (typeof j.serverTime === 'number') setOffset(j.serverTime - Date.now());
        setData(j);
        setDate(j.date);
        setDraft((prev) => prev || j.config);
        setLoadError('');
      } catch (e: any) {
        setLoadError(e?.message || 'Lecture impossible.');
      }
    },
    []
  );

  useEffect(() => {
    load();
    // Réglages de la Direction et pointages des collègues : relus toutes les 8 s, et aussitôt que
    // l'écran redevient actif (déverrouillage du téléphone, retour sur l'onglet, réseau revenu).
    const refresh = () => {
      if (document.visibilityState === 'visible') load(date || undefined);
    };
    const t = setInterval(refresh, 8000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, date, schoolSlug]);

  // Horloge de l'écran : vérifiée chaque seconde (et aussitôt que le téléphone se réveille, que
  // l'onglet redevient visible ou que le réseau revient — les minuteurs d'un onglet en veille sont
  // gelés par le navigateur, d'où les boutons qui restaient fermés après l'heure). L'écran n'est
  // redessiné que lorsque la minute change.
  const lastMinuteRef = useRef('');
  const offsetRef = useRef(0);
  offsetRef.current = offset;
  useEffect(() => {
    const check = (forceRefresh = false) => {
      const minute = String(Math.floor((Date.now() + offsetRef.current) / 60000));
      if (minute !== lastMinuteRef.current) {
        lastMinuteRef.current = minute;
        setTick((n) => n + 1);
      }
      if (forceRefresh && document.visibilityState === 'visible') load(date || undefined);
    };
    const t = setInterval(() => check(), 1000);
    const wake = () => check(true);
    window.addEventListener('focus', wake);
    window.addEventListener('pageshow', wake);
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', wake);
      window.removeEventListener('pageshow', wake);
      window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', wake);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, date]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 6000);
    return () => clearTimeout(t);
  }, [message]);

  const run = async (key: string, fn: () => Promise<unknown>, okText: string): Promise<boolean> => {
    if (busy) return false;
    setBusy(key);
    setMessage(null);
    try {
      await fn();
      setMessage({ type: 'ok', text: okText });
      await load(date || undefined);
      return true;
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Erreur.' });
      return false;
    } finally {
      setBusy('');
    }
  };

  // Étape 1 : la fenêtre s'ouvre et demande la position (le téléphone réclame l'autorisation GPS à
  // chaque fois si elle n'est pas accordée). Étape 2 : la personne voit sa distance à l'école et valide.
  const locate = async (action: 'arrive' | 'depart') => {
    setConfirm({ action, status: 'locating' });
    try {
      const pos = await getPosition();
      const school = data?.config.location;
      const distance = school ? Math.round(distanceMeters(pos.lat, pos.lng, school.lat, school.lng)) : undefined;
      setConfirm({ action, status: 'ready', pos, distance });
    } catch (e: any) {
      // Sans position enregistrée pour l'école, le serveur accepte quand même.
      if (!data?.config.location) setConfirm({ action, status: 'ready' });
      else setConfirm({ action, status: 'error', error: e?.message || 'Position introuvable.' });
    }
  };

  const confirmPunch = async () => {
    if (!confirm || confirm.status !== 'ready') return;
    const { action, pos } = confirm;
    const ok = await run(
      action,
      () => post({ action, ...(pos || {}) }),
      action === 'arrive' ? 'Arrivée pointée. Bonne journée !' : 'Départ pointé. À demain !'
    );
    void ok;
    setConfirm(null);
  };

  const live = useMemo(
    () => (data ? schoolClock(data.config.timezone, new Date(Date.now() + offset)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, offset, tick]
  );

  const today = data?.today || '';
  const isToday = !!data && data.date === data.today;
  const cfg = data?.config;
  const now = live?.time || data?.now || '';
  // Ouverture / fermeture : mêmes règles que le serveur (horaires, ou forçage de la Direction), et
  // recalculées à chaque « tic » d'horloge : le bouton s'ouvre et se ferme tout seul, sans rafraîchir.
  const clk = { date: live?.date || data?.today || '', time: now };
  const arrivalSt = cfg ? phaseState(cfg, clk, 'arrival') : null;
  const departureSt = cfg ? phaseState(cfg, clk, 'departure') : null;
  const arrivalOpen = !!arrivalSt?.open;
  const departureOpen = !!departureSt?.open;
  const workDay = !!cfg && cfg.workDays.includes(data?.weekday ?? -1);
  const toDeparture = !!cfg && isToday && !arrivalOpen && now > cfg.arrivalEnd;
  const [codeTo, setCodeTo] = useState('');
  const [codeNote, setCodeNote] = useState('');
  const [absenceCode, setAbsenceCode] = useState('');
  const [shownCode, setShownCode] = useState<{ id: string; code: string } | null>(null);

  const rows = useMemo(() => {
    if (!data) return [];
    const clock = { date: live?.date || data.today, time: now };
    return data.roster.map((m) => {
      const rec = data.records[m.id] || null;
      return { member: m, rec, status: dayStatus(rec, data.config, data.date, clock) };
    });
  }, [data, live, now]);

  const counts = useMemo(() => {
    const c = { present: 0, present_only: 0, absent: 0, absent_justifie: 0, en_attente: 0 };
    for (const r of rows) {
      if (r.status === 'present') c.present_only++;
      if (r.status === 'present' || r.status === 'parti') c.present++;
      else if (r.status === 'absent') c.absent++;
      else if (r.status === 'absent_justifie') c.absent_justifie++;
      else if (r.status === 'en_attente') c.en_attente++;
    }
    return c;
  }, [rows]);

  if (!data) {
    return (
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs text-center text-sm text-slate-600">
        {loadError ? (
          <div className="space-y-3">
            <p className="font-semibold text-rose-600">{loadError}</p>
            <button
              type="button"
              onClick={() => load()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Réessayer
            </button>
          </div>
        ) : (
          'Chargement du pointage…'
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ================= EN-TÊTE ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-slate-900 tracking-tight font-heading">Pointage du personnel</h1>
            <p className="text-xs text-slate-500 first-letter:uppercase">
              {frDate(today)} • Heure de l’établissement : <span className="font-bold text-slate-900">{now}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-bold">
          {/* Le créneau EN COURS passe en noir (arrivée entre son début et sa fin, puis départ) ;
              hors de son horaire, il reste gris. */}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-colors ${
              arrivalOpen ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            {arrivalOpen && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
            Arrivée {cfg!.arrivalStart} – {cfg!.arrivalEnd}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-colors ${
              departureOpen ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            {departureOpen && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
            Départ {cfg!.departureStart} – {cfg!.departureEnd}
          </span>
        </div>
      </div>

      {message && (
        <div
          className={`fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm z-[100] shadow-2xl p-3.5 rounded-2xl border text-xs font-semibold flex items-start gap-2 ${
            message.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {message.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {!cfg!.enabled && !arrivalOpen && !departureOpen && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            Le pointage n’est pas encore activé.{' '}
            {data.canManage ? 'Réglez les horaires ci-dessous puis activez-le.' : 'La Direction doit l’activer.'}
          </span>
        </div>
      )}

      {/* ================= MON POINTAGE ================= */}
      {!data.exempt && (
        <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-extrabold text-slate-900 font-heading">Mon pointage d’aujourd’hui</h2>
            <StatusBadge status={data.myStatus} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Arrivée</p>
              <p className={`font-extrabold font-heading ${data.me?.arrival ? 'text-lg text-slate-900' : 'text-sm text-slate-500 py-1'}`}>
                {data.me?.arrival?.time || (data.myStatus === 'en_attente' ? 'Pas encore pointé' : '—')}
              </p>
              {data.me?.arrival?.distance !== undefined && (
                <p className="text-[11px] text-slate-500">À {data.me.arrival.distance} m de l’école</p>
              )}
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Départ</p>
              {(() => {
                const label = departureLabel(data.me, data.config, data.today, { date: data.today, time: data.now });
                const isTime = /^\d/.test(label);
                return (
                  <p className={`font-extrabold font-heading ${isTime ? 'text-lg text-slate-900' : 'text-sm text-slate-500 py-1'}`}>{label}</p>
                );
              })()}
            </div>
          </div>

          {data.me?.absence && (
            <p className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <span className="font-bold">Motif d’absence :</span> {data.me.absence.reason}
              {data.me.absence.by === 'direction' ? ' (saisi par la Direction)' : ''}
            </p>
          )}

          {(arrivalOpen || departureOpen || (cfg!.enabled && workDay)) && (
            <div className="flex flex-col sm:flex-row gap-2.5">
              {!data.me?.arrival && (
                <button
                  type="button"
                  onClick={() => locate('arrive')}
                  disabled={!arrivalOpen || !!busy}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-sm shadow-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  {busy === 'arrive'
                    ? 'Localisation…'
                    : arrivalOpen
                    ? 'Pointer mon arrivée'
                    : arrivalSt?.forced
                    ? 'Fermé par la Direction'
                    : now < cfg!.arrivalStart
                    ? `Ouvre à ${cfg!.arrivalStart}`
                    : `Fermé depuis ${cfg!.arrivalEnd}`}
                </button>
              )}
              {data.me?.arrival && !data.me?.departure && (
                <button
                  type="button"
                  onClick={() => locate('depart')}
                  disabled={!departureOpen || !!busy}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  {busy === 'depart'
                    ? 'Localisation…'
                    : departureOpen
                    ? 'Pointer mon départ'
                    : departureSt?.forced
                    ? 'Fermé par la Direction'
                    : now < cfg!.departureStart
                    ? `Départ à partir de ${cfg!.departureStart}`
                    : `Fermé depuis ${cfg!.departureEnd}`}
                </button>
              )}
              {!data.me?.arrival && !data.me?.absence && (
                <button
                  type="button"
                  onClick={() => setShowAbsence((v) => !v)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-amber-900 bg-amber-50 border border-amber-300 hover:bg-amber-100 cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  Je suis absent(e)
                </button>
              )}
            </div>
          )}
          {cfg!.enabled && !workDay && (
            <p className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
              Aujourd’hui ({WEEKDAY_LABELS[live?.weekday ?? data.weekday]}) n’est pas un jour de pointage. La Direction doit cocher ce jour dans
              « Jours de pointage » <span className="font-bold">puis cliquer sur « Enregistrer les horaires »</span> ; il s’ouvrira ici en quelques
              secondes, sans rafraîchir.
            </p>
          )}

          {(showAbsence || data.myRequest) && !data.me?.arrival && !data.me?.absence && (
            <div className="space-y-3 p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200">
              {/* Étape 1 : message à la Direction pour obtenir un code */}
              {(!data.myRequest || data.myRequest.status === 'locked') && (
                <div className="space-y-2.5">
                  <p className="text-xs font-bold text-amber-900">
                    {data.myRequest?.status === 'locked'
                      ? 'Trop d’essais : envoyez une nouvelle demande.'
                      : 'Pour déclarer votre absence, demandez d’abord un code à la Direction.'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {RECIPIENTS.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setCodeTo(r.id)}
                        className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${
                          codeTo === r.id ? 'bg-amber-600 text-white border-amber-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <input
                    value={codeNote}
                    onChange={(e) => setCodeNote(e.target.value)}
                    maxLength={200}
                    placeholder="Message (facultatif) : ex. je suis souffrant, puis-je avoir un code ?"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none focus:border-amber-600"
                  />
                  <button
                    type="button"
                    disabled={!!busy || !codeTo}
                    onClick={() => {
                      // WhatsApp de la personne choisie (numéro de « Administration & Codes ») : la fenêtre
                      // s'ouvre tout de suite, message déjà écrit ; la demande est aussi enregistrée dans l'application.
                      const phone = (data.contacts?.[codeTo]?.phone || '').replace(/\D/g, '');
                      if (phone) {
                        const wa = phone.startsWith('225') || phone.length > 10 ? phone : `225${phone}`;
                        const text =
                          `Bonjour, je suis ${data.meName || 'un membre du personnel'}. Je ne peux pas pointer aujourd'hui (${frDate(data.today)}). ` +
                          `Pouvez-vous me donner le code d'absence pour enregistrer mon motif ?${codeNote.trim() ? ` Motif : ${codeNote.trim()}` : ''}`;
                        window.open(`https://wa.me/${wa}?text=${encodeURIComponent(text)}`, '_blank');
                      }
                      run('request_code', () => post({ action: 'request_code', to: codeTo, note: codeNote }), phone ? 'Demande enregistrée et WhatsApp ouvert.' : 'Demande envoyée à la Direction.').then(
                        (ok) => ok && setCodeNote('')
                      );
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                  >
                    {busy === 'request_code' ? 'Envoi…' : data.contacts?.[codeTo]?.phone ? 'Demander le code sur WhatsApp' : 'Envoyer la demande de code'}
                  </button>
                </div>
              )}

              {/* Étape 2 : en attente du code */}
              {data.myRequest?.status === 'pending' && (
                <p className="text-xs text-amber-900 flex items-start gap-2">
                  <Clock className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>
                    Demande envoyée à <span className="font-bold">{recipientLabel(data.myRequest.to)}</span> à {hhmm(data.myRequest.at)}. Dès qu’il vous remet le code,
                    saisissez-le ci-dessous avec votre motif.
                  </span>
                </p>
              )}

              {/* Étape 3 : code reçu + motif */}
              {(data.myRequest?.status === 'pending' || data.myRequest?.status === 'granted') && (
                <div className="space-y-2">
                  <input
                    value={absenceCode}
                    onChange={(e) => setAbsenceCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Code remis par la Direction"
                    className="w-full sm:w-64 px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono tracking-widest text-slate-900 bg-white focus:outline-none focus:border-emerald-600"
                  />
                  <textarea
                    value={absenceReason}
                    onChange={(e) => setAbsenceReason(e.target.value)}
                    rows={3}
                    maxLength={300}
                    placeholder="Motif : ex. malade (certificat médical), décès dans la famille, convocation officielle…"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none focus:border-emerald-600"
                  />
                  <button
                    type="button"
                    disabled={!!busy || absenceReason.trim().length < 3 || absenceCode.length < 4}
                    onClick={() =>
                      run('absence', () => post({ action: 'absence', reason: absenceReason, code: absenceCode }), 'Motif d’absence enregistré.').then((ok) => {
                        if (ok) {
                          setShowAbsence(false);
                          setAbsenceCode('');
                          setAbsenceReason('');
                        }
                      })
                    }
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {busy === 'absence' ? 'Enregistrement…' : 'Enregistrer mon absence'}
                  </button>
                </div>
              )}
            </div>
          )}

          {cfg!.location ? (
            <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              Le pointage se fait sur place : votre position est vérifiée (moins de {cfg!.radiusMeters} m de l’école).
            </p>
          ) : null}
        </div>
      )}

      {/* ================= DEMANDES DE CODE D'ABSENCE (Direction) ================= */}
      {data.canManage && data.requests.length > 0 && (
        <div className="bg-white p-4 sm:p-6 rounded-3xl border border-amber-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-extrabold text-slate-900 font-heading">Demandes de code d’absence</h2>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
              {data.requests.filter((r) => r.status === 'pending' || r.status === 'locked').length} en attente
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Appelez la personne, écoutez la raison, puis remettez-lui le code (valable aujourd’hui, à usage unique). Elle saisira son motif avec ce code.
          </p>
          <div className="space-y-2">
            {data.requests.map((r) => {
              const code = shownCode?.id === r.id ? shownCode.code : r.status === 'granted' ? r.code : undefined;
              return (
                <div key={r.id} className="p-3 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center gap-2.5 justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 break-words">
                      {r.fullName} <span className="text-[11px] font-medium text-slate-500">• {ROLE_LABELS_SHORT[r.roleId] || 'Personnel'}</span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Envoyé à {recipientLabel(r.to)} à {hhmm(r.at)}
                      {r.note ? ` — « ${r.note} »` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.status === 'used' ? (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">Absence enregistrée</span>
                    ) : (
                      <>
                        {code && (
                          <span className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-mono text-lg font-extrabold tracking-[0.3em]">{code}</span>
                        )}
                        <button
                          type="button"
                          disabled={!!busy}
                          onClick={() =>
                            run(
                              'grant_' + r.id,
                              () =>
                                post({ action: 'grant_code', staffId: r.id, renew: r.status === 'locked' }).then((j) =>
                                  setShownCode({ id: r.id, code: j.request.code })
                                ),
                              'Code prêt : communiquez-le à la personne.'
                            )
                          }
                          className="px-3 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                        >
                          {r.status === 'granted' ? 'Afficher le code' : r.status === 'locked' ? 'Nouveau code' : 'Donner le code'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= RÉGLAGES (Direction) ================= */}
      {data.canManage && draft && (
        <ConfigCard
          draft={draft}
          setDraft={setDraft}
          saved={data.config}
          clock={clk}
          busy={busy}
          onSave={(c) => run('config', () => post({ action: 'config', config: c }).then((j) => setDraft(j.config)), 'Réglages du pointage enregistrés.')}
          onLocationSaved={(c) => {
            setDraft((d) => (d ? { ...d, location: c.location, radiusMeters: c.radiusMeters } : c));
            load(date || undefined);
          }}
        />
      )}

      {/* ================= TABLEAU DU PERSONNEL ================= */}
      {data.canViewAll && (
        <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-extrabold text-slate-900 font-heading">Pointage du personnel</h2>
            </div>
            <div className="w-full sm:w-[190px]">
              <FrenchDateInput
                value={date}
                align="right"
                onChange={(v) => {
                  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
                  const d = v > today ? today : v; // pas de pointage dans le futur
                  setDate(d);
                  load(d);
                }}
              />
            </div>
          </div>
          <p className="text-xs text-slate-500 capitalize">{frDate(data.date)}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { label: 'Présents', value: counts.present, cls: 'text-emerald-700' },
              { label: 'Total absents', value: counts.absent + counts.absent_justifie, cls: 'text-rose-600' },
              { label: 'Dont avec motif', value: counts.absent_justifie, cls: 'text-amber-700' },
              // Après l'heure d'arrivée : on suit le DÉPART — les présents qui n'ont pas encore pointé leur départ
              // (le nombre baisse à chaque départ pointé). Avant : ceux qui n'ont pas encore pointé l'arrivée.
              toDeparture
                ? {
                    label: now > cfg!.departureEnd ? 'Départ non pointé' : 'Départ pas encore pointé',
                    value: counts.present_only,
                    cls: 'text-slate-700',
                  }
                : { label: 'Pas encore pointé', value: counts.en_attente, cls: 'text-slate-700' },
            ].map((k) => (
              <div key={k.label} className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{k.label}</p>
                <p className={`text-2xl font-extrabold font-heading ${k.cls}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Téléphone : une carte par membre (le tableau ne tient pas en largeur) */}
          <div className="md:hidden space-y-2.5">
            {rows.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-500">Aucun membre du personnel enregistré (Administration & Codes).</p>
            )}
            {rows.map(({ member, rec, status }) => {
              const dep = departureLabel(rec, data.config, data.date, { date: data.today, time: data.now });
              return (
                <div key={member.id} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 leading-tight break-words">{member.fullName}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{member.roleLabel}</p>
                    </div>
                    <StatusBadge status={status} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="px-3 py-2 rounded-xl bg-white border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Arrivée</p>
                      <p className={rec?.arrival ? 'text-sm font-extrabold text-slate-900' : 'text-[11px] font-semibold text-slate-500'}>
                        {rec?.arrival
                          ? `${rec.arrival.time}${rec.arrival.distance !== undefined ? ` • ${rec.arrival.distance} m` : ''}`
                          : status === 'en_attente'
                          ? 'Pas encore pointé'
                          : '—'}
                      </p>
                    </div>
                    <div className="px-3 py-2 rounded-xl bg-white border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Départ</p>
                      <p className={/^\d/.test(dep) ? 'text-sm font-extrabold text-slate-900' : 'text-[11px] font-semibold text-slate-500'}>{dep}</p>
                    </div>
                  </div>
                  {rec?.absence?.reason && (
                    <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      <span className="font-bold">Motif :</span> {rec.absence.reason}
                    </p>
                  )}
                  {data.canManage && !rec?.arrival && status !== 'non_travaille' && status !== 'inactif' && (
                    <button
                      type="button"
                      onClick={() => {
                        setJustifyFor(member);
                        setJustifyReason(rec?.absence?.reason || '');
                      }}
                      className="w-full py-2 rounded-xl text-xs font-bold text-emerald-700 bg-white border border-emerald-200 hover:bg-emerald-50 cursor-pointer"
                    >
                      {rec?.absence ? 'Modifier le motif' : 'Saisir un motif d’absence'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="hidden md:block overflow-x-auto -mx-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                  <th className="py-2 px-2 font-bold">Membre</th>
                  <th className="py-2 px-2 font-bold">Arrivée</th>
                  <th className="py-2 px-2 font-bold">Départ</th>
                  <th className="py-2 px-2 font-bold">Statut</th>
                  <th className="py-2 px-2 font-bold">Motif</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      Aucun membre du personnel enregistré (Administration & Codes).
                    </td>
                  </tr>
                )}
                {rows.map(({ member, rec, status }) => (
                  <tr key={member.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 px-2">
                      <p className="font-bold text-slate-900">{member.fullName}</p>
                      <p className="text-[11px] text-slate-500">{member.roleLabel}</p>
                    </td>
                    <td className="py-2.5 px-2 font-bold text-slate-900">
                      {rec?.arrival ? (
                        <>
                          {rec.arrival.time}
                          {rec.arrival.distance !== undefined && (
                            <span className="block text-[10px] font-medium text-slate-500">{rec.arrival.distance} m</span>
                          )}
                        </>
                      ) : status === 'en_attente' ? (
                        <span className="text-[11px] font-semibold text-slate-500">Pas encore pointé</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2.5 px-2 font-bold text-slate-900">
                      {(() => {
                        const label = departureLabel(rec, data.config, data.date, { date: data.today, time: data.now });
                        return /^\d/.test(label) ? label : <span className="text-[11px] font-semibold text-slate-500">{label}</span>;
                      })()}
                    </td>
                    <td className="py-2.5 px-2">
                      <StatusBadge status={status} />
                    </td>
                    <td className="py-2.5 px-2 text-slate-700 max-w-[260px]">
                      {rec?.absence?.reason || ''}
                      {data.canManage && !rec?.arrival && status !== 'non_travaille' && status !== 'inactif' && (
                        <button
                          type="button"
                          onClick={() => {
                            setJustifyFor(member);
                            setJustifyReason(rec?.absence?.reason || '');
                          }}
                          className="block mt-1 text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                        >
                          {rec?.absence ? 'Modifier le motif' : 'Saisir un motif'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= VALIDATION : HEURE + POSITION ================= */}
      {confirm && (
        <div className="fixed inset-0 z-[120] bg-slate-950/50 flex items-center justify-center p-4" onClick={() => !busy && setConfirm(null)}>
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 font-heading">
                  {confirm.action === 'arrive' ? 'Valider mon arrivée' : 'Valider mon départ'}
                </h3>
                <p className="text-xs text-slate-500 first-letter:uppercase">{frDate(data.today)}</p>
              </div>
              <button type="button" onClick={() => setConfirm(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Heure de l’établissement</p>
              <p className="text-2xl font-extrabold font-heading text-slate-900">{now}</p>
            </div>

            {confirm.status === 'locating' && (
              <p className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <MapPin className="w-4 h-4 shrink-0 text-amber-600 animate-pulse" />
                <span>
                  Vérification de votre position… Si le téléphone le demande, appuyez sur <span className="font-bold">« Autoriser »</span> la localisation (GPS).
                </span>
              </p>
            )}

            {confirm.status === 'error' && (
              <div className="space-y-2">
                <p className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">{confirm.error}</p>
                <button
                  type="button"
                  onClick={() => locate(confirm.action)}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 cursor-pointer"
                >
                  Réessayer la position
                </button>
              </div>
            )}

            {confirm.status === 'ready' && (
              <>
                {data.config.location ? (
                  (() => {
                    const d = confirm.distance ?? 0;
                    const acc = confirm.pos?.accuracy ?? 0;
                    const max = data.config.radiusMeters;
                    const okDist = d <= max + Math.min(acc, 100) && acc <= 300;
                    return (
                      <p
                        className={`p-3 rounded-xl border text-xs font-semibold flex items-start gap-2 ${
                          okDist ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'
                        }`}
                      >
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span>
                          {acc > 300
                            ? `Position trop imprécise (± ${Math.round(acc)} m). Activez le GPS « position précise », sortez dans la cour puis réessayez.`
                            : okDist
                            ? `Vous êtes à ${d} m de l’école (maximum ${max} m) : position validée.`
                            : `Vous êtes à ${d} m de l’école (maximum ${max} m) : trop loin pour pointer.`}
                        </span>
                      </p>
                    );
                  })()
                ) : (
                  <p className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                    La Direction n’a pas encore enregistré la position de l’école : aucune distance n’est vérifiée.
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => locate(confirm.action)}
                    disabled={!!busy}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer disabled:opacity-50"
                  >
                    Actualiser
                  </button>
                  <button
                    type="button"
                    onClick={confirmPunch}
                    disabled={!!busy}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                  >
                    {busy ? 'Enregistrement…' : `Valider à ${now}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ================= MOTIF SAISI PAR LA DIRECTION ================= */}
      {justifyFor && (
        <div className="fixed inset-0 z-[120] bg-slate-950/50 flex items-center justify-center p-4" onClick={() => setJustifyFor(null)}>
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 font-heading">Motif d’absence</h3>
                <p className="text-xs text-slate-500">
                  {justifyFor.fullName} • {frDate(data.date)}
                </p>
              </div>
              <button type="button" onClick={() => setJustifyFor(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={justifyReason}
              onChange={(e) => setJustifyReason(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="Motif (laisser vide pour retirer le motif)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
            />
            <button
              type="button"
              disabled={!!busy}
              onClick={() =>
                run(
                  'justify',
                  () => post({ action: 'justify', staffId: justifyFor.id, date: data.date, reason: justifyReason }),
                  'Motif enregistré.'
                ).then((ok) => ok && setJustifyFor(null))
              }
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold cursor-pointer"
            >
              {busy === 'justify' ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const ROLE_LABELS_SHORT: Record<string, string> = {
  enseignant: 'Enseignant(e)',
  educateur: 'Éducateur',
  directeur: 'Directeur',
  comptable: 'Comptable',
  secretaire: 'Secrétaire',
  assistant: 'Assistant(e)',
  informaticien: 'Informaticien',
};

function ConfigCard({
  draft,
  setDraft,
  saved,
  clock,
  busy,
  onSave,
  onLocationSaved,
}: {
  draft: PointageConfig;
  setDraft: (c: PointageConfig) => void;
  saved: PointageConfig;
  clock: { date: string; time: string };
  busy: string;
  onSave: (c: Partial<PointageConfig>) => void;
  onLocationSaved: (c: PointageConfig) => void;
}) {
  const time = (field: 'arrivalStart' | 'arrivalEnd' | 'departureStart' | 'departureEnd', label: string) => (
    <div className="space-y-1">
      <span className="font-bold text-slate-700 block text-xs">{label}</span>
      <TimePicker value={draft[field]} onChange={(v) => setDraft({ ...draft, [field]: v })} />
    </div>
  );

  const arrivalNow = phaseState(saved, clock, 'arrival');
  const departureNow = phaseState(saved, clock, 'departure');
  const anyOpen = arrivalNow.open || departureNow.open;

  const dirty =
    (['arrivalStart', 'arrivalEnd', 'departureStart', 'departureEnd'] as const).some((f) => draft[f] !== saved[f]) ||
    [...draft.workDays].sort().join(',') !== [...saved.workDays].sort().join(',');

  return (
    <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
      {dirty && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 font-semibold flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            Modifications NON enregistrées : le personnel voit encore les anciens horaires / jours. Cliquez sur « Enregistrer les horaires » en bas de ce cadre.
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base font-extrabold text-slate-900 font-heading">Réglages du pointage (Direction)</h2>
        </div>
        <button
          type="button"
          onClick={() => {
            // Le bouton reflète l'état RÉEL à cet instant (ouvert ou fermé), pas un simple réglage :
            // - ouvert (rouge)  → « Désactiver » ferme tout de suite ce qui est ouvert ;
            // - fermé (vert)    → « Activer » enregistre les horaires affichés, remet le mode
            //   automatique et ouvre tout de suite (arrivée avant la plage de départ, sinon départ).
            if (anyOpen) {
              onSave({
                ...(arrivalNow.open ? { arrivalForce: 'closed' } : {}),
                ...(departureNow.open ? { departureForce: 'closed' } : {}),
              } as any);
            } else {
              const phase = clock.time < draft.departureStart ? 'arrivalForce' : 'departureForce';
              setDraft({ ...draft, enabled: true });
              onSave({
                enabled: true,
                arrivalStart: draft.arrivalStart,
                arrivalEnd: draft.arrivalEnd,
                departureStart: draft.departureStart,
                departureEnd: draft.departureEnd,
                workDays: draft.workDays,
                [phase]: 'open',
              } as any);
            }
          }}
          disabled={!!busy}
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50 ${
            anyOpen ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          {anyOpen ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {anyOpen ? 'Désactiver le pointage' : 'Activer le pointage'}
        </button>
      </div>
      <p className="text-[11px] text-slate-500">
        {anyOpen
          ? 'Pointage OUVERT. Il se ferme tout seul à l’heure de fin de la plage (ou cliquez sur « Désactiver »).'
          : saved.enabled
          ? 'Pointage FERMÉ pour le moment : il s’ouvrira tout seul à l’heure de début de la prochaine plage, les jours cochés.'
          : 'Pointage non activé : cliquez sur « Activer » une fois, puis il s’ouvre et se ferme tout seul chaque jour aux heures réglées.'}
      </p>

      {/* Forçage manuel : ouvrir plus tôt ou fermer tout de suite (valable aujourd'hui seulement) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(['arrival', 'departure'] as const).map((phase) => {
          const st = phaseState(saved, clock, phase);
          const key = phase === 'arrival' ? 'arrivalForce' : 'departureForce';
          const start = phase === 'arrival' ? saved.arrivalStart : saved.departureStart;
          const end = phase === 'arrival' ? saved.arrivalEnd : saved.departureEnd;
          return (
            <div key={phase} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-extrabold text-slate-900">{phase === 'arrival' ? 'Pointage d’arrivée' : 'Pointage de départ'}</p>
                  <p className="text-[11px] text-slate-500">
                    {start} – {end} • {st.forced ? 'forcé à la main' : 'automatique'}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${
                    st.open ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-slate-100 text-slate-600 border-slate-300'
                  }`}
                >
                  {st.open ? 'OUVERT' : 'FERMÉ'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {!st.open && (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => onSave({ [key]: 'open' } as any)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                  >
                    Ouvrir maintenant
                  </button>
                )}
                {st.open && (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => onSave({ [key]: 'closed' } as any)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                  >
                    Fermer maintenant
                  </button>
                )}
                {st.forced && (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => onSave({ [key]: 'auto' } as any)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                  >
                    Remettre en automatique
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {time('arrivalStart', 'Arrivée : début')}
        {time('arrivalEnd', 'Arrivée : fin')}
        {time('departureStart', 'Départ : début')}
        {time('departureEnd', 'Départ : fin')}
      </div>
      <p className="text-[11px] text-slate-500">
        Passé l’heure de fin, le pointage se bloque : la personne est comptée absente, sauf motif.
      </p>

      <div className="space-y-1.5">
        <span className="font-bold text-slate-700 block text-xs">Jours de pointage</span>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const on = draft.workDays.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() =>
                  setDraft({ ...draft, workDays: on ? draft.workDays.filter((x) => x !== d) : [...draft.workDays, d] })
                }
                className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${
                  on ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {WEEKDAY_LABELS[d]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100">
        <SchoolLocationCard embedded config={saved} onSaved={onLocationSaved} />
      </div>

      <button
        type="button"
        disabled={!!busy}
        onClick={() =>
          onSave({
            arrivalStart: draft.arrivalStart,
            arrivalEnd: draft.arrivalEnd,
            departureStart: draft.departureStart,
            departureEnd: draft.departureEnd,
            workDays: draft.workDays,
          })
        }
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-sm shadow-emerald-600/30 disabled:opacity-50 cursor-pointer"
      >
        <Save className="w-4 h-4" />
        {busy === 'config' ? 'Enregistrement…' : 'Enregistrer les horaires'}
      </button>
    </div>
  );
}
