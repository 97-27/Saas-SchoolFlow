'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Student, School } from '@/lib/data/types';
import { formatFCFA } from '@/lib/utils/formatters';
import { availableClasses } from '@/lib/data/mock-data';
import {
  getLiveStudents,
  getLiveSchool,
  syncSchoolDataWithServer,
  DATA_UPDATED_EVENT,
} from '@/lib/data/live-store';
import {
  getVersementPlan,
  saveVersementPlan,
  versementStatus,
  VersementPlan,
  MAX_VERSEMENTS,
} from '@/lib/data/versement-plan';
import {
  Printer,
  Download,
  Search,
  Wallet,
  MessageCircle,
  RefreshCw,
  Settings2,
  ChevronDown,
  ChevronUp,
  Save,
  AlertTriangle,
} from 'lucide-react';

interface VersementsViewProps {
  school: School;
  schoolSlug: string;
}

type Row = {
  id: string;
  number: string;
  name: string;
  grade: string;
  guardian: string;
  phone: string;
  net: number;
  paid: number;
  remaining: number;
  /** Versement attendu (1 à 5), 0 = soldé. */
  due: number;
  /** Reste à payer sur le versement attendu. */
  dueAmount: number;
  dueDate: string;
  late: boolean;
  hasPlan: boolean;
};

const ORDINAL = ['', '1er', '2e', '3e', '4e', '5e'];
const PLAN_EDITORS = ['fondateur', 'directeur', 'comptable'];

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const frDate = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');

function toRow(s: Student, plan: VersementPlan, today: string): Row | null {
  if (!s || (s.status && s.status !== 'active')) return null;
  const inst: any = s.installments || {};
  const amounts = [1, 2, 3, 4, 5].map((i) => Number(inst[`versement${i}`]?.amount) || 0);
  const paidCount = amounts.filter((a) => a > 0).length;
  const fromInst = amounts.reduce((a, b) => a + b, 0);
  const paid = fromInst > 0 ? fromInst : Number(s.paidAmount) || 0;
  const net = Number(s.netAmount) || Math.max(0, (Number(s.tuitionAmount) || 0) - (Number(s.discountAmount) || 0));
  const st = versementStatus(paid, net, plan.classes[s.grade || ''], plan.dates, today);

  let due = st.due;
  let dueAmount = st.dueAmount;
  if (!st.hasPlan) {
    // Pas encore de plan pour cette classe : repère approximatif (nombre de versements déjà faits).
    const owes = net > 0 ? st.remaining > 0 : paidCount === 0;
    due = owes ? Math.min(MAX_VERSEMENTS, paidCount + 1) : 0;
    dueAmount = st.remaining;
  }
  return {
    id: s.id,
    number: s.studentNumber || '',
    name: s.fullName || `${s.lastName || ''} ${s.firstName || ''}`.trim(),
    grade: s.grade || '',
    guardian: s.guardianName || '',
    phone: s.whatsappPhone || s.guardianPhone || '',
    net: net || (plan.classes[s.grade || '']?.reduce((a, b) => a + b, 0) ?? 0),
    paid,
    remaining: st.remaining,
    due,
    dueAmount,
    dueDate: st.dueDate,
    late: st.late,
    hasPlan: st.hasPlan,
  };
}

