import { getStaffAuthRecords } from '@/lib/supabase/services';
import { kvGet, kvPut } from '@/lib/supabase/kv';
import { FIGURES_VISIBLE_ROLES } from '@/lib/auth/roles';

/**
 * Code des chiffres (6 chiffres fixés par le Fondateur / DGA ; à défaut leur code personnel) :
 * vérification partagée par /api/auth/figures (chiffres globaux) et /api/archives (archives des
 * années scolaires). Même compteur d'essais EN BASE : 3 codes faux → 30 minutes de blocage,
 * quelle que soit la page où le code est tapé.
 */
export const FIGURES_MAX_FAILURES = 3;
export const FIGURES_LOCK_MS = 30 * 60 * 1000;
export const FIGURES_POLICY_KEY = 'sf_private_figures_policy';

/** archivesCode : code à 6 chiffres des Archives des années (Comptable) ; vide = code des chiffres. */
export type FiguresPolicy = { open: boolean; changedAt: number; code: string; archivesCode: string };
export type CodeKind = 'figures' | 'archives';
export type FiguresAttempts = { failures: number; lockedUntil: number };

export async function readFiguresPolicy(schoolId: string): Promise<FiguresPolicy> {
  const empty: FiguresPolicy = { open: false, changedAt: 0, code: '', archivesCode: '' };
  const row = await kvGet(schoolId, FIGURES_POLICY_KEY);
  if (!row) return empty;
  try {
    const v = JSON.parse(row.value);
    const six = (x: unknown) => (typeof x === 'string' && /^\d{6}$/.test(x) ? x : '');
    return { open: v.open === true, changedAt: Number(v.changedAt) || 0, code: six(v.code), archivesCode: six(v.archivesCode) };
  } catch {
    return empty;
  }
}

export function figuresAttemptsKey(session: { staffId?: string; code: string }) {
  return `sf_private_figures_attempts_${session.staffId || session.code}`;
}

export async function readFiguresAttempts(schoolId: string, key: string): Promise<FiguresAttempts | null> {
  const row = await kvGet(schoolId, key);
  if (row === undefined) return null; // lecture impossible
  if (!row) return { failures: 0, lockedUntil: 0 };
  try {
    const v = JSON.parse(row.value);
    return { failures: Number(v.failures) || 0, lockedUntil: Number(v.lockedUntil) || 0 };
  } catch {
    return { failures: 0, lockedUntil: 0 };
  }
}

export type FiguresCheck =
  | { ok: true }
  | { ok: false; status: number; error: string; lockedUntil?: number };

/** Vérifie le code tapé par un poste qui doit le saisir (Comptable). */
export async function verifyFiguresCode(
  slug: string,
  schoolId: string,
  session: { roleId: string; staffId?: string; code: string },
  rawCode: string,
  kind: CodeKind = 'figures'
): Promise<FiguresCheck> {
  const key = figuresAttemptsKey(session);
  const attempts = await readFiguresAttempts(schoolId, key);
  if (!attempts) return { ok: false, status: 503, error: 'Vérification impossible pour le moment. Réessayez.' };

  const now = Date.now();
  if (attempts.lockedUntil > now) {
    return { ok: false, status: 429, error: 'Saisie du code bloquée après 3 essais incorrects.', lockedUntil: attempts.lockedUntil };
  }
  if (attempts.lockedUntil && attempts.lockedUntil <= now) attempts.failures = 0;

  const inputCode = String(rawCode || '').trim().toUpperCase();
  if (!inputCode) return { ok: false, status: 400, error: 'Veuillez saisir le code.' };

  const policy = await readFiguresPolicy(schoolId);
  let validCodes: string[];
  // Archives : leur propre code s'il existe, sinon le code des chiffres, sinon le code personnel
  // du Fondateur / DGA.
  const dedicated = kind === 'archives' ? policy.archivesCode || policy.code : policy.code;
  if (dedicated) {
    validCodes = [dedicated];
  } else {
    const staff = await getStaffAuthRecords(slug);
    validCodes = staff
      .filter((s) => FIGURES_VISIBLE_ROLES.includes(s.roleId))
      .map((s) => String(s.authCode || '').trim().toUpperCase())
      .filter(Boolean);
  }
  if (validCodes.length === 0) {
    return { ok: false, status: 409, error: "Aucun code des chiffres n'est configuré pour cet établissement." };
  }

  const actor = `${session.roleId}|${session.staffId || ''}`;
  if (!validCodes.includes(inputCode)) {
    const failures = attempts.failures + 1;
    const lockedUntil = failures >= FIGURES_MAX_FAILURES ? now + FIGURES_LOCK_MS : 0;
    await kvPut(schoolId, key, JSON.stringify({ failures, lockedUntil }), actor);
    await new Promise((r) => setTimeout(r, 400));
    if (lockedUntil) {
      return { ok: false, status: 429, error: 'Code incorrect. Saisie bloquée pendant 30 minutes.', lockedUntil };
    }
    const left = FIGURES_MAX_FAILURES - failures;
    return { ok: false, status: 403, error: `Code incorrect. Il vous reste ${left} essai${left > 1 ? 's' : ''}.` };
  }

  if (attempts.failures || attempts.lockedUntil) {
    await kvPut(schoolId, key, JSON.stringify({ failures: 0, lockedUntil: 0 }), actor);
  }
  return { ok: true };
}
