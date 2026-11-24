/**
 * Circuit de validation des notes (étape 1 du circuit notes → moyennes → bulletins).
 *
 * 1. L'enseignant saisit ses notes puis les CLÔTURE pour (classe, matière, trimestre).
 *    Une fois clôturées, elles ne peuvent plus être modifiées par l'enseignant.
 * 2. La Direction voit l'état de chaque matière, peut ROUVRIR une matière (correction) et
 *    peut valider les bulletins même s'il reste des matières non clôturées.
 * 3. Les enseignants ne peuvent valider les bulletins (étape 2) que si TOUTES les matières
 *    de la classe sont clôturées.
 *
 * Une clé par (classe, matière, trimestre) : deux enseignants qui clôturent en même temps
 * des matières différentes ne s'écrasent donc jamais.
 */
import { broadcastLiveUpdate } from '@/lib/data/live-store';

export const GRADES_SUBMIT_BASE = 'schoolflow_grades_submit_v1';

export interface GradesSubmission {
  by: string;
  at: string; // ISO
}

export function gradesSubmissionKey(schoolSlug: string, className: string, subject: string, term: string): string {
  const clean = (s: string) => s.replace(/\s+/g, '_');
  return `${GRADES_SUBMIT_BASE}_${schoolSlug}_${clean(className)}_${clean(subject)}_${clean(term)}`;
}

export function getGradesSubmission(schoolSlug: string, className: string, subject: string, term: string): GradesSubmission | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(gradesSubmissionKey(schoolSlug, className, subject, term));
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && v.at ? (v as GradesSubmission) : null;
  } catch {
    return null;
  }
}

/** Clôture (by renseigné) ou rouvre (by = null) une matière. */
export function setGradesSubmission(
  schoolSlug: string,
  className: string,
  subject: string,
  term: string,
  by: string | null
): void {
  if (typeof window === 'undefined') return;
  const key = gradesSubmissionKey(schoolSlug, className, subject, term);
  try {
    if (by) localStorage.setItem(key, JSON.stringify({ by, at: new Date().toISOString() } satisfies GradesSubmission));
    else localStorage.setItem(key, 'null');
    broadcastLiveUpdate({ action: 'grades_submission_updated', keys: [key], schoolSlug });
  } catch {
    /* stockage plein ou indisponible */
  }
}
