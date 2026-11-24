'use client';

import React, { useMemo, useState } from 'react';
import { CalendarDays, Pencil, Plus, Trash2, Users, Check, X } from 'lucide-react';
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
  extraIds = [],
  onAddMember,
  onEditMember,
  onRemoveMember,
  receipts,
  periods,
  canEdit,
}: {
  staff: PlanStaff[];
  plan: Record<string, number>;
  onPlanChange: (staffId: string, monthly: number) => void;
  extraIds?: string[];
  onAddMember?: (fullName: string, role: string, monthly: number) => void;
  onEditMember?: (id: string, fullName: string, role: string) => void;
  onRemoveMember?: (id: string) => void;
  receipts: PlanReceipt[];
  periods: string[];
  canEdit: boolean;
}) {
  const data = useMemo(() => computeSalaryPlan(staff, plan, receipts, periods), [staff, plan, receipts, periods]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Enseignant');
  const [newMonthly, setNewMonthly] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const submitNew = () => {
    if (!newName.trim()) return;
    onAddMember?.(newName, newRole, Math.max(0, parseInt(newMonthly, 10) || 0));
    setNewName('');
    setNewRole('Enseignant');
    setNewMonthly('');
    setAdding(false);
  };
  const months = useMemo(
    () =>
      periods.map((p) => {
        const list = receipts.filter((r) => r.payPeriod === p);
        return { period: p, count: list.length, total: list.reduce((a, r) => a + (Number(r.netSalary) || 0), 0), numbers: list.map((r) => r.receiptNumber) };
      }),
    [periods, receipts]
  );

  return (
    <div className="grid grid-cols-1 gap-5 print:hidden">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-extrabold text-slate-900 font-heading">Plan salarial de l’année</h2>
            <p className="text-[11px] text-slate-500">Saisissez le salaire mensuel de chaque membre ; le reste à verser se calcule tout seul ({periods.length} mois : {periods[0]?.split(' ')[0]} → {periods[periods.length - 1]?.split(' ')[0]}).</p>
          </div>
          {canEdit && onAddMember && (
            <button type="button" onClick={() => setAdding((v) => !v)} className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold">
              <Plus className="w-3.5 h-3.5" /> Ajouter un membre
            </button>
          )}
        </div>
        {adding && (
          <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_0.8fr_auto] gap-2 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom complet" autoComplete="off" className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-bold" />
            <input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="Fonction (Enseignant…)" autoComplete="off" className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs" />
            <input value={newMonthly} onChange={(e) => setNewMonthly(e.target.value.replace(/\D/g, ''))} placeholder="Salaire / mois" inputMode="numeric" autoComplete="off" className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-mono font-bold" />
            <button type="button" onClick={submitNew} disabled={!newName.trim()} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-extrabold disabled:opacity-40">
              Enregistrer
            </button>
          </div>
        )}
        <div className="overflow-x-auto scrollbar-top rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs min-w-[640px]">
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
                      {editId === r.staff.id ? (
                        <div className="flex flex-col gap-1">
                          <input value={editName} onChange={(e) => setEditName(e.target.value)} className="px-2 py-1 rounded border border-slate-300 text-xs font-bold" />
                          <input value={editRole} onChange={(e) => setEditRole(e.target.value)} className="px-2 py-1 rounded border border-slate-300 text-[11px]" />
                          <span className="flex gap-1">
                            <button type="button" onClick={() => { onEditMember?.(r.staff.id, editName, editRole); setEditId(null); }} className="p-1 rounded bg-emerald-600 text-white"><Check className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => setEditId(null)} className="p-1 rounded bg-slate-200 text-slate-700"><X className="w-3.5 h-3.5" /></button>
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-start gap-1.5">
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 block leading-tight">{r.staff.fullName}</span>
                            <span className="text-[10px] text-slate-400">{r.staff.role}</span>
                          </div>
                          {canEdit && extraIds.includes(r.staff.id) && (
                            <span className="flex gap-0.5 shrink-0">
                              <button type="button" title="Modifier" onClick={() => { setEditId(r.staff.id); setEditName(r.staff.fullName); setEditRole(r.staff.role || ''); }} className="p-1 rounded hover:bg-slate-100 text-slate-500"><Pencil className="w-3 h-3" /></button>
                              <button type="button" title="Retirer" onClick={() => onRemoveMember?.(r.staff.id)} className="p-1 rounded hover:bg-rose-50 text-rose-500"><Trash2 className="w-3 h-3" /></button>
                            </span>
                          )}
                        </div>
                      )}
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
            <div key={m.period} className="px-3 py-2.5 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-slate-800">{m.period}</span>
                <span className="text-right">
                  <span className="font-mono font-extrabold text-slate-900"><Figure>{formatFCFA(m.total)}</Figure></span>
                  <span className="ml-2 text-[10px] text-slate-400">{m.count} reçu(s)</span>
                </span>
              </div>
              {m.count > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {m.numbers.map((n) => (
                    <span key={n} className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] font-mono text-slate-600">{n}</span>
                  ))}
                </div>
              ) : (
                <p className="mt-0.5 text-[10.5px] text-slate-400">Aucun reçu émis ce mois-ci.</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
