'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Database,
  FolderOpen,
  KeyRound,
  Loader2,
  Lock,
  Printer,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Users,
  Wallet,
  Receipt,
  UserX,
  MessageSquare,
  XCircle,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils/formatters';
import { syncYearEpoch, wipeLocalSchoolData } from '@/lib/client/year-reset';

/**
 * ARCHIVES DES ANNÉES SCOLAIRES
 * Copies figées et complètes des données de l'école, enregistrées dans Supabase (table
 * school_archives) : l'école peut revoir n'importe quelle année, même 10 ans plus tard.
 * Fondateur / DGA : accès direct. Comptable : code des chiffres demandé à chaque ouverture
 * (jamais gardé dans le navigateur). Tous les autres postes : page inaccessible.
 */

type Summary = {
  students: number;
  invoicesTotal: number;
  paidTotal: number;
  balanceTotal: number;
  staff: number;
  salariesCount: number;
  salariesTotal: number;
  expensesCount: number;
  expensesTotal: number;
  absences: number;
  lates: number;
  parentsNotified: number;
  pointageDays: number;
  parentMessages: number;
  validatedBulletins: number;
};

type ArchiveRow = {
  id: string;
  academic_year: string;
  kind: 'cloture' | 'manuel' | 'auto';
  label: string;
  created_at: string;
  created_by: string;
  summary: Summary | null;
  size_bytes: number | null;
};

type Section = 'resume' | 'eleves' | 'salaires' | 'depenses' | 'presences' | 'pointage' | 'messages';

const SECTIONS: { id: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'resume', label: 'Résumé', icon: Database },
  { id: 'eleves', label: 'Élèves & paiements', icon: Users },
  { id: 'salaires', label: 'Salaires', icon: Wallet },
  { id: 'depenses', label: 'Dépenses', icon: Receipt },
  { id: 'presences', label: 'Absences & retards', icon: UserX },
  { id: 'pointage', label: 'Pointage personnel', icon: Clock },
  { id: 'messages', label: 'Messages parents', icon: MessageSquare },
];

