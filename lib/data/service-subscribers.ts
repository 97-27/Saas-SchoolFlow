import type { Student } from '@/lib/data/types';
import { resolveBoarders, type BoardingPaymentsMap } from '@/lib/data/boarding';
import { getLiveInvoices } from '@/lib/data/live-store';

/**
 * Abonnés d'un service (Internat, Cantine, Transport) avec leurs mois payés — lus dans les mêmes
 * données que les pages Internat / Cantine / Transport, pour la page « Suivi des versements ».
 */

export type ServiceId = 'internat' | 'cantine' | 'transport';

export const SERVICE_MONTHS = ['Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai'];

export interface ServiceSubscriber {
  id: string;
  number: string;
  name: string;
  grade: string;
  guardian: string;
  phone: string;
  monthlyRate: number;
  months: Record<string, boolean>;
  paidMonthsCount: number;
}

const KEYS: Record<ServiceId, { sub: string; pay: string; defaultRate: number }> = {
  internat: { sub: 'schoolflow_boarding_subscriptions_v3', pay: 'schoolflow_boarding_monthly_payments_v3', defaultRate: 25000 },
  cantine: { sub: 'schoolflow_canteen_subscriptions_v3', pay: 'schoolflow_canteen_monthly_payments_v3', defaultRate: 25000 },
  transport: { sub: 'schoolflow_transport_subscriptions_v2', pay: 'schoolflow_transport_monthly_payments_v2', defaultRate: 35000 },
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const contact = (s: Student) => ({
  guardian: s.guardianName || '',
  phone: s.whatsappPhone || s.guardianPhone || '',
});

export function loadServiceSubscribers(service: ServiceId, students: Student[], schoolSlug: string): ServiceSubscriber[] {
  if (typeof window === 'undefined') return [];
  const pilot = !schoolSlug || schoolSlug === 'epc-manoi';
  const k = KEYS[service];
  const subKey = pilot ? k.sub : `${k.sub}_${schoolSlug}`;
  const payKey = pilot ? k.pay : `${k.pay}_${schoolSlug}`;
  const invoices = getLiveInvoices([], schoolSlug);
  const out: ServiceSubscriber[] = [];

  if (service === 'internat') {
    const subs = readJson<any[]>(subKey, []);
    const pays = readJson<BoardingPaymentsMap>(payKey, {});
    for (const b of resolveBoarders(students, Array.isArray(subs) ? subs : [], pays, invoices)) {
      const s = b.student;
      if (!s || (s.status && s.status !== 'active')) continue;
      out.push({
        id: s.id,
        number: s.studentNumber || '',
        name: s.fullName || `${s.lastName || ''} ${s.firstName || ''}`.trim(),
        grade: s.grade || '',
        ...contact(s),
        monthlyRate: b.monthlyRate,
        months: b.months,
        paidMonthsCount: b.paidMonthsCount,
      });
    }
    return out;
  }

  const subMap = readJson<Record<string, { rate?: number }>>(subKey, {});
  const payMap = readJson<Record<string, Record<string, boolean>>>(payKey, {});
  const tag = service === 'cantine' ? { fee: 'Cantine', prefix: 'CAN-', word: 'cantine' } : { fee: 'Transport', prefix: 'TRP-', word: 'transport' };
  const invoiceIds = new Set(
    invoices
      .filter((inv: any) => inv.feeType === tag.fee || inv.invoiceNumber?.startsWith(tag.prefix) || inv.notes?.toLowerCase().includes(tag.word))
      .map((inv: any) => inv.studentId)
  );
  for (const s of students) {
    if (s.status && s.status !== 'active') continue;
    const months = payMap[s.id] || {};
    const custom = subMap[s.id];
    const hasPaid = Object.values(months).some(Boolean);
    if (!custom && !hasPaid && !invoiceIds.has(s.id) && !invoiceIds.has(s.studentNumber)) continue;
    out.push({
      id: s.id,
      number: s.studentNumber || '',
      name: s.fullName || `${s.lastName || ''} ${s.firstName || ''}`.trim(),
      grade: s.grade || '',
      ...contact(s),
      monthlyRate: Number(custom?.rate) > 0 ? Number(custom!.rate) : k.defaultRate,
      months,
      paidMonthsCount: SERVICE_MONTHS.filter((m) => months[m]).length,
    });
  }
  return out;
}
