/**
 * Matières et classes des enseignants : liste UNIQUE partagée par Administration & Codes (fiche
 * de l'enseignant), la page de connexion (cases cochées) et le serveur (/api/auth/login), qui
 * vérifie que ce que l'enseignant coche correspond à sa fiche. Aucun import serveur ici.
 */
export const TEACHER_SUBJECTS = [
  'Français',
  'Arabe',
  'Anglais',
  'Mathématiques',
  'Physique-Chimie',
  'SVT',
  'Histoire-Géographie',
  'Éducation civique et morale',
  'Éducation islamique',
  'Coran',
  'Espagnol',
  'Allemand',
  'Informatique',
  'EPS',
  'Arts plastiques',
  'Musique',
  'Toutes les matières (Primaire / Maternelle)',
];

export const TEACHER_CLASSES = [
  'Maternelle (P.S.)',
  'Maternelle (M.S.)',
  'Maternelle (G.S.)',
  'CP1',
  'CP2',
  'CE1',
  'CE2',
  'CM1',
  'CM2',
  '6ème',
  '5ème',
  '4ème',
  '3ème',
  '2nde',
  '1ère',
  'Terminale',
];

const norm = (s: string) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** « Français, SVT » → ['Français', 'SVT'] */
export function splitTeachingList(raw: string | undefined | null): string[] {
  return String(raw || '')
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** La fiche dit « toutes » (matières ou classes) : tout est accepté. */
export function teachingAllowsAll(raw: string | undefined | null): boolean {
  const n = norm(raw || '');
  return !n || n.startsWith('toutes les') || n === 'toutes' || n === 'tout';
}

/**
 * Chaque élément coché doit figurer sur la fiche (comparaison sans accents ni majuscules).
 * Renvoie la liste des éléments refusés (vide = tout est conforme).
 */
export function teachingMismatches(recordRaw: string | undefined | null, chosen: string[]): string[] {
  if (teachingAllowsAll(recordRaw)) return [];
  const allowed = new Set(splitTeachingList(recordRaw).map(norm));
  return chosen.filter((c) => c.trim() && !allowed.has(norm(c)));
}
