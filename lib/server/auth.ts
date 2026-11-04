import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, SessionPayload, verifySessionToken } from './session';

/**
 * Règles d'accès communes aux routes API. Toute route qui lit ou écrit des données d'école
 * DOIT passer par requireSession() : la session signée est la seule source fiable du rôle et
 * de l'établissement de l'appelant (jamais le slug ou le rôle envoyés par le navigateur).
 */

export const ADMIN_ROLES = ['fondateur', 'directeur'];
export const STAFF_ROLES = ['fondateur', 'directeur', 'assistant_direction', 'secretaire', 'comptable', 'enseignant', 'educateur'];
/**
 * Rôles autorisés à créer / modifier des fiches élèves et des encaissements : Fondateur,
 * Directeur et Comptable SEULEMENT (choix de l'établissement). Secrétaire, Assistant(e) et
 * Éducateur consultent leurs pages sans rien modifier ; l'Enseignant saisit notes et appel.
 */
export const STUDENT_WRITE_ROLES = ['fondateur', 'directeur', 'comptable'];
/** Rôles en consultation seule (aucune écriture, sauf l'appel pour l'Éducateur). */
export const READ_ONLY_ROLES = ['secretaire', 'assistant_direction', 'educateur'];
/** Rôles autorisés à supprimer des élèves ou des encaissements. */
export const DELETE_ROLES = ['fondateur', 'directeur', 'comptable'];
/** Rôles autorisés à modifier l'internat, la cantine, le transport et les échéanciers. */
export const SERVICES_WRITE_ROLES = ['fondateur', 'directeur', 'comptable'];

export function canonicalSlug(slug: string | null | undefined): string {
  if (!slug) return '';
  return slug === 'college-excellence' ? 'epc-manoi' : slug;
}

export function isAdmin(session: SessionPayload): boolean {
  return ADMIN_ROLES.includes(session.roleId);
}

export function isStaff(session: SessionPayload): boolean {
  return STAFF_ROLES.includes(session.roleId);
}

export function hasRole(session: SessionPayload, roles: string[]): boolean {
  return roles.includes(session.roleId);
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function getSession(request: NextRequest): Promise<SessionPayload | null> {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
}

/**
 * Vérifie la session et, si un slug est fourni, qu'il correspond bien à l'établissement de la
 * session (un utilisateur d'une école ne peut jamais lire ou écrire les données d'une autre).
 */
export async function requireSession(
  request: NextRequest,
  requestedSlug?: string | null
): Promise<{ session: SessionPayload; slug: string } | { error: NextResponse }> {
  const session = await getSession(request);
  if (!session) return { error: jsonError('Session absente ou expirée. Veuillez vous reconnecter.', 401) };

  const sessionSlug = canonicalSlug(session.slug);
  if (requestedSlug && canonicalSlug(requestedSlug) !== sessionSlug) {
    return { error: jsonError('Accès refusé : cet établissement ne correspond pas à votre session.', 403) };
  }

  if (sessionSlug !== 'epc-manoi' && session.subscriptionEndDate) {
    const end = new Date(session.subscriptionEndDate).getTime();
    if (!isNaN(end) && Date.now() > end) {
      return { error: jsonError('Abonnement expiré. Veuillez renouveler votre abonnement.', 402) };
    }
  }

  return { session, slug: sessionSlug };
}

/**
 * Limiteur de tentatives simple en mémoire (par instance serveur). Il ne remplace pas un vrai
 * limiteur partagé, mais freine fortement les essais de codes en rafale.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(key: string, maxAttempts = 10, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > maxAttempts;
}

/**
 * Connexion : seuls les ÉCHECS comptent, et par personne (adresse + école + poste + nom).
 * Avant, chaque tentative — même réussie — comptait pour toute l'adresse Internet ; or chez les
 * opérateurs mobiles beaucoup de téléphones partagent la même adresse : quelques connexions du
 * personnel suffisaient à bloquer tout le monde 10 minutes (« Trop de tentatives »).
 */
const loginFailures = new Map<string, { count: number; resetAt: number }>();
const LOGIN_MAX_FAILURES = 8;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

export function isLoginBlocked(key: string): boolean {
  const entry = loginFailures.get(key);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    loginFailures.delete(key);
    return false;
  }
  return entry.count >= LOGIN_MAX_FAILURES;
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const entry = loginFailures.get(key);
  if (!entry || now > entry.resetAt) loginFailures.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  else entry.count += 1;
}

export function clearLoginFailures(key: string): void {
  loginFailures.delete(key);
}

export function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
