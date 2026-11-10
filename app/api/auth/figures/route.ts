import { NextRequest, NextResponse } from 'next/server';
import { getStaffUsersFromSupabase } from '@/lib/supabase/services';
import { jsonError, requireSession } from '@/lib/server/auth';
import { FIGURES_UNLOCK_ROLES, FIGURES_VISIBLE_ROLES } from '@/lib/auth/roles';
import { kvSchoolId, kvGet, kvPut } from '@/lib/supabase/kv';

export const dynamic = 'force-dynamic';

/**
 * Chiffres globaux (totaux encaissés, recettes du jour, structure des encaissements…) :
 * en clair pour le Fondateur et le Fondateur adjoint. Le Comptable peut les afficher avec le
 * code du Fondateur (ou du Fondateur adjoint) : 3 codes faux → saisie bloquée 30 minutes.
 * Tous les autres postes ne les voient jamais.
 *
 * Le compteur d'essais est gardé EN BASE (school_kv, clé hors des familles synchronisées donc
 * jamais lisible ni modifiable depuis un navigateur) : Vercel fait tourner plusieurs serveurs
 * en parallèle, un compteur en mémoire se remettrait à zéro d'un serveur à l'autre.
 *
 * GET  → { roleId, lockedUntil }
 * POST → { code }
 */
const MAX_FAILURES = 3;
const LOCK_MS = 30 * 60 * 1000;

type Attempts = { failures: number; lockedUntil: number };

function attemptsKey(session: { staffId?: string; code: string }) {
  return `sf_private_figures_attempts_${session.staffId || session.code}`;
}

async function readAttempts(schoolId: string, key: string): Promise<Attempts | null> {
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

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if ('error' in auth) return auth.error;
  const { session, slug } = auth;
  let lockedUntil = 0;
  if (FIGURES_UNLOCK_ROLES.includes(session.roleId)) {
    const schoolId = await kvSchoolId(slug);
    const a = schoolId ? await readAttempts(schoolId, attemptsKey(session)) : null;
    if (a && a.lockedUntil > Date.now()) lockedUntil = a.lockedUntil;
  }
  return NextResponse.json(
    { success: true, roleId: session.roleId, lockedUntil },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if ('error' in auth) return auth.error;
  const { session, slug } = auth;

  if (FIGURES_VISIBLE_ROLES.includes(session.roleId)) return NextResponse.json({ success: true });
  if (!FIGURES_UNLOCK_ROLES.includes(session.roleId)) {
    return jsonError('Les chiffres globaux sont réservés au Fondateur.', 403);
  }

  const schoolId = await kvSchoolId(slug);
  if (!schoolId) return jsonError('Vérification impossible pour le moment. Réessayez.', 503);
  const key = attemptsKey(session);
  const attempts = await readAttempts(schoolId, key);
  if (!attempts) return jsonError('Vérification impossible pour le moment. Réessayez.', 503);

  const now = Date.now();
  if (attempts.lockedUntil > now) {
    return NextResponse.json(
      { success: false, error: 'Saisie du code bloquée après 3 essais incorrects.', lockedUntil: attempts.lockedUntil },
      { status: 429 }
    );
  }
  // Blocage terminé : nouveau départ à 3 essais.
  if (attempts.lockedUntil && attempts.lockedUntil <= now) attempts.failures = 0;

  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return jsonError('Requête invalide.', 400);
  }
  const inputCode = String(body?.code || '').trim().toUpperCase();
  if (!inputCode) return jsonError('Veuillez saisir le code.', 400);

  const staff = await getStaffUsersFromSupabase(slug);
  const validCodes = staff
    .filter((s) => FIGURES_VISIBLE_ROLES.includes(s.roleId))
    .map((s) => String(s.authCode || '').trim().toUpperCase())
    .filter(Boolean);
  if (validCodes.length === 0) {
    return jsonError("Aucun code Fondateur n'est configuré pour cet établissement.", 409);
  }

  const actor = `${session.roleId}|${session.staffId || ''}`;
  if (!validCodes.includes(inputCode)) {
    const failures = attempts.failures + 1;
    const lockedUntil = failures >= MAX_FAILURES ? now + LOCK_MS : 0;
    await kvPut(schoolId, key, JSON.stringify({ failures, lockedUntil }), actor);
    await new Promise((r) => setTimeout(r, 400));
    if (lockedUntil) {
      return NextResponse.json(
        { success: false, error: 'Code incorrect. Saisie bloquée pendant 30 minutes.', lockedUntil },
        { status: 429 }
      );
    }
    const left = MAX_FAILURES - failures;
    return jsonError(`Code incorrect. Il vous reste ${left} essai${left > 1 ? 's' : ''}.`, 403);
  }

  if (attempts.failures || attempts.lockedUntil) {
    await kvPut(schoolId, key, JSON.stringify({ failures: 0, lockedUntil: 0 }), actor);
  }
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
}
