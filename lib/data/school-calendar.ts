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

/**
 * Vrai si le calendrier est déjà passé à une année scolaire plus récente que celle de l'école
 * (la direction doit alors lancer « Nouvelle année scolaire » : archivage + remise à zéro).
 */
export function isSchoolYearBehind(schoolYear: string, now: Date = new Date()): boolean {
  const m = /^(\d{4})-\d{4}$/.exec(String(schoolYear || '').trim());
  if (!m) return false;
  return Number(m[1]) < Number(academicYearFor(now).slice(0, 4));
}
