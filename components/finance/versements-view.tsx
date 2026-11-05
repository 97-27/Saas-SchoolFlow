'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Student, School } from '@/lib/data/types';
import { formatFCFA } from '@/lib/utils/formatters';
import {
  getLiveStudents,
  getLiveSchool,
  syncSchoolDataWithServer,
  DATA_UPDATED_EVENT,
} from '@/lib/data/live-store';
import { Printer, Download, Search, Wallet, MessageCircle, RefreshCw } from 'lucide-react';

interface VersementsViewProps {
  school: School;
  schoolSlug: string;
}

/** 1 à 5 : prochain versement attendu ; 0 : scolarité soldée. */
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
  paidCount: number;
  due: number;
  lastDate: string;
};

const ORDINAL = ['', '1er', '2e', '3e', '4e', '5e'];

function toRow(s: Student): Row | null {
  if (!s || (s.status && s.status !== 'active')) return null;
  const inst: any = s.installments || {};
  const amounts = [1, 2, 3, 4, 5].map((i) => Number(inst[`versement${i}`]?.amount) || 0);
  const dates = [1, 2, 3, 4, 5].map((i) => String(inst[`versement${i}`]?.date || '')).filter(Boolean);
  const paidCount = amounts.filter((a) => a > 0).length;
  const paidFromInstallments = amounts.reduce((a, b) => a + b, 0);
  const paid = paidFromInstallments > 0 ? paidFromInstallments : Number(s.paidAmount) || 0;
  const net = Number(s.netAmount) || Math.max(0, (Number(s.tuitionAmount) || 0) - (Number(s.discountAmount) || 0));
  const remaining = Math.max(0, net - paid);
  // Scolarité non renseignée (0) : on ne peut pas dire que l'élève doit quelque chose, sauf s'il
  // n'a encore rien versé (il doit alors son 1er versement).
  const owes = net > 0 ? remaining > 0 : paidCount === 0;
  const due = owes ? Math.min(5, paidCount + 1) : 0;
  return {
    id: s.id,
    number: s.studentNumber || '',
    name: s.fullName || `${s.lastName || ''} ${s.firstName || ''}`.trim(),
    grade: s.grade || '',
    guardian: s.guardianName || '',
    phone: s.whatsappPhone || s.guardianPhone || '',
    net,
    paid,
    remaining,
    paidCount,
    due,
    lastDate: dates.sort().pop() || '',
  };
}

function waLink(phone: string, text: string): string | null {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length < 8) return null;
  if (d.length === 10 && d.startsWith('0')) d = `225${d}`;
  else if (d.length === 8) d = `225${d}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

export function VersementsView({ school, schoolSlug }: VersementsViewProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [schoolState, setSchoolState] = useState<School>(school);
  const [selected, setSelected] = useState<number[]>([1]);
  const [grade, setGrade] = useState('all');
  const [search, setSearch] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    const load = () => {
      setStudents(getLiveStudents([], schoolSlug));
      setSchoolState(getLiveSchool(schoolSlug, school));
      setUpdatedAt(new Date());
    };
    load();
    // Toujours partir des données de la base (même liste sur tous les appareils).
    syncSchoolDataWithServer(schoolSlug, true);
    window.addEventListener(DATA_UPDATED_EVENT, load);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, load);
  }, [schoolSlug, school]);

  const rows = useMemo(() => students.map(toRow).filter((r): r is Row => !!r), [students]);

  const grades = useMemo(
    () => Array.from(new Set(rows.map((r) => r.grade).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fr')),
    [rows]
  );

  const counts = useMemo(() => {
    const c = [0, 0, 0, 0, 0, 0];
    rows.forEach((r) => {
      if (grade === 'all' || r.grade === grade) c[r.due]++;
    });
    return c;
  }, [rows, grade]);

  const list = useMemo(() => {
    const q = search
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim();
    return rows
      .filter((r) => selected.includes(r.due))
      .filter((r) => grade === 'all' || r.grade === grade)
      .filter((r) => {
        if (!q) return true;
        const hay = `${r.name} ${r.number} ${r.guardian} ${r.phone}`
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '');
        return q.split(/\s+/).every((w) => hay.includes(w));
      })
      .sort((a, b) => a.due - b.due || a.grade.localeCompare(b.grade, 'fr') || a.name.localeCompare(b.name, 'fr'));
  }, [rows, selected, grade, search]);

  const totalRemaining = list.reduce((s, r) => s + r.remaining, 0);

  const toggle = (n: number) =>
    setSelected((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort()));

  const selectionLabel =
    selected.length === 0
      ? 'Aucun choix'
      : selected.map((n) => (n === 0 ? 'scolarité soldée' : `${ORDINAL[n]} versement`)).join(', ');

  const exportCsv = () => {
    const head = ['N°', 'Élève', 'Classe', 'Parent', 'Téléphone', 'Versement dû', 'Scolarité nette', 'Déjà versé', 'Reste à payer', 'Dernier versement'];
    const lines = list.map((r) =>
      [
        r.number,
        r.name,
        r.grade,
        r.guardian,
        r.phone,
        r.due === 0 ? 'Soldé' : `${ORDINAL[r.due]} versement`,
        r.net,
        r.paid,
        r.remaining,
        r.lastDate,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(';')
    );
    const csv = '﻿' + [head.join(';'), ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `versements-${schoolSlug}-${new Date().toISOString().slice(0, 10)}.csv`;
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
          #versements-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0 8mm; }
          .no-print { display: none !important; }
          #versements-print table { font-size: 11px; }
          #versements-print tr { break-inside: avoid; }
        }
      `}</style>

      {/* En-tête */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Suivi des versements</h1>
            <p className="text-xs text-slate-500">
              Élèves qui doivent leur 1er, 2e, 3e, 4e ou 5e versement de scolarité — à jour sur tous les appareils.
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
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Cochez un ou plusieurs versements
        </p>
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
              {grade !== 'all' ? ` • ${grade}` : ''} • {list.length} élève(s)
              {updatedAt ? ` • liste du ${updatedAt.toLocaleDateString('fr-FR')} à ${updatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}
            </p>
          </div>
          <p className="text-sm font-bold text-rose-600">Reste à encaisser : {formatFCFA(totalRemaining)}</p>
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
                  <th className="text-right px-3 py-2">Déjà versé</th>
                  <th className="text-right px-3 py-2">Reste</th>
                  <th className="no-print px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((r) => {
                  const link = waLink(
                    r.phone,
                    `Bonjour ${r.guardian || ''}, ${schoolState.name} vous rappelle que le ${
                      r.due ? `${ORDINAL[r.due]} versement` : 'versement'
                    } de la scolarité de ${r.name} (${r.grade}) est attendu. Reste à payer : ${formatFCFA(r.remaining)}. Merci.`
                  );
                  return (
                    <tr key={r.id} className="align-top">
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
                          <span className="text-xs font-bold text-emerald-700">{ORDINAL[r.due]} versement</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{formatFCFA(r.paid)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap font-bold text-rose-600">{formatFCFA(r.remaining)}</td>
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
