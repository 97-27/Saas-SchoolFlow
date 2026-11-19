/**
 * Calendrier scolaire (Côte d'Ivoire / UEMOA) : l'année scolaire commence en septembre et se
 * termine en juin–juillet. De septembre à décembre, l'année « 2026-2027 » commence en 2026 ;
 * de janvier à août, la même année scolaire s'est ouverte l'année civile précédente.
 */
export const SCHOOL_YEAR_START_MONTH = 8; // septembre (0 = janvier)

/** Année scolaire correspondant à une date (« AAAA-AAAA+1 »). */
export function academicYearFor(date: Date = new Date()): string {
  const y = date.getFullYear();
  const start = date.getMonth() >= SCHOOL_YEAR_START_MONTH ? y : y - 1;
  return `${start}-${start + 1}`;
}

/** Année scolaire en cours d'après le calendrier (alias lisible). */
export function currentAcademicYear(): string {
  return academicYearFor(new Date());
}

/** Année suivant celle fournie (« 2026-2027 » → « 2027-2028 »). */
export function nextAcademicYear(year: string): string {
  const m = /^(\d{4})-(\d{4})$/.exec(String(year || '').trim());
  if (!m) return academicYearFor(new Date(new Date().getFullYear() + 1, SCHOOL_YEAR_START_MONTH, 1));
  return `${Number(m[1]) + 1}-${Number(m[2]) + 1}`;
}

/** Fin de chaque trimestre (dates « AAAA-MM-JJ » saisies dans Paramètres). */
export interface TermEnds {
  t1?: string;
  t2?: string;
  t3?: string;
}

const TERM_LABELS = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];

/**
 * Trimestre actif selon les dates de fin : le premier trimestre dont la date de fin n'est pas
 * encore dépassée (le jour de la date de fin inclus). Sans dates : null (le choix manuel reste).
 */
export function activeTermFromDates(ends: TermEnds | undefined, now: Date = new Date()): string | null {
  if (!ends) return null;
  const list = [ends.t1, ends.t2, ends.t3];
  if (!list.some(Boolean)) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  for (let i = 0; i < 3; i++) {
    const d = list[i];
    if (!d) continue;
    const end = new Date(d + 'T23:59:59').getTime();
    if (!isNaN(end) && end >= today) return TERM_LABELS[i];
  }
  return TERM_LABELS[2];
}

/** Jours restants avant la fin du trimestre actif (null si inconnu) + nom du trimestre qui suit. */
export function termEndInfo(ends: TermEnds | undefined, now: Date = new Date()): { term: string; daysLeft: number; next: string | null; endDate: string } | null {
  const term = activeTermFromDates(ends, now);
  if (!term || !ends) return null;
  const idx = TERM_LABELS.indexOf(term);
  const d = [ends.t1, ends.t2, ends.t3][idx];
  if (!d) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const daysLeft = Math.round((new Date(d + 'T00:00:00').getTime() - today) / 86400000);
  return { term, daysLeft, next: idx < 2 ? TERM_LABELS[idx + 1] : null, endDate: d };
}

/**
 * Vrai si le calendrier est déjà passé à une année scolaire plus récente que celle de l'école
 * (la direction doit alors lancer « Nouvelle année scolaire » : archivage + remise à zéro).
 */
export function isSchoolYearBehind(schoolYear: string, now: Date = new Date()): boolean {
  const m = /^(\d{4})-\d{4}$/.exec(String(schoolYear || '').trim());
  if (!m) return false;
  return Number(m[1]) < Number(academicYearFor(now).slice(0, 4));
}
