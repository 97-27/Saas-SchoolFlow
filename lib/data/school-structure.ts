/**
 * Structure de l'école : cycles accueillis (Maternelle, Primaire, Secondaire), classes de chaque cycle,
 * frais d'inscription par cycle et scolarité par classe. Tout le logiciel se base sur ce module :
 * un cycle non activé dans Paramètres n'apparaît plus dans les listes de classes.
 */
import type { School } from '@/lib/data/types';
import { setAvailableClasses } from '@/lib/data/mock-data';
import { setTeacherClasses } from '@/lib/data/teaching';

export type CycleId = 'maternelle' | 'primaire' | 'secondaire';

export const CYCLE_LABELS: Record<CycleId, string> = {
  maternelle: 'Maternelle',
  primaire: 'Primaire',
  secondaire: 'Secondaire',
};

export const MATERNELLE_CLASSES = ['Maternelle (P.S.)', 'Maternelle (M.S.)', 'Maternelle (G.S.)'];
export const PRIMAIRE_CLASSES = ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'];
/** Niveaux du premier cycle du secondaire : le nombre de classes (6ème 1, 6ème 2…) se règle dans Paramètres, jusqu'à 10. */
export const SECONDAIRE_LEVELS = ['6ème', '5ème', '4ème', '3ème'];
/** Séries du second cycle (2nde → Terminale). */
export const SECONDAIRE_SERIES = ['2nde A', '2nde C', '1ère A', '1ère C', '1ère D', 'Terminale A', 'Terminale C', 'Terminale D'];
export const MAX_SECTIONS = 10;

export const cycleActive = (school: Partial<School> | null | undefined, id: CycleId): boolean => {
  const s = school || {};
  if (id === 'maternelle') return s.hasMaternelle ?? true;
  if (id === 'primaire') return s.hasPrimaire ?? true;
  return s.hasSecondaire ?? ((s.hasCollege ?? true) || (s.hasLycee ?? false));
};

export const activeCycles = (school: Partial<School> | null | undefined): CycleId[] =>
  (['maternelle', 'primaire', 'secondaire'] as CycleId[]).filter((c) => cycleActive(school, c));

/** Nombre de classes d'un niveau (1 → « 6ème », 3 → « 6ème 1 », « 6ème 2 », « 6ème 3 »). */
export const sectionCount = (school: Partial<School> | null | undefined, level: string) => {
  const n = Math.round(Number(school?.sectionCounts?.[level] ?? 1));
  return Math.min(MAX_SECTIONS, Math.max(1, Number.isFinite(n) ? n : 1));
};

export function classesOfLevel(school: Partial<School> | null | undefined, level: string): string[] {
  const n = sectionCount(school, level);
  return n <= 1 ? [level] : Array.from({ length: n }, (_, i) => `${level} ${i + 1}`);
}

export function classesOfCycle(school: Partial<School> | null | undefined, cycle: CycleId): string[] {
  if (cycle === 'maternelle') return [...MATERNELLE_CLASSES];
  if (cycle === 'primaire') return [...PRIMAIRE_CLASSES];
  return [...SECONDAIRE_LEVELS.flatMap((l) => classesOfLevel(school, l)), ...SECONDAIRE_SERIES];
}

/** Toutes les classes des cycles activés, dans l'ordre. */
export function classesForSchool(school: Partial<School> | null | undefined): string[] {
  return activeCycles(school).flatMap((c) => classesOfCycle(school, c));
}

/** Cycle d'une classe d'après son nom (gère aussi les anciens noms « 6ème », « Terminale »…). */
export function cycleOfGrade(grade: string): CycleId | null {
  const g = String(grade || '').toLowerCase();
  if (!g) return null;
  if (g.includes('maternelle') || /\b(p\.?s\.?|m\.?s\.?|g\.?s\.?)\b/.test(g)) return 'maternelle';
  if (/^(cp|ce|cm)\s?\d/.test(g)) return 'primaire';
  if (/^(6|5|4|3)\s?(e|è)/.test(g) || /^(2nde|seconde|1(e|è)re|premi|terminale|tle)/.test(g)) return 'secondaire';
  return null;
}

/** Frais d'inscription du cycle de cette classe (0 = non renseigné). */
export function registrationFeeForGrade(school: Partial<School> | null | undefined, grade: string): number {
  const c = cycleOfGrade(grade);
  const v = c ? Number(school?.registrationFeeByCycle?.[c] ?? 0) : 0;
  return v > 0 ? v : 0;
}

/** Scolarité annuelle de cette classe (0 = non renseignée). Un tarif de niveau (« 6ème ») s'applique à ses classes (« 6ème 3 »). */
export function tuitionForGrade(school: Partial<School> | null | undefined, grade: string): number {
  const t = school?.tuitionByClass || {};
  const direct = Number(t[grade] ?? 0);
  if (direct > 0) return direct;
  const level = SECONDAIRE_LEVELS.find((l) => grade.startsWith(`${l} `));
  const lv = level ? Number(t[level] ?? 0) : 0;
  return lv > 0 ? lv : 0;
}

const CONFESSION_LABELS: Record<string, string> = {
  islamique: 'École confessionnelle islamique',
  catholique: 'École confessionnelle catholique',
  laique: 'École laïque',
  non_confessionnelle: 'École laïque',
};
/** Libellé de la confession pour la carte scolaire (islamique par défaut, comme les Paramètres). */
export const confessionLabel = (school: Partial<School> | null | undefined) => CONFESSION_LABELS[school?.schoolType || 'islamique'] || '';

let lastSignature = '';
/** Met à jour les listes de classes utilisées partout (menus déroulants, filtres) d'après les cycles activés. */
export function syncClassCatalog(school: Partial<School> | null | undefined): void {
  if (!school) return;
  const list = classesForSchool(school);
  const sig = list.join('|');
  if (sig === lastSignature) return;
  lastSignature = sig;
  setAvailableClasses(list.length ? list : [...MATERNELLE_CLASSES, ...PRIMAIRE_CLASSES]);
  setTeacherClasses(list.length ? list : [...MATERNELLE_CLASSES, ...PRIMAIRE_CLASSES]);
}