const KIND_BADGE: Record<ArchiveRow['kind'], { label: string; cls: string }> = {
  cloture: { label: 'Clôture d’année', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  manuel: { label: 'Sauvegarde manuelle', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  auto: { label: 'Automatique', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
};

const frDateTime = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso || '—';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const frDay = (v: string) => {
  if (!v) return '—';
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const [y, m, d] = v.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  return v;
};
const sizeLabel = (n: number | null) => (!n ? '' : n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1000))} Ko`);

export function ArchivesView({ schoolSlug }: { schoolSlug: string }) {
  const [code, setCode] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [needCode, setNeedCode] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [archives, setArchives] = useState<ArchiveRow[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [creating, setCreating] = useState<'' | 'manuel' | 'cloture'>('');
  const [confirmCloture, setConfirmCloture] = useState(false);
  const [open, setOpen] = useState<ArchiveRow | null>(null);
  const [academicYear, setAcademicYear] = useState('');
  const [showNewYear, setShowNewYear] = useState(false);

  const headers = useCallback(
    (extra: Record<string, string> = {}) => ({ ...(code ? { 'x-figures-code': code } : {}), ...extra }),
    [code]
  );

  const load = useCallback(
    async (withCode = code) => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/archives?t=${Date.now()}`, {
          cache: 'no-store',
          headers: withCode ? { 'x-figures-code': withCode } : {},
        });
        const json = await res.json().catch(() => null);
        if (json?.needCode) {
          setNeedCode(true);
          setCode('');
          if (json.lockedUntil) setLockedUntil(json.lockedUntil);
          // Première ouverture sans code : pas de message d'erreur, juste la demande de code.
          if (withCode) setError(json.error || 'Code incorrect.');
          return;
        }
        if (!res.ok || !json?.success) {
          setError(json?.error || 'Lecture des archives impossible pour le moment.');
          return;
        }
        setNeedCode(false);
        setArchives(json.archives || []);
        setCanCreate(!!json.canCreate);
        setAcademicYear(String(json.academicYear || ''));
        if (json.autoCreated) setNotice({ type: 'ok', text: 'Sauvegarde automatique de la semaine enregistrée dans Supabase.' });
      } catch (e) {
        setError('Connexion impossible. Vérifiez Internet puis réessayez.');
      } finally {
        setLoading(false);
      }
    },
    [code]
  );

  useEffect(() => {
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = codeInput.trim();
    if (!c) return;
    setCode(c);
    setCodeInput('');
    await load(c);
  };

  const create = async (kind: 'manuel' | 'cloture') => {
    setCreating(kind);
    setNotice(null);
    try {
      const res = await fetch('/api/archives', {
        method: 'POST',
        headers: headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ kind }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setNotice({ type: 'err', text: json?.error || 'Archive non créée. Réessayez.' });
      } else {
        setNotice({
          type: 'ok',
          text:
            kind === 'cloture'
              ? `✅ Année ${json.archive?.academic_year || ''} clôturée et archivée dans Supabase. Elle restera consultable à tout moment.`
              : '✅ Sauvegarde complète enregistrée dans Supabase.',
        });
        await load();
      }
    } catch {
      setNotice({ type: 'err', text: 'Connexion impossible. Réessayez.' });
    } finally {
      setCreating('');
      setConfirmCloture(false);
    }
  };

  const byYear = useMemo(() => {
    const groups = new Map<string, ArchiveRow[]>();
    for (const a of archives) {
      const y = a.academic_year || '—';
      if (!groups.has(y)) groups.set(y, []);
      groups.get(y)!.push(a);
    }
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [archives]);

  const currentYear = academicYear || archives[0]?.academic_year || '';

  if (open) {
    return <ArchiveViewer archive={open} headers={headers} onBack={() => setOpen(null)} onCodeLost={() => { setOpen(null); setCode(''); setNeedCode(true); }} />;
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs shrink-0">
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-slate-900 tracking-tight font-heading">Archives des années scolaires</h1>
            <p className="text-xs text-slate-500">Toutes les données de chaque année, gardées dans Supabase et consultables à tout moment.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-bold">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 text-white">
            <ShieldCheck className="w-3.5 h-3.5" /> Fondateur & DGA
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
            <KeyRound className="w-3.5 h-3.5" /> Comptable : avec code
          </span>
        </div>
      </div>

      {notice && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-start gap-2 ${
            notice.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {notice.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Code du Comptable */}
      {needCode ? (
        <form onSubmit={submitCode} className="max-w-md mx-auto bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-extrabold text-slate-900 font-heading">Archives protégées</h2>
            <p className="text-xs text-slate-500">Saisissez le code des chiffres (6 chiffres) remis par le Fondateur ou le DGA.</p>
          </div>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={12}
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="••••••"
            disabled={lockedUntil > Date.now()}
            className="w-full text-center tracking-[0.5em] text-lg font-bold px-4 py-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:border-emerald-600 disabled:bg-slate-100"
          />
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          {lockedUntil > Date.now() && (
            <p className="text-xs font-semibold text-amber-700">
              Saisie bloquée jusqu’à {new Date(lockedUntil).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !codeInput.trim() || lockedUntil > Date.now()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-sm shadow-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
            Ouvrir les archives
          </button>
        </form>
      ) : loading ? (
        <div className="bg-white p-10 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> Chargement des archives…
        </div>
      ) : error ? (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs text-center space-y-3">
          <p className="text-sm font-semibold text-rose-600">{error}</p>
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Réessayer
          </button>
        </div>
      ) : (
        <>
          {/* Actions Fondateur / DGA */}
          {canCreate && (
            <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-start gap-2">
                <Save className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 font-heading">Sauvegarder l’année en cours</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Une archive est une copie complète et figée : élèves, paiements, salaires, dépenses, appel, absences signalées aux
                    parents, pointage, notes, bulletins, réductions, santé, services et messages. Elle n’est plus jamais modifiée.
                    Une sauvegarde automatique est aussi prise chaque semaine.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  onClick={() => create('manuel')}
                  disabled={!!creating}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {creating === 'manuel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  Sauvegarder maintenant
                </button>
                <button
                  onClick={() => setConfirmCloture(true)}
                  disabled={!!creating}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-sm shadow-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <CalendarCheck className="w-4 h-4" />
                  Clôturer l’année scolaire
                </button>
              </div>
            </div>
          )}

          {/* Passage à l'année suivante (Fondateur / DGA) */}
          {canCreate && (
            <div className="bg-white p-4 sm:p-6 rounded-3xl border border-rose-200 shadow-xs space-y-4">
              <div className="flex items-start gap-2">
                <RotateCcw className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 font-heading">
                    Passer à l’année suivante{currentYear ? <span className="text-slate-500 font-bold"> • actuellement {currentYear}</span> : null}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    L’année en cours est d’abord archivée en entier, puis <span className="font-bold text-rose-600">toutes les pages repartent de zéro</span>,
                    pour tous les postes et tous les enseignants. À faire une seule fois, en fin d’année scolaire.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNewYear(true)}
                disabled={!!creating}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm shadow-rose-600/30 disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Passer à l’année suivante
              </button>
            </div>
          )}

          {/* Années */}
          {byYear.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xs text-center space-y-2">
              <Archive className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-900">Aucune archive pour le moment</p>
              <p className="text-xs text-slate-500">
                {canCreate ? 'Cliquez sur « Sauvegarder maintenant » pour créer la première.' : 'Le Fondateur ou le DGA n’a pas encore créé d’archive.'}
              </p>
            </div>
          ) : (
            byYear.map(([year, list]) => (
              <div key={year} className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 font-heading">Année scolaire {year}</h2>
                  {list.some((a) => a.kind === 'cloture') ? (
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-emerald-600 text-white">Clôturée</span>
                  ) : year === currentYear ? (
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">En cours</span>
                  ) : null}
                </div>
                <div className="space-y-2.5">
                  {list.map((a) => (
                    <div key={a.id} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col lg:flex-row lg:items-center gap-3">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${KIND_BADGE[a.kind]?.cls || KIND_BADGE.manuel.cls}`}>
                            {KIND_BADGE[a.kind]?.label || 'Sauvegarde'}
                          </span>
                          <span className="text-xs font-bold text-slate-900">{frDateTime(a.created_at)}</span>
                          {a.size_bytes ? <span className="text-[10px] text-slate-400">{sizeLabel(a.size_bytes)}</span> : null}
                        </div>
                        <p className="text-[11px] text-slate-500 break-words">
                          {a.label} • par {a.created_by || '—'}
                        </p>
                        {a.summary && (
                          <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                            <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700">{a.summary.students} élèves</span>
                            <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700">{a.summary.salariesCount} salaires</span>
                            <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700">{a.summary.expensesCount} dépenses</span>
                            <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700">{a.summary.absences} absences</span>
                            <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700">{a.summary.pointageDays} jours de pointage</span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setOpen(a)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-emerald-700 bg-white border border-emerald-200 hover:bg-emerald-50 cursor-pointer shrink-0"
                      >
                        <FolderOpen className="w-3.5 h-3.5" /> Ouvrir
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {showNewYear && (
        <NewYearModal schoolSlug={schoolSlug} currentYear={currentYear} onClose={() => setShowNewYear(false)} />
      )}

      {/* Confirmation de clôture */}
      {confirmCloture && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold text-slate-900 font-heading">Clôturer l’année scolaire ?</h3>
              <p className="text-xs text-slate-600">
                Une copie complète et définitive de toutes les données de l’année est enregistrée dans Supabase. Elle sera gardée
                pour toujours et consultable ici à tout moment.
              </p>
              <p className="text-xs text-slate-600">
                <span className="font-bold text-slate-900">Rien n’est effacé</span> dans l’application : vous continuez à travailler
                normalement.
              </p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2.5">
              <button
                onClick={() => setConfirmCloture(false)}
                disabled={!!creating}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={() => create('cloture')}
                disabled={!!creating}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                {creating === 'cloture' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-4 h-4" />}
                Clôturer et archiver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Passage à l'année suivante ─────────────────────────────────────────────────────────

const nextYearOf = (y: string) => {
  const m = String(y || '').match(/^(\d{4})-(\d{4})$/);
  if (m) return `${Number(m[1]) + 1}-${Number(m[2]) + 1}`;
  const now = new Date().getFullYear();
  return `${now}-${now + 1}`;
};

function NewYearModal({ schoolSlug, currentYear, onClose }: { schoolSlug: string; currentYear: string; onClose: () => void }) {
  const [newYear, setNewYear] = useState(nextYearOf(currentYear));
  const [keepStaff, setKeepStaff] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const typedOk =
    confirmText.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim() === 'NOUVELLE ANNEE';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedOk || !code.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/archives/new-year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newYear: newYear.trim(), keepStaff, confirmText, code: code.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.error || 'Passage impossible pour le moment. Réessayez.');
        setBusy(false);
        return;
      }
      // Cet appareil efface aussi sa copie de l'année passée, puis repart de zéro.
      wipeLocalSchoolData();
      syncYearEpoch(schoolSlug, json.yearEpoch);
      setDone(`Année ${json.oldYear} archivée. Bienvenue en ${json.newYear} : toutes les pages repartent de zéro.`);
      setTimeout(() => window.location.replace(`/${schoolSlug}/admin/dashboard`), 2500);
    } catch {
      setError('Connexion impossible. Réessayez.');
      setBusy(false);
    }
  };

  const ERASED = [
    'Élèves, inscriptions et vue d’ensemble',
    'Reçus, versements et tableau de bord',
    'Internat, cantine, transport',
    'Salaires, dépenses, réductions, rappels',
    'Appel, absences, notes, bulletins, distinctions',
    'Pointage, santé, documents, notes diverses',
    'Messages des parents, annonces, corbeille',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <form onSubmit={submit} className="w-full max-w-lg bg-white rounded-3xl shadow-xl p-5 sm:p-6 space-y-4 my-auto">
        {done ? (
          <div className="text-center space-y-3 py-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-900">{done}</p>
            <p className="text-xs text-slate-500">Tous les autres appareils devront se reconnecter.</p>
            <Loader2 className="w-4 h-4 mx-auto animate-spin text-emerald-600" />
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 font-heading">Passer à l’année suivante</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {currentYear || 'L’année en cours'} est d’abord archivée en entier (consultable ici pour toujours), puis tout repart de zéro.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Remis à zéro sur toutes les pages, pour tous</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-xs text-rose-900">
                {ERASED.map((t) => (
                  <li key={t} className="flex items-start gap-1.5">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-rose-500 shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-[11px] text-slate-500">
              <span className="font-bold text-slate-700">Gardés :</span> identité, logo et cachet de l’école, position et horaires de pointage, code
              des chiffres, coefficients des notes, lignes de transport, capacité de l’internat, menu de la cantine, comptes du Fondateur et du DGA.
            </p>

            <label className="block space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Nouvelle année scolaire</span>
              <input
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                placeholder="2027-2028"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </label>

            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
              <input type="checkbox" checked={keepStaff} onChange={(e) => setKeepStaff(e.target.checked)} className="mt-0.5 w-4 h-4 accent-emerald-600" />
              <span className="text-xs text-slate-700">
                <span className="font-bold text-slate-900">Garder les comptes du personnel</span> (Administration & Codes : comptable, secrétaire,
                enseignants… avec leurs codes). Non coché : seuls le Fondateur et le DGA restent.
              </span>
            </label>

            <label className="block space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tapez NOUVELLE ANNÉE pour confirmer</span>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-bold text-slate-900 focus:outline-none ${
                  typedOk ? 'border-emerald-500' : 'border-slate-300 focus:border-emerald-600'
                }`}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Votre code personnel de connexion</span>
              <input
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </label>

            {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

            <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={busy || !typedOk || !code.trim()}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                {busy ? 'Archivage puis remise à zéro…' : 'Archiver et repartir de zéro'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

// ─── Consultation d'une archive ─────────────────────────────────────────────────────────

function ArchiveViewer({
  archive,
  headers,
  onBack,
  onCodeLost,
}: {
  archive: ArchiveRow;
  headers: (extra?: Record<string, string>) => Record<string, string>;
  onBack: () => void;
  onCodeLost: () => void;
}) {
  const [section, setSection] = useState<Section>('resume');
  const [rows, setRows] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const cache = React.useRef<Record<string, any>>({});

  useEffect(() => {
    setQuery('');
    if (cache.current[section] !== undefined) {
      setRows(cache.current[section]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      setRows(null);
      try {
        const res = await fetch(`/api/archives?id=${encodeURIComponent(archive.id)}&section=${section}`, {
          cache: 'no-store',
          headers: headers(),
        });
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (json?.needCode) return onCodeLost();
        if (!res.ok || !json?.success) {
          setError(json?.error || 'Lecture impossible.');
          return;
        }
        cache.current[section] = json.rows;
        setRows(json.rows);
      } catch {
        if (!cancelled) setError('Connexion impossible. Réessayez.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, archive.id]);

  const filtered = useMemo(() => {
    if (!Array.isArray(rows)) return rows;
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r: any) => Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q)));
  }, [rows, query]);

  return (
    <div className="space-y-5">
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 print:border-0 print:shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 cursor-pointer print:hidden"
              title="Retour aux archives"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight font-heading">Année scolaire {archive.academic_year}</h1>
              <p className="text-xs text-slate-500">
                {KIND_BADGE[archive.kind]?.label || 'Archive'} du {frDateTime(archive.created_at)} • lecture seule
              </p>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 cursor-pointer print:hidden"
          >
            <Printer className="w-3.5 h-3.5" /> Imprimer
          </button>
        </div>

        {/* Rubriques */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 print:hidden">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = s.id === section;
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer border transition-colors ${
                  active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {s.label}
              </button>
            );
          })}
        </div>

        {section !== 'resume' && Array.isArray(rows) && (
          <div className="relative print:hidden">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher (nom, classe, mois, référence…)"
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
            />
          </div>
        )}
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs print:border-0 print:shadow-none">
        {loading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> Ouverture de l’archive…
          </div>
        ) : error ? (
          <p className="py-6 text-center text-sm font-semibold text-rose-600">{error}</p>
        ) : rows === null ? null : section === 'resume' ? (
          <ResumeSection data={rows} />
        ) : (
          <ListSection section={section} rows={filtered || []} total={Array.isArray(rows) ? rows.length : 0} />
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone = 'slate' }: { label: string; value: React.ReactNode; tone?: 'slate' | 'emerald' | 'rose' | 'amber' }) {
  const tones = {
    slate: 'text-slate-900',
    emerald: 'text-emerald-700',
    rose: 'text-rose-600',
    amber: 'text-amber-700',
  };
  return (
    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-base sm:text-lg font-extrabold mt-0.5 ${tones[tone]}`}>{value}</p>
    </div>
  );
}

function ResumeSection({ data }: { data: { school: any; summary: Summary } }) {
  const s = data?.summary;
  if (!s) return null;
  return (
    <div className="space-y-4">
      <p className="text-sm font-bold text-slate-900">
        {data.school?.name || ''} {data.school?.currentTerm ? <span className="text-slate-500 font-medium">• {data.school.currentTerm}</span> : null}
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Kpi label="Élèves" value={s.students} />
        <Kpi label="Total encaissé" value={formatFCFA(s.paidTotal)} tone="emerald" />
        <Kpi label="Reste à percevoir" value={formatFCFA(s.balanceTotal)} tone="rose" />
        <Kpi label="Scolarité attendue" value={formatFCFA(s.invoicesTotal)} />
        <Kpi label="Salaires versés" value={`${s.salariesCount} • ${formatFCFA(s.salariesTotal)}`} />
        <Kpi label="Dépenses" value={`${s.expensesCount} • ${formatFCFA(s.expensesTotal)}`} tone="rose" />
        <Kpi label="Absences / retards" value={`${s.absences} / ${s.lates}`} tone="amber" />
        <Kpi label="Parents avertis" value={s.parentsNotified} tone="emerald" />
        <Kpi label="Personnel" value={s.staff} />
        <Kpi label="Jours de pointage" value={s.pointageDays} />
        <Kpi label="Messages parents" value={s.parentMessages} />
        <Kpi label="Bulletins validés" value={s.validatedBulletins} />
      </div>
    </div>
  );
}

type Col = { label: string; render: (r: any) => React.ReactNode; strong?: boolean; right?: boolean };

const STATUS_PILL = (status: string) =>
  status === 'absent' ? (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">Absent</span>
  ) : (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">Retard</span>
  );

const COLUMNS: Record<Exclude<Section, 'resume'>, { title: (r: any) => React.ReactNode; cols: Col[]; empty: string; total?: (rows: any[]) => string }> = {
  eleves: {
    title: (r) => r.fullName,
    empty: 'Aucun élève dans cette archive.',
    total: (rows) => `Encaissé : ${formatFCFA(rows.reduce((t, r) => t + (r.paid || 0), 0))} • Reste : ${formatFCFA(rows.reduce((t, r) => t + (r.balance || 0), 0))}`,
    cols: [
      { label: 'Élève', render: (r) => r.fullName, strong: true },
      { label: 'Classe', render: (r) => r.grade },
      { label: 'Matricule', render: (r) => r.matricule || '—' },
      { label: 'Parent', render: (r) => `${r.guardianName || '—'}${r.guardianPhone ? ` • ${r.guardianPhone}` : ''}` },
      { label: 'Payé', render: (r) => formatFCFA(r.paid), right: true },
      { label: 'Reste', render: (r) => <span className={r.balance > 0 ? 'text-rose-600 font-bold' : 'text-emerald-700 font-bold'}>{formatFCFA(r.balance)}</span>, right: true },
    ],
  },
  salaires: {
    title: (r) => r.staffName,
    empty: 'Aucun salaire enregistré dans cette archive.',
    total: (rows) => `Total net versé : ${formatFCFA(rows.reduce((t, r) => t + (r.netSalary || 0), 0))}`,
    cols: [
      { label: 'Reçu', render: (r) => r.receiptNumber },
      { label: 'Bénéficiaire', render: (r) => r.staffName, strong: true },
      { label: 'Poste', render: (r) => r.role },
      { label: 'Mois', render: (r) => r.payPeriod },
      { label: 'Payé le', render: (r) => frDay(r.paymentDate) },
      { label: 'Mode', render: (r) => r.paymentMethod },
      { label: 'Net', render: (r) => <span className="font-bold text-emerald-700">{formatFCFA(r.netSalary)}</span>, right: true },
    ],
  },
  depenses: {
    title: (r) => r.title,
    empty: 'Aucune dépense dans cette archive.',
    total: (rows) => `Total : ${formatFCFA(rows.reduce((t, r) => t + (r.amount || 0), 0))}`,
    cols: [
      { label: 'Réf.', render: (r) => r.reference },
      { label: 'Libellé', render: (r) => r.title, strong: true },
      { label: 'Catégorie', render: (r) => r.category },
      { label: 'Date', render: (r) => frDay(r.expenseDate) },
      { label: 'Bénéficiaire', render: (r) => r.beneficiary },
      { label: 'Montant', render: (r) => <span className="font-bold text-rose-600">{formatFCFA(r.amount)}</span>, right: true },
    ],
  },
  presences: {
    title: (r) => r.studentName,
    empty: 'Aucune absence ni aucun retard dans cette archive.',
    cols: [
      { label: 'Date', render: (r) => frDay(r.date) },
      { label: 'Créneau', render: (r) => r.slot },
      { label: 'Élève', render: (r) => r.studentName, strong: true },
      { label: 'Classe', render: (r) => r.grade },
      { label: 'Statut', render: (r) => STATUS_PILL(r.status) },
      { label: 'Motif', render: (r) => r.reason || '—' },
      {
        label: 'Parent averti',
        render: (r) =>
          r.notifiedAt ? (
            <span className="text-emerald-700 font-bold">
              {frDateTime(r.notifiedAt)}
              {r.notifiedBy ? <span className="block text-[10px] font-medium text-slate-500">{r.notifiedBy}</span> : null}
            </span>
          ) : (
            <span className="text-slate-400">Non</span>
          ),
      },
    ],
  },
  pointage: {
    title: (r) => r.fullName,
    empty: 'Aucun pointage dans cette archive.',
    cols: [
      { label: 'Date', render: (r) => frDay(r.date) },
      { label: 'Membre', render: (r) => r.fullName, strong: true },
      { label: 'Arrivée', render: (r) => r.arrival || '—' },
      { label: 'Départ', render: (r) => r.departure || '—' },
      { label: 'Motif d’absence', render: (r) => r.absenceReason || '—' },
    ],
  },
  messages: {
    title: (r) => r.parentName || 'Parent',
    empty: 'Aucun message de parent dans cette archive.',
    cols: [
      { label: 'Date', render: (r) => frDateTime(r.date) },
      { label: 'Parent', render: (r) => r.parentName, strong: true },
      { label: 'Élève', render: (r) => r.studentName || '—' },
      { label: 'Objet', render: (r) => r.subject || '—' },
      { label: 'Message', render: (r) => <span className="whitespace-pre-line">{r.body}</span> },
      { label: 'Réponse', render: (r) => (r.reply ? <span className="whitespace-pre-line">{r.reply}</span> : <span className="text-slate-400">—</span>) },
    ],
  },
};

function ListSection({ section, rows, total }: { section: Exclude<Section, 'resume'>; rows: any[]; total: number }) {
  const def = COLUMNS[section];
  const [limit, setLimit] = useState(200);
  useEffect(() => setLimit(200), [section, rows.length]);
  const shown = rows.slice(0, limit);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-bold text-slate-900">
          {rows.length} ligne{rows.length > 1 ? 's' : ''}
          {rows.length !== total ? <span className="font-medium text-slate-500"> sur {total}</span> : null}
        </span>
        {def.total && rows.length > 0 && <span className="font-bold text-slate-700">{def.total(rows)}</span>}
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-500">{def.empty}</p>
      ) : (
        <>
          {/* Téléphone : cartes */}
          <div className="md:hidden space-y-2.5 print:hidden">
            {shown.map((r, i) => (
              <div key={r.id || i} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                <p className="text-sm font-bold text-slate-900 break-words">{def.title(r)}</p>
                {def.cols
                  .filter((c) => !c.strong)
                  .map((c) => (
                    <div key={c.label} className="flex items-start justify-between gap-3 text-xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 pt-0.5">{c.label}</span>
                      <span className="text-slate-800 text-right break-words min-w-0">{c.render(r)}</span>
                    </div>
                  ))}
              </div>
            ))}
          </div>

          {/* Ordinateur : tableau */}
          <div className="hidden md:block print:block overflow-x-auto -mx-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                  {def.cols.map((c) => (
                    <th key={c.label} className={`py-2 px-2 font-bold ${c.right ? 'text-right' : ''}`}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r, i) => (
                  <tr key={r.id || i} className="border-b border-slate-100 last:border-0 align-top">
                    {def.cols.map((c) => (
                      <td key={c.label} className={`py-2.5 px-2 ${c.strong ? 'font-bold text-slate-900' : 'text-slate-700'} ${c.right ? 'text-right whitespace-nowrap' : ''}`}>
                        {c.render(r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.length > limit && (
            <button
              onClick={() => setLimit((l) => l + 300)}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-emerald-700 bg-white border border-emerald-200 hover:bg-emerald-50 cursor-pointer print:hidden"
            >
              Afficher plus ({rows.length - limit} restantes)
            </button>
          )}
        </>
      )}
    </div>
  );
}
