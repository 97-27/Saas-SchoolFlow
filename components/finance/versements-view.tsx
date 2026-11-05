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
  getReminderAmounts,
  setReminderAmounts,
  reminderId,
  ReminderAmounts,
  MAX_VERSEMENTS,
} from '@/lib/data/versement-reminders';
import { Printer, Download, Search, Wallet, MessageCircle, RefreshCw } from 'lucide-react';

interface VersementsViewProps {
  school: School;
  schoolSlug: string;
}

type StudentInfo = {
  id: string;
  number: string;
  name: string;
  grade: string;
  guardian: string;
  phone: string;
  paid: number;
  /** Versements dont la case est encore vide dans la fiche. */
  empty: number[];
};

/** Une ligne = un élève, avec TOUS les versements cochés qu'il n'a pas encore payés. */
type Row = Omit<StudentInfo, 'empty'> & { missing: number[] };

/** « 1er », « 1er et 2e », « 1er, 2e et 3e »… */
const joinOrdinals = (vs: number[]) => {
  const w = vs.map((v) => ORDINAL[v]);
  return w.length <= 1 ? w.join('') : `${w.slice(0, -1).join(', ')} et ${w[w.length - 1]}`;
};

const ORDINAL = ['', '1er', '2e', '3e', '4e', '5e'];
const VERSEMENTS = [1, 2, 3, 4, 5];

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Cases vides de la fiche (Inscriptions / Vue d'ensemble). Un élève qui a déjà soldé toute sa
 * scolarité n'est dans aucune liste, même si certaines de ses cases sont vides.
 */
function toInfo(s: Student): StudentInfo | null {
  if (!s || (s.status && s.status !== 'active')) return null;
  const inst: any = s.installments || {};
  const amounts = VERSEMENTS.map((i) => Number(inst[`versement${i}`]?.amount) || 0);
  const fromInst = amounts.reduce((a, b) => a + b, 0);
  const paid = fromInst > 0 ? fromInst : Number(s.paidAmount) || 0;
  const net = Number(s.netAmount) || Math.max(0, (Number(s.tuitionAmount) || 0) - (Number(s.discountAmount) || 0));
  const paidOff = net > 0 && paid >= net;
  return {
    id: s.id,
    number: s.studentNumber || '',
    name: s.fullName || `${s.lastName || ''} ${s.firstName || ''}`.trim(),
    grade: s.grade || '',
    guardian: s.guardianName || '',
    phone: s.whatsappPhone || s.guardianPhone || '',
    paid,
    empty: paidOff ? [] : VERSEMENTS.filter((v) => amounts[v - 1] <= 0),
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

const parseAmount = (v: string) => Math.max(0, Math.round(Number(String(v).replace(/\D/g, '')) || 0));

export function VersementsView({ school, schoolSlug }: VersementsViewProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [schoolState, setSchoolState] = useState<School>(school);
  const [amounts, setAmounts] = useState<ReminderAmounts>({});
  /** Saisie en cours (pas encore enregistrée), par ligne. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  /** Somme « pour toute la liste », par versement. */
  const [bulk, setBulk] = useState<Record<number, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([1]);
  const [grade, setGrade] = useState('all');
  const [search, setSearch] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const today = todayStr();

  useEffect(() => {
    const load = () => {
      setStudents(getLiveStudents([], schoolSlug));
      setSchoolState(getLiveSchool(schoolSlug, school));
      setAmounts(getReminderAmounts(schoolSlug));
      setUpdatedAt(new Date());
    };
    load();
    // Toujours partir des données de la base (même liste sur tous les appareils).
    syncSchoolDataWithServer(schoolSlug, true);
    window.addEventListener(DATA_UPDATED_EVENT, load);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, load);
  }, [schoolSlug, school]);

  const infos = useMemo(
    () => students.map(toInfo).filter((r): r is StudentInfo => !!r),
    [students]
  );

  const grades = useMemo(() => {
    const used = Array.from(new Set(infos.map((r) => r.grade).filter(Boolean)));
    const known = availableClasses.filter((c) => c !== 'Toutes les classes');
    const extra = used.filter((g) => !known.includes(g)).sort((a, b) => a.localeCompare(b, 'fr'));
    return [...known.filter((g) => used.includes(g)), ...extra];
  }, [infos]);

  const q = normalize(search);
  const matches = (r: StudentInfo) => {
    if (grade !== 'all' && r.grade !== grade) return false;
    if (!q) return true;
    const hay = normalize(`${r.name} ${r.number} ${r.guardian} ${r.phone}`);
    return q.split(/\s+/).every((w) => hay.includes(w));
  };

  const counts = useMemo(() => {
    const c = [0, 0, 0, 0, 0, 0];
    infos.forEach((r) => {
      if (grade === 'all' || r.grade === grade) r.empty.forEach((v) => c[v]++);
    });
    return c;
  }, [infos, grade]);

  const list: Row[] = useMemo(() => {
    const out: Row[] = [];
    infos.filter(matches).forEach((r) => {
      const { empty, ...rest } = r;
      const missing = empty.filter((v) => selected.includes(v));
      if (missing.length > 0) out.push({ ...rest, missing });
    });
    return out.sort(
      (a, b) => grades.indexOf(a.grade) - grades.indexOf(b.grade) || a.name.localeCompare(b.name, 'fr')
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infos, selected, grade, q, grades]);

  const amountOf = (key: string) => amounts[key] || 0;
  const rowTotal = (r: Row) => r.missing.reduce((s, v) => s + amountOf(reminderId(v, r.id)), 0);
  const rowComplete = (r: Row) => r.missing.every((v) => amountOf(reminderId(v, r.id)) > 0);
  const total = list.reduce((s, r) => s + rowTotal(r), 0);
  const withoutAmount = list.filter((r) => !rowComplete(r)).length;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const save = (changes: ReminderAmounts) => {
    try {
      setReminderAmounts(schoolSlug, changes);
      setAmounts(getReminderAmounts(schoolSlug));
      return true;
    } catch (e) {
      showToast('⚠️ La somme n’a pas pu être enregistrée. Vérifiez la connexion et réessayez.');
      return false;
    }
  };

  const commitRow = (key: string) => {
    if (drafts[key] === undefined) return;
    const n = parseAmount(drafts[key]);
    if (n !== amountOf(key)) save({ [key]: n });
    setDrafts((d) => {
      const { [key]: _, ...rest } = d;
      return rest;
    });
  };

  const applyBulk = (v: number) => {
    const n = parseAmount(bulk[v] || '');
    const rows = list.filter((r) => r.missing.includes(v));
    if (!n || rows.length === 0) return;
    const changes: ReminderAmounts = {};
    rows.forEach((r) => (changes[reminderId(v, r.id)] = n));
    if (save(changes)) {
      setBulk((b) => ({ ...b, [v]: '' }));
      showToast(`✓ ${formatFCFA(n)} enregistré pour ${rows.length} élève(s) — ${ORDINAL[v]} versement.`);
    }
  };

  const toggle = (n: number) =>
    setSelected((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort()));

  const selectionLabel =
    selected.length === 0
      ? 'Aucun choix'
      : `${joinOrdinals(selected)} versement${selected.length > 1 ? 's' : ''} non payé${selected.length > 1 ? 's' : ''}`;

  const exportCsv = () => {
    const head = [
      'N°', 'Élève', 'Classe', 'Parent', 'Téléphone', 'Versements non payés',
      ...selected.map((v) => `Somme ${ORDINAL[v]}`), 'Total', 'Déjà versé',
    ];
    const lines = list.map((r) =>
      [
        r.number, r.name, r.grade, r.guardian, r.phone, joinOrdinals(r.missing),
        ...selected.map((v) => (r.missing.includes(v) ? amountOf(reminderId(v, r.id)) || '' : '')),
        rowTotal(r) || '', r.paid,
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

  return (
    <div className="space-y-5">
      <style>{`
        .print-only { display: none; }
        @media print {
          body * { visibility: hidden !important; }
          #versements-print, #versements-print * { visibility: visible !important; }
          #versements-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0 8mm; border: 0 !important; }
          .no-print { display: none !important; }
          .print-only { display: inline !important; }
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
              Élèves dont la case du versement choisi est encore vide dans leur fiche (Inscriptions).
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

      {/* Choix des versements (plusieurs à la fois) */}
      <div className="no-print bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Cochez un ou plusieurs versements</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {VERSEMENTS.map((n) => {
            const on = selected.includes(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => toggle(n)}
                className={`flex flex-col items-start rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                  on ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="text-xs font-bold">{ORDINAL[n]} versement non payé</span>
                <span className="text-xl font-extrabold">{counts[n]}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelected([...VERSEMENTS])}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200"
          >
            Tout cocher
          </button>
          <button
            type="button"
            onClick={() => setSelected([])}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200"
          >
            Tout décocher
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

        {/* Somme d'un versement pour toute la liste affichée */}
        {selected.length > 0 && (
          <div className="rounded-2xl bg-slate-50 p-3 space-y-2">
            <p className="text-xs font-bold text-slate-600">
              Somme du versement pour tous les élèves affichés{grade !== 'all' ? ` (${grade})` : ''} — modifiable ensuite élève par élève
            </p>
            <div className="flex flex-col gap-2">
              {selected.map((v) => {
                const n = list.filter((r) => r.missing.includes(v)).length;
                return (
                  <div key={v} className="flex flex-wrap items-center gap-2">
                    <span className="w-28 text-xs font-bold text-slate-700">{ORDINAL[v]} versement</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={bulk[v] || ''}
                      onChange={(e) => setBulk((b) => ({ ...b, [v]: e.target.value }))}
                      placeholder="Somme en F"
                      className="w-36 px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => applyBulk(v)}
                      disabled={!parseAmount(bulk[v] || '') || n === 0}
                      className="px-3 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Appliquer aux {n} élève(s)
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Liste (imprimable) */}
      <div id="versements-print" className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <p className="text-sm font-extrabold text-slate-900">{schoolState.name}</p>
            <p className="text-xs text-slate-500">
              {selectionLabel}
              {grade !== 'all' ? ` • ${grade}` : ''} • {list.length} élève(s)
              {updatedAt
                ? ` • liste du ${updatedAt.toLocaleDateString('fr-FR')} à ${updatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-rose-600">Total des sommes saisies : {formatFCFA(total)}</p>
            {withoutAmount > 0 && <p className="no-print text-xs text-slate-500">{withoutAmount} élève(s) sans somme saisie</p>}
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
                  <th className="text-left px-3 py-2">Versements non payés</th>
                  <th className="text-right px-3 py-2">Somme</th>
                  <th className="no-print px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((r) => {
                  const amount = rowTotal(r);
                  const complete = rowComplete(r);
                  const several = r.missing.length > 1;
                  const detail = several
                    ? ` (${r.missing.map((v) => `${ORDINAL[v]} : ${formatFCFA(amountOf(reminderId(v, r.id)))}`).join(', ')})`
                    : '';
                  const message = several
                    ? `Bonjour ${r.guardian || ''}, ${schoolState.name} vous rappelle que les ${joinOrdinals(r.missing)} versements de la scolarité de ${r.name} (${r.grade}) ne sont pas encore payés : ${formatFCFA(amount)} au total${detail}. Merci.`
                    : `Bonjour ${r.guardian || ''}, ${schoolState.name} vous rappelle que le ${ORDINAL[r.missing[0]]} versement de la scolarité de ${r.name} (${r.grade}) n'est pas encore payé : ${formatFCFA(amount)}. Merci.`;
                  const link = complete ? waLink(r.phone, message) : null;
                  return (
                    <tr key={r.id} className="align-top">
                      <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{r.number}</td>
                      <td className="px-3 py-2 font-semibold text-slate-900">{r.name}</td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.grade}</td>
                      <td className="px-3 py-2 text-slate-600">
                        <div>{r.guardian}</div>
                        <div className="text-xs text-slate-400">{r.phone}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {r.missing.map((v) => (
                            <span
                              key={v}
                              className="inline-block rounded-md bg-rose-50 px-1.5 py-0.5 text-xs font-bold text-rose-700"
                            >
                              {ORDINAL[v]}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <div className="no-print flex flex-col items-end gap-1">
                          {r.missing.map((v) => {
                            const key = reminderId(v, r.id);
                            const value = amountOf(key);
                            return (
                              <label key={v} className="flex items-center gap-1.5">
                                {several && <span className="w-7 text-right text-[11px] font-bold text-slate-500">{ORDINAL[v]}</span>}
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={drafts[key] !== undefined ? drafts[key] : value ? String(value) : ''}
                                  placeholder="Somme"
                                  onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                                  onBlur={() => commitRow(key)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                  }}
                                  className="w-28 px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-right font-bold text-rose-600"
                                />
                              </label>
                            );
                          })}
                          {several && amount > 0 && (
                            <span className="text-xs font-extrabold text-rose-700">Total : {formatFCFA(amount)}</span>
                          )}
                        </div>
                        <span className="print-only font-bold">
                          {several
                            ? r.missing
                                .map((v) => {
                                  const a = amountOf(reminderId(v, r.id));
                                  return `${ORDINAL[v]} : ${a ? formatFCFA(a) : '—'}`;
                                })
                                .join(' • ') + (amount ? ` = ${formatFCFA(amount)}` : '')
                            : amount
                              ? formatFCFA(amount)
                              : ''}
                        </span>
                      </td>
                      <td className="no-print px-3 py-2 text-right">
                        {link ? (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Rappel WhatsApp au parent"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> Rappel
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              showToast(
                                complete
                                  ? 'Numéro du parent manquant ou incorrect dans la fiche.'
                                  : several
                                    ? 'Entrez d’abord la somme de chaque versement non payé.'
                                    : 'Entrez d’abord la somme du versement.'
                              )
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-slate-400 bg-slate-50"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> Rappel
                          </button>
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
