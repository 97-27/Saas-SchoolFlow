'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Users,
  Wallet,
  Clock,
  RefreshCw,
  LogOut,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils/formatters';
import { tierById, exceedsTier } from '@/lib/data/subscription-tiers';
import type { PlatformSchoolRow, PaymentEvent } from '@/lib/supabase/services';

const PLAN_LABEL: Record<string, string> = { mensuel: 'Mensuel', annuel: '1 an', triennal: '3 ans' };
const PLAN_PRICE: Record<string, number> = { mensuel: 30000, annuel: 250000, triennal: 750000 };
const METHOD_LABEL: Record<string, string> = { wave: 'Wave', orange: 'Orange Money', card: 'Carte bancaire', code: 'Code d’activation', autre: 'Autre', virement: 'Virement', especes: 'Espèces' };

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};
const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const ago = (iso?: string | null) => {
  if (!iso) return 'jamais';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return 'à l’instant';
  if (mins < 60) return `il y a ${mins} min`;
  if (mins < 60 * 24) return `il y a ${Math.floor(mins / 60)} h`;
  return `il y a ${Math.floor(mins / 1440)} j`;
};

type Overview = { schools: PlatformSchoolRow[]; generatedAt: string };
type Toast = { type: 'ok' | 'err'; text: string } | null;

