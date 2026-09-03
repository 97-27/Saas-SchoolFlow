import React from 'react';
import { InvoiceStatus } from '@/lib/data/types';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  switch (status) {
    case 'paid':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Payée
        </span>
      );
    case 'sent':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/80">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Envoyée
        </span>
      );
    case 'draft':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          Brouillon
        </span>
      );
    case 'overdue':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          En retard
        </span>
      );
    default:
      return null;
  }
}

export function GenderBadge({ gender }: { gender: 'male' | 'female' }) {
  if (gender === 'male') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/70">
        <span className="text-[11px]">♂</span> M
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-bold bg-pink-50 text-pink-700 border border-pink-200/70">
      <span className="text-[11px]">♀</span> F
    </span>
  );
}

export function TrendBadge({
  value,
  isPositiveGood = true,
}: {
  value: number;
  isPositiveGood?: boolean;
}) {
  const isPositive = value >= 0;
  const isGood = isPositive ? isPositiveGood : !isPositiveGood;

  const bgClass = isGood ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70' : 'bg-rose-50 text-rose-700 border-rose-200/70';
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${bgClass}`}>
      <Icon className="w-3.5 h-3.5 stroke-[2.5]" />
      <span>{isPositive ? `+${value}%` : `${value}%`}</span>
    </span>
  );
}