function waLink(phone: string, text: string): string | null {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length < 8) return null;
  if ((d.length === 10 && d.startsWith('0')) || d.length === 8) d = `225${d}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

const normalize = (v: string) =>
  v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export function VersementsView({ school, schoolSlug }: VersementsViewProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [schoolState, setSchoolState] = useState<School>(school);
  const [plan, setPlan] = useState<VersementPlan>({ classes: {}, dates: ['', '', '', '', ''] });
  const [draft, setDraft] = useState<VersementPlan | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [canEditPlan, setCanEditPlan] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([1]);
  const [lateOnly, setLateOnly] = useState(false);
  const [grade, setGrade] = useState('all');
  const [search, setSearch] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const today = todayStr();

  useEffect(() => {
    const load = () => {
      setStudents(getLiveStudents([], schoolSlug));
      setSchoolState(getLiveSchool(schoolSlug, school));
      setPlan(getVersementPlan(schoolSlug));
      setUpdatedAt(new Date());
    };
    load();
    try {
      const sess = JSON.parse(localStorage.getItem('schoolflow_active_session_v2') || '{}');
      setCanEditPlan(PLAN_EDITORS.includes(sess?.roleId));
    } catch (e) {}
    // Toujours partir des données de la base (même liste sur tous les appareils).
    syncSchoolDataWithServer(schoolSlug, true);
    window.addEventListener(DATA_UPDATED_EVENT, load);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, load);
  }, [schoolSlug, school]);

  // Plan affiché : le brouillon en cours de modification, sinon celui de la base.
  const shownPlan = draft || plan;

  const rows = useMemo(
    () => students.map((s) => toRow(s, plan, today)).filter((r): r is Row => !!r),
    [students, plan, today]
  );

  const grades = useMemo(() => {
    const fromStudents = rows.map((r) => r.grade).filter(Boolean);
    const known = availableClasses.filter((c) => c !== 'Toutes les classes');
    const extra = Array.from(new Set(fromStudents)).filter((g) => !known.includes(g));
    const used = new Set(fromStudents);
    // Ordre officiel des classes, limité à celles qui ont des élèves ou un plan.
    return [...known, ...extra.sort((a, b) => a.localeCompare(b, 'fr'))].filter(
      (g) => used.has(g) || (shownPlan.classes[g] || []).some((a) => a > 0)
    );
  }, [rows, shownPlan]);

  const counts = useMemo(() => {
    const c = [0, 0, 0, 0, 0, 0];
    rows.forEach((r) => {
      if ((grade === 'all' || r.grade === grade) && (!lateOnly || r.late)) c[r.due]++;
    });
    return c;
  }, [rows, grade, lateOnly]);

  const classesWithoutPlan = useMemo(
    () => Array.from(new Set(rows.filter((r) => !r.hasPlan).map((r) => r.grade))).filter(Boolean),
    [rows]
  );

  const list = useMemo(() => {
    const q = normalize(search);
    return rows
      .filter((r) => selected.includes(r.due))
      .filter((r) => grade === 'all' || r.grade === grade)
      .filter((r) => !lateOnly || r.late)
      .filter((r) => {
        if (!q) return true;
        const hay = normalize(`${r.name} ${r.number} ${r.guardian} ${r.phone}`);
        return q.split(/\s+/).every((w) => hay.includes(w));
      })
      .sort(
        (a, b) =>
          a.due - b.due ||
          grades.indexOf(a.grade) - grades.indexOf(b.grade) ||
          a.name.localeCompare(b.name, 'fr')
      );
  }, [rows, selected, grade, lateOnly, search, grades]);

  const totalDue = list.reduce((s, r) => s + r.dueAmount, 0);
  const totalRemaining = list.reduce((s, r) => s + r.remaining, 0);

  const toggle = (n: number) =>
    setSelected((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort()));

  const selectionLabel =
    selected.length === 0
      ? 'Aucun choix'
      : selected.map((n) => (n === 0 ? 'scolarité soldée' : `${ORDINAL[n]} versement`)).join(', ');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // ── Plan des versements ──
  const startEdit = () => {
    setDraft({ classes: { ...plan.classes }, dates: [...plan.dates] });
    setPlanOpen(true);
  };
  const setAmount = (g: string, i: number, value: string) => {
    if (!draft) return;
    const n = Math.max(0, Math.round(Number(value.replace(/\D/g, '')) || 0));
    const cur = [...(draft.classes[g] || [0, 0, 0, 0, 0])];
    cur[i] = n;
    setDraft({ ...draft, classes: { ...draft.classes, [g]: cur } });
  };
  const setDate = (i: number, value: string) => {
    if (!draft) return;
    const d = [...draft.dates];
    d[i] = value;
    setDraft({ ...draft, dates: d });
  };
  const copyToAll = (g: string) => {
    if (!draft) return;
    const src = draft.classes[g] || [0, 0, 0, 0, 0];
    const next = { ...draft.classes };
    grades.forEach((c) => {
      next[c] = [...src];
    });
    setDraft({ ...draft, classes: next });
  };
  const savePlan = () => {
    if (!draft) return;
    try {
      saveVersementPlan(schoolSlug, draft);
      setPlan(getVersementPlan(schoolSlug));
      setDraft(null);
      showToast('✓ Plan des versements enregistré : il s’applique sur tous les appareils.');
    } catch (e) {
      showToast('⚠️ Le plan n’a pas pu être enregistré. Vérifiez la connexion et réessayez.');
    }
  };

  const exportCsv = () => {
    const head = ['N°', 'Élève', 'Classe', 'Parent', 'Téléphone', 'Versement dû', 'Montant dû sur ce versement', 'Date limite', 'En retard', 'Scolarité nette', 'Déjà versé', 'Reste total'];
    const lines = list.map((r) =>
      [
        r.number,
        r.name,
        r.grade,
        r.guardian,
        r.phone,
        r.due === 0 ? 'Soldé' : `${ORDINAL[r.due]} versement`,
        r.dueAmount,
        frDate(r.dueDate),
        r.late ? 'Oui' : '',
        r.net,
        r.paid,
        r.remaining,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(';')
    );
    const csv = '﻿' + [head.join(';'), ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `versements-${schoolSlug}-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const chips = [1, 2, 3, 4, 5, 0];

  return (
    <div className="space-y-5">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #versements-print, #versements-print * { visibility: visible !important; }
          #versements-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0 8mm; border: 0 !important; }
          .no-print { display: none !important; }
          #versements-print table { font-size: 11px; }
          #versements-print tr { break-inside: avoid; }
        }
      `}</style>

      {toast && (
        <div className="no-print fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 rounded-2xl bg-slate-900 text-white text-sm font-semibold px-4 py-3 shadow-xl">
          {toast}
        </div>
      )}

      {/* En-tête */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Suivi des versements</h1>
            <p className="text-xs text-slate-500">
              Selon le plan de versements de chaque classe : qui doit le 1er, 2e, 3e, 4e ou 5e versement.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => syncSchoolDataWithServer(schoolSlug, true)}
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200"
          >
            <RefreshCw className="w-4 h-4" /> Actualiser
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={list.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Excel
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={list.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" /> Imprimer la liste
          </button>
        </div>
      </div>

      {/* Plan des versements par classe */}
      <div className="no-print bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => setPlanOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-left"
        >
          <span className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-emerald-600" />
            <span>
              <span className="block text-sm font-extrabold text-slate-900">Plan des versements par classe</span>
              <span className="block text-xs text-slate-500">
                {Object.keys(plan.classes).length} classe(s) configurée(s)
                {classesWithoutPlan.length > 0 ? ` • sans plan : ${classesWithoutPlan.join(', ')}` : ''}
              </span>
            </span>
          </span>
          {planOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>

        {planOpen && (
          <div className="border-t border-slate-100 p-4 sm:p-5 space-y-4">
            {!draft && (
              <div className="flex flex-wrap items-center gap-2">
                {canEditPlan ? (
                  <button
                    type="button"
                    onClick={startEdit}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700"
                  >
                    Modifier le plan
                  </button>
                ) : (
                  <p className="text-xs text-slate-500">Seuls le Fondateur, le Directeur et le Comptable peuvent modifier le plan.</p>
                )}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50">
                  <tr>
                    <th className="text-left px-2 py-2">Classe</th>
                    {Array.from({ length: MAX_VERSEMENTS }, (_, i) => (
                      <th key={i} className="text-left px-2 py-2">{ORDINAL[i + 1]} versement</th>
                    ))}
                    <th className="text-right px-2 py-2">Total</th>
                    {draft && <th className="px-2 py-2"></th>}
                  </tr>
                  <tr className="bg-white">
                    <td className="px-2 py-2 text-xs font-bold text-slate-600">Date limite</td>
                    {Array.from({ length: MAX_VERSEMENTS }, (_, i) => (
                      <td key={i} className="px-2 py-2">
                        {draft ? (
                          <input
                            type="date"
                            value={draft.dates[i] || ''}
                            onChange={(e) => setDate(i, e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
                          />
                        ) : (
                          <span className="text-xs text-slate-600">{frDate(plan.dates[i]) || '—'}</span>
                        )}
                      </td>
                    ))}
                    <td></td>
                    {draft && <td></td>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {grades.map((g) => {
                    const amounts = shownPlan.classes[g] || [0, 0, 0, 0, 0];
                    const total = amounts.reduce((a, b) => a + b, 0);
                    return (
                      <tr key={g}>
                        <td className="px-2 py-2 font-semibold text-slate-800 whitespace-nowrap">{g}</td>
                        {amounts.map((a, i) => (
                          <td key={i} className="px-2 py-2">
                            {draft ? (
                              <input
                                type="text"
                                inputMode="numeric"
                                value={a ? String(a) : ''}
                                placeholder="0"
                                onChange={(e) => setAmount(g, i, e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
                              />
                            ) : (
                              <span className="text-slate-700">{a ? formatFCFA(a) : '—'}</span>
                            )}
                          </td>
                        ))}
                        <td className="px-2 py-2 text-right font-bold text-slate-900 whitespace-nowrap">{total ? formatFCFA(total) : '—'}</td>
                        {draft && (
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => copyToAll(g)}
                              title="Recopier ces montants sur toutes les classes"
                              className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 whitespace-nowrap"
                            >
                              Copier partout
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {draft && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={savePlan}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700"
                >
                  <Save className="w-4 h-4" /> Enregistrer le plan
                </button>
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200"
                >
                  Annuler
                </button>
              </div>
            )}
            <p className="text-[11px] text-slate-500">
              Laissez vide un versement qui n’existe pas pour une classe (ex. 4 versements : le 5e reste vide). Si la scolarité
              nette d’un élève est plus faible que le plan (réduction), la différence est retirée des derniers versements.
            </p>
          </div>
        )}
      </div>

      {/* Choix des versements (plusieurs à la fois) */}
      <div className="no-print bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Cochez un ou plusieurs versements</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {chips.map((n) => {
            const on = selected.includes(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => toggle(n)}
                className={`flex flex-col items-start rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                  on
                    ? n === 0
                      ? 'border-sky-500 bg-sky-50 text-sky-800'
                      : 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="text-xs font-bold">{n === 0 ? 'Scolarité soldée' : `Doivent le ${ORDINAL[n]} versement`}</span>
                <span className="text-xl font-extrabold">{counts[n]}</span>
                {n > 0 && plan.dates[n - 1] && (
                  <span className="text-[10px] font-semibold opacity-75">avant le {frDate(plan.dates[n - 1])}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelected([1, 2, 3, 4, 5])}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200"
          >
            Tous ceux qui doivent
          </button>
          <button
            type="button"
            onClick={() => setSelected([])}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200"
          >
            Tout décocher
          </button>
          <button
            type="button"
            onClick={() => setLateOnly((v) => !v)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold ${
              lateOnly ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Seulement les retards
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un élève, un parent, un numéro…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="sm:w-56 px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
          >
            <option value="all">Toutes les classes</option>
            {grades.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Liste (imprimable) */}
      <div id="versements-print" className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <p className="text-sm font-extrabold text-slate-900">{schoolState.name}</p>
            <p className="text-xs text-slate-500">
              {selectionLabel}
              {lateOnly ? ' • en retard' : ''}
              {grade !== 'all' ? ` • ${grade}` : ''} • {list.length} élève(s)
              {updatedAt
                ? ` • liste du ${updatedAt.toLocaleDateString('fr-FR')} à ${updatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-rose-600">Dû sur ces versements : {formatFCFA(totalDue)}</p>
            <p className="text-xs text-slate-500">Reste total de la scolarité : {formatFCFA(totalRemaining)}</p>
          </div>
        </div>

        {list.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Aucun élève pour ce choix.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2">N°</th>
                  <th className="text-left px-3 py-2">Élève</th>
                  <th className="text-left px-3 py-2">Classe</th>
                  <th className="text-left px-3 py-2">Parent / Téléphone</th>
                  <th className="text-left px-3 py-2">Doit</th>
                  <th className="text-right px-3 py-2">Dû sur ce versement</th>
                  <th className="text-right px-3 py-2">Déjà versé</th>
                  <th className="text-right px-3 py-2">Reste total</th>
                  <th className="no-print px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((r) => {
                  const link = waLink(
                    r.phone,
                    `Bonjour ${r.guardian || ''}, ${schoolState.name} vous rappelle que le ${
                      r.due ? `${ORDINAL[r.due]} versement` : 'versement'
                    } de la scolarité de ${r.name} (${r.grade}) est attendu${r.dueDate ? ` avant le ${frDate(r.dueDate)}` : ''} : ${formatFCFA(
                      r.dueAmount
                    )}. Merci.`
                  );
                  return (
                    <tr key={r.id} className={`align-top ${r.late ? 'bg-rose-50/40' : ''}`}>
                      <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{r.number}</td>
                      <td className="px-3 py-2 font-semibold text-slate-900">{r.name}</td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.grade}</td>
                      <td className="px-3 py-2 text-slate-600">
                        <div>{r.guardian}</div>
                        <div className="text-xs text-slate-400">{r.phone}</div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.due === 0 ? (
                          <span className="text-xs font-bold text-sky-700">Soldé</span>
                        ) : (
                          <>
                            <span className="text-xs font-bold text-emerald-700">{ORDINAL[r.due]} versement</span>
                            {r.late && <span className="block text-[10px] font-bold text-rose-600">En retard</span>}
                            {!r.hasPlan && <span className="block text-[10px] text-slate-400">classe sans plan</span>}
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap font-bold text-rose-600">{formatFCFA(r.dueAmount)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{formatFCFA(r.paid)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap text-slate-700">{formatFCFA(r.remaining)}</td>
                      <td className="no-print px-3 py-2 text-right">
                        {link && r.due !== 0 && (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Rappel WhatsApp au parent"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> Rappel
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
