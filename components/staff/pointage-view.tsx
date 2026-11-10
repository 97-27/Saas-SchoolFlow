'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  PointageConfig,
  PointageRecord,
  PointageStatus,
  STATUS_LABELS,
  WEEKDAY_LABELS,
  dayStatus,
  departureLabel,
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
  config: PointageConfig;
  me: PointageRecord | null;
  myStatus: PointageStatus;
  canManage: boolean;
  canViewAll: boolean;
  exempt: boolean;
  roster: Member[];
  records: Record<string, PointageRecord>;
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
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? 'Localisation refusée : autorisez-la pour ce site dans le navigateur, puis réessayez.'
              : 'Position introuvable. Activez le GPS (localisation) du téléphone et réessayez.'
          )
        ),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
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

  const load = useCallback(
    async (d?: string) => {
      try {
        const q = d ? `?date=${encodeURIComponent(d)}` : '';
        const res = await fetch(`/api/pointage${q}`, { cache: 'no-store' });
        const j = await res.json().catch(() => null);
        if (!res.ok || !j?.success) throw new Error(j?.error || 'Lecture impossible.');
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
    // L'heure et les pointages des collègues se mettent à jour toutes les 30 s.
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') load(date || undefined);
    }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, date, schoolSlug]);

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

  const punch = (action: 'arrive' | 'depart') =>
    run(
      action,
      async () => {
        let pos: { lat: number; lng: number; accuracy: number } | null = null;
        try {
          pos = await getPosition();
        } catch (e) {
          // Sans position enregistrée pour l'école, le serveur accepte quand même.
          if (data?.config.location) throw e;
        }
        return post({ action, ...(pos || {}) });
      },
      action === 'arrive' ? 'Arrivée pointée. Bonne journée !' : 'Départ pointé. À demain !'
    );

  const today = data?.today || '';
  const isToday = !!data && data.date === data.today;
  const cfg = data?.config;
  const now = data?.now || '';
  const arrivalOpen = !!cfg && cfg.enabled && now >= cfg.arrivalStart && now <= cfg.arrivalEnd;
  const departureOpen = !!cfg && cfg.enabled && now >= cfg.departureStart && now <= cfg.departureEnd;
  const workDay = !!cfg && cfg.workDays.includes(data?.weekday ?? -1);

  const rows = useMemo(() => {
    if (!data) return [];
    const clock = { date: data.today, time: data.now };
    return data.roster.map((m) => {
      const rec = data.records[m.id] || null;
      return { member: m, rec, status: dayStatus(rec, data.config, data.date, clock) };
    });
  }, [data]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, absent_justifie: 0, en_attente: 0 };
    for (const r of rows) {
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
          <span className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-white">
            Arrivée {cfg!.arrivalStart} – {cfg!.arrivalEnd}
          </span>
          <span className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
            Départ {cfg!.departureStart} – {cfg!.departureEnd}
          </span>
        </div>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-start gap-2 ${
            message.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {message.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {!cfg!.enabled && (
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

          {cfg!.enabled && workDay && (
            <div className="flex flex-col sm:flex-row gap-2.5">
              {!data.me?.arrival && (
                <button
                  type="button"
                  onClick={() => punch('arrive')}
                  disabled={!arrivalOpen || !!busy}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-sm shadow-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  {busy === 'arrive'
                    ? 'Localisation…'
                    : arrivalOpen
                    ? 'Pointer mon arrivée'
                    : now < cfg!.arrivalStart
                    ? `Ouvre à ${cfg!.arrivalStart}`
                    : `Fermé depuis ${cfg!.arrivalEnd}`}
                </button>
              )}
              {data.me?.arrival && !data.me?.departure && (
                <button
                  type="button"
                  onClick={() => punch('depart')}
                  disabled={!departureOpen || !!busy}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  {busy === 'depart'
                    ? 'Localisation…'
                    : departureOpen
                    ? 'Pointer mon départ'
                    : now < cfg!.departureStart
                    ? `Départ à partir de ${cfg!.departureStart}`
                    : `Fermé depuis ${cfg!.departureEnd}`}
                </button>
              )}
              {!data.me?.arrival && (
                <button
                  type="button"
                  onClick={() => {
                    setAbsenceReason(data.me?.absence?.reason || '');
                    setShowAbsence((v) => !v);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-amber-900 bg-amber-50 border border-amber-300 hover:bg-amber-100 cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  {data.me?.absence ? 'Modifier le motif' : 'Je suis absent(e) : motif'}
                </button>
              )}
            </div>
          )}
          {cfg!.enabled && !workDay && <p className="text-xs text-slate-500">Pas de pointage aujourd’hui (jour non travaillé).</p>}

          {showAbsence && !data.me?.arrival && (
            <div className="space-y-2">
              <textarea
                value={absenceReason}
                onChange={(e) => setAbsenceReason(e.target.value)}
                rows={3}
                maxLength={300}
                placeholder="Ex : malade (certificat médical), décès dans la famille, convocation officielle…"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
              />
              <button
                type="button"
                disabled={!!busy || absenceReason.trim().length < 3}
                onClick={() =>
                  run('absence', () => post({ action: 'absence', reason: absenceReason }), 'Motif d’absence enregistré.').then((ok) =>
                    ok && setShowAbsence(false)
                  )
                }
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                {busy === 'absence' ? 'Enregistrement…' : 'Enregistrer le motif'}
              </button>
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

      {/* ================= RÉGLAGES (Direction) ================= */}
      {data.canManage && draft && (
        <ConfigCard
          draft={draft}
          setDraft={setDraft}
          saved={data.config}
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
              { label: 'Absents', value: counts.absent, cls: 'text-rose-600' },
              { label: 'Absents (motif)', value: counts.absent_justifie, cls: 'text-amber-700' },
              { label: 'Pas encore pointé', value: counts.en_attente, cls: 'text-slate-700' },
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

function ConfigCard({
  draft,
  setDraft,
  saved,
  busy,
  onSave,
  onLocationSaved,
}: {
  draft: PointageConfig;
  setDraft: (c: PointageConfig) => void;
  saved: PointageConfig;
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

  return (
    <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base font-extrabold text-slate-900 font-heading">Réglages du pointage (Direction)</h2>
        </div>
        <button
          type="button"
          onClick={() => {
            const next = { ...draft, enabled: !draft.enabled };
            setDraft(next);
            onSave({ enabled: next.enabled });
          }}
          disabled={!!busy}
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50 ${
            saved.enabled ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          {saved.enabled ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {saved.enabled ? 'Désactiver le pointage' : 'Activer le pointage'}
        </button>
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
