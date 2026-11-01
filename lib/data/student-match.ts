import type { Student } from '@/lib/data/types';

/**
 * Règle unique de SchoolFlow : un élève est identifié par son identifiant (id, numéro de dossier,
 * matricule), JAMAIS par son seul nom. Deux enfants peuvent porter exactement le même nom (ex :
 * deux « BAMBA Awa », l'une en CE2, l'autre en 6ème) : les fusionner faisait disparaître l'un des
 * deux des listes et des effectifs, ou rattachait les paiements de l'un à la fiche de l'autre.
 */

/** Nom normalisé : minuscules, sans accents ni ponctuation, ordre des mots indifférent. */
export const normalizePersonName = (name: string | undefined | null): string =>
  (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');

export const studentDisplayName = (s: Pick<Student, 'fullName' | 'lastName' | 'firstName'>): string =>
  s.fullName || `${s.lastName || ''} ${s.firstName || ''}`;

/** Téléphone réduit à ses 8 derniers chiffres (ignore +225, espaces, tirets). */
export const normalizePhone = (phone: string | undefined | null): string => (phone || '').replace(/\D/g, '').slice(-8);

interface StudentRef {
  id?: string | null;
  studentNumber?: string | null;
  matricule?: string | null;
  name?: string | null;
}

/**
 * Retrouve la fiche d'un élève à partir d'une référence (facture, abonnement, reçu).
 * 1. Par identifiant, numéro de dossier ou matricule.
 * 2. Sinon par le nom, UNIQUEMENT si un seul élève porte ce nom (sinon on ne devine pas).
 */
export function findStudentByRef<T extends Student>(students: T[], ref: StudentRef): T | undefined {
  const id = (ref.id || '').trim();
  const num = (ref.studentNumber || '').trim();
  const mat = (ref.matricule || '').trim();

  const byKey = students.find(
    (s) =>
      (id && (s.id === id || s.studentNumber === id)) ||
      (num && s.studentNumber === num) ||
      (mat && s.matricule && s.matricule === mat)
  );
  if (byKey) return byKey;

  const wanted = normalizePersonName(ref.name);
  if (!wanted) return undefined;
  const named = students.filter((s) => normalizePersonName(studentDisplayName(s)) === wanted);
  return named.length === 1 ? named[0] : undefined;
}
