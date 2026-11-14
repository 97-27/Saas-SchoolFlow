import type { Invoice } from '@/lib/data/types';

/**
 * Règlements mensuels des services (cantine, transport) — un encaissement = un mois.
 *
 * Avant, la cantine et le transport réécrivaient UNE seule facture par élève (id fixe
 * « inv-canteen-<élève> ») avec le cumul de tous les mois déjà réglés : le journal et les
 * totaux affichaient donc « tous les mois » au lieu du mois que le parent vient de payer.
 * Ici, chaque mois nouvellement coché produit sa propre facture : montant du mois, date,
 * moyen de paiement et coordonnées du parent.
 */

export const SCHOOL_MONTHS = [
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
] as const;

const MONTH_CODES: Record<string, string> = {
  Septembre: 'SEP',
  Octobre: 'OCT',
  Novembre: 'NOV',
  Décembre: 'DEC',
  Janvier: 'JAN',
  Février: 'FEV',
  Mars: 'MAR',
  Avril: 'AVR',
  Mai: 'MAI',
};

const FIRST_HALF_MONTHS = ['Septembre', 'Octobre', 'Novembre', 'Décembre'];

/** Année scolaire 2026-2027 : sept.-déc. en 2026, janv.-mai en 2027. */
export function schoolMonthYear(month: string): string {
  return FIRST_HALF_MONTHS.includes(month) ? '2026' : '2027';
}

export const SERVICE_MONTH_NOTE_PREFIX = 'Mois réglé : ';

/** Libellé porté par la facture : « Mois réglé : Novembre 2026 » (un seul mois). */
export function serviceMonthNote(month: string): string {
  return `${SERVICE_MONTH_NOTE_PREFIX}${month} ${schoolMonthYear(month)}`;
}

/** Mois d'une facture créée par règlement mensuel ; null pour les anciennes factures cumulées. */
export function monthFromServiceNote(notes?: string | null): string | null {
  if (!notes || !notes.startsWith(SERVICE_MONTH_NOTE_PREFIX)) return null;
  const month = notes.slice(SERVICE_MONTH_NOTE_PREFIX.length).trim().split(' ')[0];
  return (SCHOOL_MONTHS as readonly string[]).includes(month) ? month : null;
}

export interface ServiceMonthPaymentInput {
  service: 'cantine' | 'transport' | 'internat';
  studentId: string;
  studentNumber?: string;
  fullName: string;
  avatar?: string;
  grade: string;
  gender: string;
  guardianName?: string;
  guardianPhone?: string;
  enrollmentType?: string;
  month: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string; // YYYY-MM-DD
}

/** Construit la facture d'UN mois réglé (numéro unique, montant du mois seulement). */
export function buildServiceMonthInvoice(input: ServiceMonthPaymentInput): Invoice {
  const prefix = input.service === 'cantine' ? 'CAN' : input.service === 'internat' ? 'INT' : 'TRP';
  const digits = (input.studentNumber || input.studentId || '').replace(/\D/g, '').slice(-4) || '001';
  const monthCode = MONTH_CODES[input.month] || 'XXX';
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  const monthIndex = String((SCHOOL_MONTHS as readonly string[]).indexOf(input.month) + 1).padStart(2, '0');
  return {
    id: `inv-${input.service}-${input.studentId}-${monthIndex}-${stamp}`,
    invoiceNumber: `${prefix}-${digits}-${monthCode}-${stamp}`,
    studentId: input.studentId,
    studentName: input.fullName,
    studentAvatar: input.avatar || '/avatars/default.png',
    studentGrade: input.grade,
    studentGender: input.gender === 'female' ? 'female' : 'male',
    guardianName: input.guardianName || 'Parent / Tuteur',
    guardianPhone: input.guardianPhone || '',
    feeType: input.service === 'cantine' ? 'Cantine' : input.service === 'internat' ? 'Internat & Pensionnat' : 'Transport',
    amount: input.amount,
    discountAmount: 0,
    netAmount: input.amount,
    paidAmount: input.amount,
    balanceRemaining: 0,
    paymentMethod: input.paymentMethod || 'Espèces',
    enrollmentType: input.enrollmentType === 'ancien' ? 'ancien' : 'nouveau',
    issueDate: input.paymentDate,
    dueDate: input.paymentDate,
    status: 'paid',
    notes: serviceMonthNote(input.month),
  };
}
