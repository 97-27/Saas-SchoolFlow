/**
 * Tranches d'effectif choisies par l'école au moment de l'abonnement.
 * (Les tarifs par tranche ne sont pas encore fixés : seule la tranche est enregistrée.)
 */
export type StudentTierId = 't1' | 't2' | 't3' | 't4' | 't5';

export interface StudentTier {
  id: StudentTierId;
  label: string;
  min: number;
  /** null = sans limite haute. */
  max: number | null;
  hint: string;
}

export const STUDENT_TIERS: StudentTier[] = [
  { id: 't1', label: '0 à 300 élèves', min: 0, max: 300, hint: 'Petite école' },
  { id: 't2', label: '300 à 500 élèves', min: 300, max: 500, hint: 'École moyenne' },
  { id: 't3', label: '500 à 1 000 élèves', min: 500, max: 1000, hint: 'Grande école' },
  { id: 't4', label: '1 000 à 5 000 élèves', min: 1000, max: 5000, hint: 'Groupe scolaire' },
  { id: 't5', label: '5 000 élèves et plus', min: 5000, max: null, hint: 'Réseau / grand groupe' },
];

export function tierById(id: string | null | undefined): StudentTier | null {
  return STUDENT_TIERS.find((t) => t.id === id) || null;
}

export function isStudentTierId(id: unknown): id is StudentTierId {
  return typeof id === 'string' && STUDENT_TIERS.some((t) => t.id === id);
}

/** Tranche qui correspond à un effectif réel (frontières : 300 → t1, 500 → t2, etc.). */
export function tierForCount(count: number): StudentTier {
  const n = Math.max(0, Math.floor(count || 0));
  return STUDENT_TIERS.find((t) => t.max === null || n <= t.max) || STUDENT_TIERS[STUDENT_TIERS.length - 1];
}

/** Vrai si l'effectif réel dépasse la tranche souscrite. */
export function exceedsTier(count: number, tierId: string | null | undefined): boolean {
  const t = tierById(tierId);
  if (!t || t.max === null) return false;
  return count > t.max;
}
