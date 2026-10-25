import { Student, Invoice } from '@/lib/data/types';
import { LEGACY_DEMO_STUDENT_IDS } from '@/lib/data/legacy-ids';

/**
 * ══════════════════════════════════════════════════════════════════
 * INTERNAT : CALCUL UNIQUE DES PENSIONNAIRES ET DES MONTANTS
 * ══════════════════════════════════════════════════════════════════
 * La page Internat, le Tableau de bord et la Structure des encaissements calculaient chacun
 * de leur côté « qui est pensionnaire » et « combien a été payé », avec des règles différentes :
 * un même élève référencé par son identifiant interne sur un appareil et par son numéro (ID-001)
 * ailleurs était compté deux fois, et ses mois payés introuvables affichaient 0 F. Les trois
 * écrans utilisent désormais ce seul calcul.
 */

// 9 mois scolaires officiels (Septembre à Mai)
export const BOARDING_MONTHS = [
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
];

export const DEFAULT_BOARDING_RATE = 25000;

export interface BoardingSubscriptionLike {
  studentId: string;
  studentName?: string;
  matricule?: string;
  className?: string;
  gender?: 'M' | 'F';
  monthlyRate?: number;
  [key: string]: unknown;
}

export type BoardingPaymentsMap = Record<string, Record<string, boolean>>;

export interface ResolvedBoarder {
  /** Identifiant unique du pensionnaire (id réel de l'élève, ou de l'abonnement s'il n'a pas de fiche). */
  key: string;
  student?: Student;
  sub?: BoardingSubscriptionLike;
  months: Record<string, boolean>;
  paidMonthsCount: number;
  monthlyRate: number;
  /** Montant payé selon les mois cochés. */
  paidFromMonths: number;
  /** Plus grand montant payé figurant sur une quittance d'internat de l'élève. */
  invoicePaid: number;
  totalPaid: number;
  totalDue: number;
  remainingBalance: number;
  gender: 'female' | 'male';
}

const normalizeName = (name: string | undefined) =>
  (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');

/** Retrouve la fiche élève d'un abonnement : par identifiant, numéro de dossier, matricule, puis nom. */
export function findBoardingStudent(students: Student[], sub: BoardingSubscriptionLike): Student | undefined {
  const byKey = students.find(
    (s) =>
      s.id === sub.studentId ||
      (Boolean(sub.studentId) && s.studentNumber === sub.studentId) ||
      (Boolean(sub.matricule) && Boolean(s.matricule) && s.matricule === sub.matricule)
  );
  if (byKey) return byKey;
  const subName = normalizeName(sub.studentName);
  return subName ? students.find((s) => normalizeName(s.fullName || `${s.lastName} ${s.firstName}`) === subName) : undefined;
}

/**
 * Mois payés d'un élève, quelle que soit la clé sous laquelle ils ont été enregistrés (identifiant
 * interne, numéro de dossier ou matricule). Une entrée vide n'arrête plus la recherche.
 */
export function getBoardingMonths(payments: BoardingPaymentsMap, keys: Array<string | undefined>): Record<string, boolean> {
  let firstFound: Record<string, boolean> | undefined;
  for (const key of keys) {
    if (!key) continue;
    const months = payments[key];
    if (!months || typeof months !== 'object') continue;
    if (Object.values(months).some(Boolean)) return months;
    if (!firstFound) firstFound = months;
  }
  return firstFound || {};
}

const isBoardingInvoice = (inv: Invoice) =>
  (inv.feeType || '').toLowerCase().includes('internat') ||
  (inv.invoiceNumber || '').startsWith('QUI-INT-') ||
  (inv.id || '').startsWith('inv-boarding-');

/** Liste unique des pensionnaires et de leurs montants (une entrée par élève). */
export function resolveBoarders(
  students: Student[],
  subscriptions: BoardingSubscriptionLike[],
  payments: BoardingPaymentsMap,
  invoices: Invoice[] = []
): ResolvedBoarder[] {
  const result: ResolvedBoarder[] = [];
  const seen = new Set<string>();
  const boardingInvoices = invoices.filter(isBoardingInvoice);

  const build = (student: Student | undefined, sub: BoardingSubscriptionLike | undefined): ResolvedBoarder => {
    const keys = [sub?.studentId, student?.id, student?.studentNumber, sub?.matricule, student?.matricule];
    const months = getBoardingMonths(payments, keys);
    const paidMonthsCount = BOARDING_MONTHS.filter((m) => months[m]).length;
    const monthlyRate =
      typeof sub?.monthlyRate === 'number' && sub.monthlyRate > 0 ? sub.monthlyRate : DEFAULT_BOARDING_RATE;
    const paidFromMonths = paidMonthsCount * monthlyRate;
    const keySet = new Set(keys.filter(Boolean) as string[]);
    const invoicePaid = boardingInvoices
      .filter((inv) => keySet.has(inv.studentId))
      .reduce((max, inv) => Math.max(max, inv.paidAmount || 0), 0);
    const totalPaid = Math.max(paidFromMonths, invoicePaid);
    const totalDue = monthlyRate * BOARDING_MONTHS.length;
    const isFemale = student ? student.gender === 'female' : sub?.gender === 'F';
    return {
      key: student?.id || `sub:${sub?.studentId}`,
      student,
      sub,
      months,
      paidMonthsCount,
      monthlyRate,
      paidFromMonths,
      invoicePaid,
      totalPaid,
      totalDue,
      remainingBalance: Math.max(0, totalDue - totalPaid),
      gender: isFemale ? 'female' : 'male',
    };
  };

  // 1. Abonnements d'internat (un seul par élève, même s'il est référencé par plusieurs clés)
  for (const sub of subscriptions || []) {
    if (!sub || !sub.studentId) continue;
    const student = findBoardingStudent(students, sub);
    // Abonnement d'une ancienne copie d'élève sans fiche réelle correspondante : ignoré.
    if (!student && LEGACY_DEMO_STUDENT_IDS.has(sub.studentId)) continue;
    // Abonnement sans fiche élève ni nom : impossible à afficher, donc jamais compté.
    if (!student && !sub.studentName) continue;
    const key = student ? student.id : `sub:${sub.studentId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(build(student, sub));
  }

  // 2. Élèves sans abonnement mais avec de vrais mois d'internat payés
  for (const student of students) {
    if (!student || seen.has(student.id)) continue;
    const months = getBoardingMonths(payments, [student.id, student.studentNumber, student.matricule]);
    if (!BOARDING_MONTHS.some((m) => months[m])) continue;
    seen.add(student.id);
    result.push(build(student, undefined));
  }

  return result;
}
