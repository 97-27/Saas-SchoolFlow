'use client';

import React, { useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { formatFCFA } from '@/lib/utils/formatters';
import { Figure } from '@/components/ui/masked-figure';

/**
 * Bilan financier d'un service (Internat, Cantine, Transport) : sommes accumulées, élèves soldés,
 * répartition par nombre de mois payés (0 à 9) et situation mois par mois, avec graphiques.
 * Même présentation pour les trois services.
 */

const SCHOOL_MONTHS = ['Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai'];

export interface ServiceBilanRow {
  id: string;
  name: string;
  grade?: string;
  paidMonthsCount: number;
  totalPaid: number;
  totalDue: number;
  monthlyRate: number;
  monthsState?: Record<string, boolean>;
}

type Accent = 'emerald' | 'amber' | 'sky';

const ACCENT: Record<Accent, { bar: string; soft: string; text: string; border: string }> = {
  emerald: { bar: 'bg-emerald-500', soft: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  amber: { bar: 'bg-amber-500', soft: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  sky: { bar: 'bg-sky-500', soft: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200' },
};

export function ServiceBilan({ title, rows, accent = 'emerald' }: { title: string; rows: ServiceBilanRow[]; accent?: Accent }) {
  const [showSettled, setShowSettled] = useState(false);
  const c = ACCENT[accent];

  const data = useMemo(() => {
    const total = rows.length;
    const collected = rows.reduce((a, r) => a + r.totalPaid, 0);
    const due = rows.reduce((a, r) => a + r.totalDue, 0);
    const remaining = Math.max(0, due - collected);
    const settled = rows
      .filter((r) => r.totalDue > 0 && r.totalPaid >= r.totalDue)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
    // Répartition : nombre d'élèves par nombre de mois payés (0 à 9)
    const byCount = Array.from({ length: 10 }, (_, n) => rows.filter((r) => Math.min(9, r.paidMonthsCount) === n).length);
    // Mois par mois : élèves ayant payé ce mois, et montant correspondant
    const byMonth = SCHOOL_MONTHS.map((m) => {
      const paying = rows.filter((r) => r.monthsState?.[m]);
      return { month: m, count: paying.length, amount: paying.reduce((a, r) => a + r.monthlyRate, 0) };
    });
    const rate = due > 0 ? Math.round((collected / due) * 1000) / 10 : 0;
    return { total, collected, due, remaining, settled, byCount, byMonth, rate };
  }, [rows]);

  const maxCount = Math.max(1, ...data.byCount);
  const maxMonth = Math.max(1, ...data.byMonth.map((m) => m.count));

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs p-4 sm:p-5 space-y-4 print:hidden">
      <div className="flex items-center gap-2.5">
        <div className={`w-9 h-9 rounded-xl ${c.soft} ${c.text} flex items-center justify-center shrink-0`}>
          <BarChart3 className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-extrabold text-slate-900 font-heading">{title}</h2>
          <p className="text-[11px] text-slate-500">Ce qui est rentré, ce qui reste à encaisser et les élèves soldés.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={`rounded-xl border ${c.border} ${c.soft} p-3`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total encaissé</p>
          <p className={`text-base sm:text-lg font-extrabold font-heading ${c.text}`}>
            <Figure>{formatFCFA(data.collected)}</Figure>
          </p>
          <p className="text-[10px] text-slate-500">
            sur <Figure>{formatFCFA(data.due)}</Figure> attendus
          </p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Reste à encaisser</p>
          <p className="text-base sm:text-lg font-extrabold font-heading text-rose-800">
            <Figure>{formatFCFA(data.remaining)}</Figure>
          </p>
          <p className="text-[10px] text-slate-500">Recouvrement : {data.rate}%</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Élèves soldés</p>
          <p className="text-base sm:text-lg font-extrabold font-heading text-emerald-800">
            {data.settled.length} <span className="text-xs font-semibold text-slate-500">/ {data.total}</span>
          </p>
          <p className="text-[10px] text-slate-500">9 mois entièrement payés</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">En cours de paiement</p>
          <p className="text-base sm:text-lg font-extrabold font-heading text-slate-800">{Math.max(0, data.total - data.settled.length)}</p>
          <p className="text-[10px] text-slate-500">à jour ou en retard</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Répartition par nombre de mois payés */}
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-bold text-slate-800 mb-2">Élèves selon le nombre de mois payés</p>
          <div className="flex items-end gap-1.5 h-32">
            {data.byCount.map((n, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
                <span className="text-[10px] font-bold text-slate-700 mb-0.5">{n}</span>
                <div
                  className={`w-full rounded-t-md ${i === 9 ? 'bg-emerald-500' : c.bar}`}
                  style={{ height: `${Math.max(n > 0 ? 6 : 2, (n / maxCount) * 100)}%`, opacity: n > 0 ? 1 : 0.25 }}
                  title={`${n} élève(s) ayant payé ${i} mois`}
                />
                <span className="text-[10px] text-slate-500 mt-1">{i}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-1 text-center">Nombre de mois payés (0 à 9)</p>
        </div>

        {/* Mois par mois */}
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-bold text-slate-800 mb-2">Situation mois par mois (du 1er au 9e mois)</p>
          <div className="space-y-1.5">
            {data.byMonth.map((m, i) => (
              <div key={m.month} className="flex items-center gap-2">
                <span className="w-[74px] shrink-0 text-[10px] font-semibold text-slate-600">
                  {i + 1}. {m.month.slice(0, 4)}.
                </span>
                <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${(m.count / maxMonth) * 100}%` }} />
                </div>
                <span className="w-28 shrink-0 text-right text-[10px] font-bold text-slate-700">
                  {m.count} élève(s) · <Figure>{formatFCFA(m.amount)}</Figure>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowSettled((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4" />
          Élèves soldés ({data.settled.length})
          {showSettled ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showSettled && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.settled.length === 0 ? (
              <span className="text-xs text-slate-500">Aucun élève soldé pour le moment.</span>
            ) : (
              data.settled.map((r) => (
                <span key={r.id} className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-900">
                  {r.name}
                  {r.grade ? <span className="text-emerald-600 font-medium"> · {r.grade}</span> : null}
                </span>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
