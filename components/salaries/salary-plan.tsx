'use client';

import React, { useMemo } from 'react';
import { CalendarDays, Users } from 'lucide-react';
import { formatFCFA } from '@/lib/utils/formatters';
import { Figure } from '@/components/ui/masked-figure';

/**
 * Plan salarial annuel : pour chaque membre du personnel, le salaire mensuel donné par la
 * comptabilité ; le logiciel calcule ce qui est dû sur l'année scolaire, ce qui est déjà versé
 * (d'après les reçus émis) et ce qui reste à verser. Récapitulatif mois par mois des reçus.
 */

export type PlanStaff = { id: string; fullName: string; matricule?: string; role?: string };
export type PlanReceipt = { receiptNumber: string; staffName: string; matricule: string; payPeriod: string; netSalary: number };

const norm = (s: string) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(mr|mme|mlle|m)\b\.?/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function matchesStaff(staff: PlanStaff, r: PlanReceipt): boolean {
  if (staff.matricule && r.matricule && staff.matricule.trim().toUpperCase() === r.matricule.trim().toUpperCase()) return true;
  const a = norm(staff.fullName);
  const b = norm(r.staffName);
  return !!a && a === b;
}

export function computeSalaryPlan(staff: PlanStaff[], plan: Record<string, number>, receipts: PlanReceipt[], periods: string[]) {
  const rows = staff.map((s) => {
    const monthly = Number(plan[s.id]) || 0;
    const due = monthly * periods.length;
    const paid = receipts.filter((r) => matchesStaff(s, r)).reduce((sum, r) => sum + (Number(r.netSalary) || 0), 0);
    return { staff: s, monthly, due, paid, remaining: Math.max(0, due - paid) };
  });
  const totalDue = rows.reduce((a, r) => a + r.due, 0);
  const totalPaid = rows.reduce((a, r) => a + r.paid, 0);
  return { rows, totalDue, totalPaid, totalRemaining: Math.max(0, totalDue - totalPaid) };
}

export function SalaryPlan({
  staff,
  plan,
  onPlanChange,
  receipts,
  periods,
  canEdit,
}: {
  staff: PlanStaff[];
  plan: Record<string, number>;
  onPlanChange: (staffId: string, monthly: number) => void;
  receipts: PlanReceipt[];
  periods: string[];
  canEdit: boolean;
}) {
  const data = useMemo(() => computeSalaryPlan(staff, plan, receipts, periods), [staff, plan, receipts, periods]);
  const months = useMemo(
    () =>
      periods.map((p) => {
        const list = receipts.filter((r) => r.payPeriod === p);
        return { period: p, count: list.length, total: list.reduce((a, r) => a + (Number(r.netSalary) || 0), 0), numbers: list.map((r) => r.receiptNumber) };
      }),
    [periods, receipts]
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 print:hidden">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 font-heading">Plan salarial de l’année</h2>
            <p className="text-[11px] text-slate-500">Saisissez le salaire mensuel de chaque membre ; le reste à verser se calcule tout seul ({periods.length} mois).</p>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs min-w-[560px]">
            <thead>
              <tr className="bg-slate-100/90 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-2 px-3">Membre</th>
                <th className="py-2 px-3 w-32">Salaire / mois</th>
                <th className="py-2 px-3 text-right">Dû (année)</th>
                <th className="py-2 px-3 text-right">Versé</th>
                <th className="py-2 px-3 text-right">Reste</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">Aucun membre du personnel enregistré.</td>
                </tr>
              ) : (
                data.rows.map((r) => (
                  <tr key={r.staff.id}>
                    <td className="py-2 px-3">
                      <span className="font-bold text-slate-900 block leading-tight">{r.staff.fullName}</span>
                      <span className="text-[10px] text-slate-400">{r.staff.role}</span>
                    </td>
                    <td className="py-1.5 px-3">
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        inputMode="numeric"
                        autoComplete="off"
                        disabled={!canEdit}
                        value={r.monthly || ''}
                        placeholder="0"
                        onChange={(e) => onPlanChange(r.staff.id, Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 font-mono font-bold text-slate-900 disabled:bg-slate-50"
                      />
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-slate-700"><Figure>{formatFCFA(r.due)}</Figure></td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-700"><Figure>{formatFCFA(r.paid)}</Figure></td>
                    <td className={`py-2 px-3 text-right font-mono font-extrabold ${r.remaining > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      <Figure>{formatFCFA(r.remaining)}</Figure>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 text-white font-extrabold">
                <td className="py-2.5 px-3" colSpan={2}>TOTAL ANNÉE</td>
                <td className="py-2.5 px-3 text-right font-mono"><Figure>{formatFCFA(data.totalDue)}</Figure></td>
                <td className="py-2.5 px-3 text-right font-mono"><Figure>{formatFCFA(data.totalPaid)}</Figure></td>
                <td className="py-2.5 px-3 text-right font-mono text-amber-300"><Figure>{formatFCFA(data.totalRemaining)}</Figure></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CalendarDays className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 font-heading">Reçus émis mois par mois</h2>
            <p className="text-[11px] text-slate-500">Les reçus de chaque mois et leur total : {receipts.length} reçu(s) émis sur l’année.</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
          {months.map((m) => (
            <div key={m.period} className="flex items-start gap-3 px-3 py-2 text-xs">
              <span className="w-32 shrink-0 font-bold text-slate-800">{m.period}</span>
              <span className="flex-1 min-w-0 text-[11px] text-slate-500 break-words">{m.count > 0 ? m.numbers.join(' · ') : '—'}</span>
              <span className="shrink-0 text-right">
                <span className="block font-mono font-bold text-slate-900"><Figure>{formatFCFA(m.total)}</Figure></span>
                <span className="text-[10px] text-slate-400">{m.count} reçu(s)</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