export function PlatformDashboard() {
  const [phase, setPhase] = useState<'checking' | 'login' | 'ready'>('checking');
  const [code, setCode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Overview | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [payFor, setPayFor] = useState<PlatformSchoolRow | null>(null);

  const showToast = (t: Toast) => {
    setToast(t);
    window.setTimeout(() => setToast(null), 4500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/platform/overview', { cache: 'no-store' });
      if (res.status === 401) {
        setPhase('login');
        return;
      }
      const json = await res.json();
      if (json?.success) {
        setData({ schools: json.schools, generatedAt: json.generatedAt });
        setPhase('ready');
      }
    } catch (e) {
      showToast({ type: 'err', text: 'Impossible de charger les données.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Actualisation automatique toutes les 60 s tant que l'écran est ouvert.
  useEffect(() => {
    if (phase !== 'ready') return;
    const id = window.setInterval(load, 60000);
    return () => window.clearInterval(id);
  }, [phase, load]);

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    try {
      const res = await fetch('/api/platform/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setLoginError(json?.error || 'Connexion impossible.');
        return;
      }
      setCode('');
      await load();
    } catch (err) {
      setLoginError('Serveur injoignable.');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await fetch('/api/platform/logout', { method: 'POST' }).catch(() => {});
    setData(null);
    setPhase('login');
  };

  const schools = data?.schools || [];

  const stats = useMemo(() => {
    const now = new Date();
    const events = schools.flatMap((s) => s.payments.map((p) => ({ ...p, school: s })));
    const confirmed = events.filter((p) => p.status === 'confirme');
    const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
    const inMonth = (p: PaymentEvent) => {
      const d = new Date(p.at);
      return `${d.getFullYear()}-${d.getMonth()}` === monthKey;
    };
    const pending = events.filter((p) => p.status === 'en_attente' && !confirmed.some((c) => c.school.slug === p.school.slug && c.kind === 'inscription'));
    // Revenus des 6 derniers mois
    const months: { label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const total = confirmed
        .filter((p) => {
          const pd = new Date(p.at);
          return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth();
        })
        .reduce((s, p) => s + p.amount, 0);
      months.push({ label: d.toLocaleDateString('fr-FR', { month: 'short' }), total });
    }
    return {
      schools: schools.length,
      active: schools.filter((s) => !s.isExpired && s.status === 'active').length,
      expired: schools.filter((s) => s.isExpired).length,
      students: schools.reduce((s, x) => s + x.studentCount, 0),
      collectedAll: confirmed.reduce((s, p) => s + p.amount, 0),
      collectedMonth: confirmed.filter(inMonth).reduce((s, p) => s + p.amount, 0),
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, p) => s + p.amount, 0),
      feed: [...events].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12),
      months,
      maxMonth: Math.max(1, ...months.map((m) => m.total)),
      online: schools.filter((s) => s.lastActivityAt && Date.now() - new Date(s.lastActivityAt).getTime() < 15 * 60000).length,
    };
  }, [schools]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter((s) => [s.name, s.shortName, s.slug, s.city, s.directorName, s.phone, s.email].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [schools, query]);

  // ─────────────────────────── Écran de connexion
  if (phase !== 'ready') {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <form onSubmit={submitLogin} className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-base leading-tight">Espace plateforme</h1>
              <p className="text-xs text-slate-400">SchoolFlow — accès propriétaire</p>
            </div>
          </div>
          {phase === 'checking' ? (
            <p className="text-sm text-slate-400">Vérification de la session…</p>
          ) : (
            <>
              <label className="block text-xs font-bold text-slate-300">
                Code d&apos;accès
                <div className="relative mt-1.5">
                  <KeyRound className="w-4 h-4 text-emerald-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    autoFocus
                    autoComplete="off"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-emerald-500 outline-none text-sm font-mono"
                    placeholder="••••••••"
                  />
                </div>
              </label>
              {loginError && <p className="text-xs text-red-300 bg-red-950/50 border border-red-900 rounded-xl p-2.5">{loginError}</p>}
              <button
                type="submit"
                disabled={loading || code.trim().length < 4}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-extrabold text-sm cursor-pointer"
              >
                {loading ? 'Connexion…' : 'Entrer'}
              </button>
            </>
          )}
        </form>
      </main>
    );
  }

  // ─────────────────────────── Tableau de bord
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-slate-950 text-white px-4 sm:px-6 py-3 flex items-center justify-between gap-3 sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-sm sm:text-base leading-tight truncate">SchoolFlow — Tableau de bord plateforme</h1>
            <p className="text-[11px] text-slate-400 truncate">Mis à jour {data ? fmtDateTime(data.generatedAt) : '…'} • actualisation auto 60 s</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={load} disabled={loading} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 cursor-pointer" title="Actualiser">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={logout} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 cursor-pointer" title="Se déconnecter">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Indicateurs */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi icon={<Building2 className="w-4 h-4" />} label="Écoles" value={String(stats.schools)} sub={`${stats.active} actives • ${stats.expired} expirées • ${stats.online} en ligne`} tone="emerald" />
          <Kpi icon={<Users className="w-4 h-4" />} label="Élèves au total" value={stats.students.toLocaleString('fr-FR')} sub="toutes écoles confondues" tone="sky" />
          <Kpi icon={<Wallet className="w-4 h-4" />} label="Encaissé ce mois" value={formatFCFA(stats.collectedMonth)} sub={`Total cumulé : ${formatFCFA(stats.collectedAll)}`} tone="amber" />
          <Kpi icon={<Clock className="w-4 h-4" />} label="Règlements en attente" value={String(stats.pendingCount)} sub={`${formatFCFA(stats.pendingAmount)} à confirmer`} tone={stats.pendingCount ? 'rose' : 'slate'} />
        </section>

        <div className="grid lg:grid-cols-3 gap-5">
          {/* Revenus par mois */}
          <section className="lg:col-span-1 rounded-2xl bg-white border border-slate-200 p-4">
            <h2 className="font-extrabold text-sm mb-3">Encaissements — 6 derniers mois</h2>
            <div className="flex items-end gap-2 h-36">
              {stats.months.map((m) => (
                <div key={m.label + m.total} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                  <span className="text-[9px] font-bold text-slate-500">{m.total ? Math.round(m.total / 1000) + ' k' : ''}</span>
                  <div className="w-full rounded-t-lg bg-emerald-500" style={{ height: `${Math.max(3, (m.total / stats.maxMonth) * 100)}%`, opacity: m.total ? 1 : 0.25 }} />
                  <span className="text-[10px] text-slate-500 capitalize">{m.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Derniers paiements */}
          <section className="lg:col-span-2 rounded-2xl bg-white border border-slate-200 p-4">
            <h2 className="font-extrabold text-sm mb-3">Derniers paiements (date et heure)</h2>
            {stats.feed.length === 0 ? (
              <p className="text-xs text-slate-500">Aucun paiement enregistré pour l’instant.</p>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {stats.feed.map((p, i) => (
                  <li key={p.school.slug + p.at + i} className="py-2 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-bold truncate">{p.school.name}</p>
                      <p className="text-slate-500">
                        {fmtDateTime(p.at)} • {METHOD_LABEL[p.method] || p.method} • {PLAN_LABEL[p.plan] || p.plan} • {p.kind}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-extrabold">{formatFCFA(p.amount)}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.status === 'confirme' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {p.status === 'confirme' ? 'Confirmé' : 'À confirmer'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Liste des écoles */}
        <section className="rounded-2xl bg-white border border-slate-200">
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100">
            <h2 className="font-extrabold text-sm">Écoles abonnées ({filtered.length})</h2>
            <div className="relative sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher une école, ville, directeur…"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>
          </div>
          {filtered.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">Aucune école.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((s) => {
                const isOpen = open === s.slug;
                const tier = tierById(s.studentTier);
                const over = exceedsTier(s.studentCount, s.studentTier);
                const statusBadge = s.isExpired
                  ? { t: 'Expiré', c: 'bg-red-100 text-red-800' }
                  : s.daysRemaining !== null && s.daysRemaining <= 15
                    ? { t: `Expire dans ${s.daysRemaining} j`, c: 'bg-amber-100 text-amber-800' }
                    : { t: 'Actif', c: 'bg-emerald-100 text-emerald-800' };
                return (
                  <li key={s.slug}>
                    <button onClick={() => setOpen(isOpen ? null : s.slug)} className="w-full text-left p-4 hover:bg-slate-50 cursor-pointer">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-extrabold text-sm truncate">{s.name}</p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {s.city || '—'} • {s.directorName || '—'} • {s.phone || '—'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg ${statusBadge.c}`}>{statusBadge.t}</span>
                          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                        <Cell k="Forfait" v={`${PLAN_LABEL[s.plan] || s.plan} • ${formatFCFA(s.planPrice)}`} />
                        <Cell k="Élèves" v={`${s.studentCount.toLocaleString('fr-FR')}${tier ? ` / ${tier.label}` : ''}`} warn={over} />
                        <Cell k="Payé" v={formatFCFA(s.totalPaid)} />
                        <Cell k="Échéance" v={fmtDate(s.endDate)} />
                        <Cell k="Dernière activité" v={ago(s.lastActivityAt)} />
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 grid md:grid-cols-3 gap-4 text-xs bg-slate-50/60">
                        <div className="space-y-1.5">
                          <h3 className="font-extrabold text-[11px] uppercase text-slate-500">Établissement</h3>
                          <Line k="Lien" v={`/${s.slug}`} />
                          <Line k="Email" v={s.email || '—'} />
                          <Line k="Fondateur" v={s.founderName || '—'} />
                          <Line k="Année scolaire" v={s.academicYear || '—'} />
                          <Line k="Créée le" v={fmtDateTime(s.createdAt)} />
                          <Line k="Personnel" v={String(s.staffCount)} />
                          {over && (
                            <p className="flex items-center gap-1.5 text-amber-800 bg-amber-100 rounded-lg p-2 font-bold">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> L’effectif dépasse la tranche souscrite.
                            </p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <h3 className="font-extrabold text-[11px] uppercase text-slate-500">Services utilisés (élèves inscrits)</h3>
                          <Line k="Cantine" v={s.services.canteen ? `${s.services.canteen} élèves` : 'Non utilisée'} />
                          <Line k="Transport" v={s.services.transport ? `${s.services.transport} élèves` : 'Non utilisé'} />
                          <Line k="Internat" v={s.services.boarding ? `${s.services.boarding} élèves` : 'Non utilisé'} />
                          <h3 className="font-extrabold text-[11px] uppercase text-slate-500 pt-2">Règlement choisi</h3>
                          <Line k="Moyen" v={s.signup?.paymentMethod ? METHOD_LABEL[s.signup.paymentMethod] || s.signup.paymentMethod : '—'} />
                          <Line k="Numéro" v={s.signup?.paymentPhone || '—'} />
                          <Line k="Code d’activation" v={s.signup?.activationCodeGiven ? 'Saisi par l’école' : 'Non'} />
                        </div>
                        <div className="space-y-2">
                          <h3 className="font-extrabold text-[11px] uppercase text-slate-500">Paiements</h3>
                          {s.payments.length === 0 ? (
                            <p className="text-slate-500">Aucun paiement enregistré.</p>
                          ) : (
                            <ul className="space-y-1 max-h-36 overflow-y-auto">
                              {[...s.payments].reverse().map((p, i) => (
                                <li key={p.at + i} className="flex justify-between gap-2 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
                                  <span>
                                    {fmtDateTime(p.at)}
                                    <span className="block text-[10px] text-slate-500">
                                      {METHOD_LABEL[p.method] || p.method} • {PLAN_LABEL[p.plan] || p.plan} • {p.status === 'confirme' ? 'confirmé' : 'à confirmer'}
                                    </span>
                                  </span>
                                  <b>{formatFCFA(p.amount)}</b>
                                </li>
                              ))}
                            </ul>
                          )}
                          <button
                            onClick={() => setPayFor(s)}
                            className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs cursor-pointer"
                          >
                            Confirmer un paiement / renouveler
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {payFor && (
        <PayModal
          school={payFor}
          onClose={() => setPayFor(null)}
          onDone={(msg) => {
            setPayFor(null);
            showToast({ type: 'ok', text: msg });
            load();
          }}
          onError={(msg) => showToast({ type: 'err', text: msg })}
        />
      )}

      {toast && (
        <div
          role="status"
          className={`fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm z-[100] shadow-2xl rounded-2xl p-3.5 flex items-start gap-2.5 text-white text-sm font-bold ${toast.type === 'ok' ? 'bg-emerald-600' : 'bg-red-600'}`}
        >
          {toast.type === 'ok' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <span className="min-w-0">{toast.text}</span>
        </div>
      )}
    </main>
  );
}

function Kpi({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub: string; tone: 'emerald' | 'sky' | 'amber' | 'rose' | 'slate' }) {
  const tones: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-700',
    sky: 'bg-sky-100 text-sky-700',
    amber: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-3.5">
      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${tones[tone]}`}>{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-xl font-extrabold tracking-tight truncate">{value}</p>
      <p className="text-[11px] text-slate-500 truncate">{sub}</p>
    </div>
  );
}

function Cell({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg px-2 py-1.5 ${warn ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}`}>
      <span className="block text-[9px] uppercase font-bold text-slate-400">{k}</span>
      <span className="font-bold text-slate-800 break-words">{v}</span>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <p className="flex justify-between gap-2">
      <span className="text-slate-500">{k}</span>
      <span className="font-bold text-right break-all">{v}</span>
    </p>
  );
}

function PayModal({ school, onClose, onDone, onError }: { school: PlatformSchoolRow; onClose: () => void; onDone: (msg: string) => void; onError: (msg: string) => void }) {
  const hasPending = school.payments.some((p) => p.status === 'en_attente' && p.kind === 'inscription') && !school.payments.some((p) => p.status === 'confirme' && p.kind === 'inscription');
  const [kind, setKind] = useState<'inscription' | 'renouvellement'>(hasPending ? 'inscription' : 'renouvellement');
  const [plan, setPlan] = useState(school.plan in PLAN_PRICE ? school.plan : 'annuel');
  const [amount, setAmount] = useState(String(PLAN_PRICE[plan] || 250000));
  const [method, setMethod] = useState('wave');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/platform/overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: school.slug, plan, amount: Number(amount), method, kind, note }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        onError(json?.error || 'Enregistrement impossible.');
        return;
      }
      onDone(kind === 'renouvellement' ? `Abonnement prolongé jusqu’au ${fmtDate(json.newEndDate)}.` : 'Paiement confirmé.');
    } catch (err) {
      onError('Serveur injoignable.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-3xl p-5 space-y-3 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-base">Confirmer un paiement</h3>
            <p className="text-xs text-slate-500">{school.name}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer" aria-label="Fermer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-bold">
          <button type="button" onClick={() => setKind('inscription')} className={`py-2 rounded-xl border cursor-pointer ${kind === 'inscription' ? 'bg-emerald-50 border-emerald-500 text-emerald-900' : 'border-slate-200 text-slate-600'}`}>
            Règlement d’inscription
          </button>
          <button type="button" onClick={() => setKind('renouvellement')} className={`py-2 rounded-xl border cursor-pointer ${kind === 'renouvellement' ? 'bg-emerald-50 border-emerald-500 text-emerald-900' : 'border-slate-200 text-slate-600'}`}>
            Renouvellement (+ durée)
          </button>
        </div>

        <label className="block text-xs font-bold">
          Forfait
          <select
            value={plan}
            onChange={(e) => {
              setPlan(e.target.value);
              setAmount(String(PLAN_PRICE[e.target.value] || ''));
            }}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            {Object.keys(PLAN_PRICE).map((k) => (
              <option key={k} value={k}>
                {PLAN_LABEL[k]} — {formatFCFA(PLAN_PRICE[k])}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-bold">
          Montant reçu (FCFA)
          <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </label>
        <label className="block text-xs font-bold">
          Moyen de règlement
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
            {['wave', 'orange', 'card', 'virement', 'especes', 'code'].map((m) => (
              <option key={m} value={m}>
                {METHOD_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-bold">
          Note (facultatif)
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Réf. transaction…" />
        </label>

        <button type="submit" disabled={busy || !Number(amount)} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-sm cursor-pointer">
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
    </div>
  );
}
