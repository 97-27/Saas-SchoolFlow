import { NextRequest, NextResponse } from 'next/server';
import { getStaffAuthRecords as getStaffUsersFromSupabase } from '@/lib/supabase/services';
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

/**
 * Interrupteur du Fondateur / Fondateur adjoint (Administration & Codes) : « chiffres ouverts au
 * Comptable ». Ouvert → le Comptable voit les chiffres sans code. Fermé → masqués aussitôt, y
 * compris un déverrouillage par code en cours (changedAt plus récent que le déverrouillage).
 * Clé hors des familles synchronisées : seul ce serveur la lit et l'écrit.
 */
const POLICY_KEY = 'sf_private_figures_policy';
/**
 * code : code à 6 chiffres des chiffres, fixé (et changé quand il veut) par le Fondateur ou le
 * DGA, et donné au Comptable. Tant qu'il n'existe pas, le code du Fondateur / DGA sert.
 * Changer le code referme aussitôt un déverrouillage en cours (changedAt).
 */
type Policy = { open: boolean; changedAt: number; code: string };

async function readPolicy(schoolId: string): Promise<Policy> {
  const row = await kvGet(schoolId, POLICY_KEY);
  if (!row) return { open: false, changedAt: 0, code: '' };
  try {
    const v = JSON.parse(row.value);
    return {
      open: v.open === true,
      changedAt: Number(v.changedAt) || 0,
      code: typeof v.code === 'string' && /^\d{6}$/.test(v.code) ? v.code : '',
    };
  } catch {
    return { open: false, changedAt: 0, code: '' };
  }
}

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
  let policy: Policy = { open: false, changedAt: 0, code: '' };
  const concerned = FIGURES_UNLOCK_ROLES.includes(session.roleId) || FIGURES_VISIBLE_ROLES.includes(session.roleId);
  if (concerned) {
    const schoolId = await kvSchoolId(slug);
    if (schoolId) {
      policy = await readPolicy(schoolId);
      if (FIGURES_UNLOCK_ROLES.includes(session.roleId)) {
        const a = await readAttempts(schoolId, attemptsKey(session));
        if (a && a.lockedUntil > Date.now()) lockedUntil = a.lockedUntil;
      }
    }
  }
  return NextResponse.json(
    {
      success: true,
      roleId: session.roleId,
      lockedUntil,
      openToComptable: policy.open,
      policyChangedAt: policy.changedAt,
      // Le code n'est renvoyé qu'au Fondateur et au DGA (pour le donner au Comptable).
      ...(FIGURES_VISIBLE_ROLES.includes(session.roleId) ? { figuresCode: policy.code } : {}),
      hasFiguresCode: !!policy.code,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

/** Fondateur / Fondateur adjoint : ouvrir ou fermer les chiffres au Comptable. */
export async function PUT(request: NextRequest) {
  const auth = await requireSession(request);
  if ('error' in auth) return auth.error;
  const { session, slug } = auth;
  if (!FIGURES_VISIBLE_ROLES.includes(session.roleId)) {
    return jsonError('Réservé au Fondateur et au Fondateur adjoint.', 403);
  }
  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return jsonError('Requête invalide.', 400);
  }
  const hasOpen = typeof body?.open === 'boolean';
  const hasCode = body?.code !== undefined;
  if (!hasOpen && !hasCode) return jsonError('Requête invalide.', 400);
  const schoolId = await kvSchoolId(slug);
  if (!schoolId) return jsonError('Enregistrement impossible pour le moment. Réessayez.', 503);
  const current = await readPolicy(schoolId);
  const policy: Policy = { ...current, changedAt: Date.now() };
  if (hasOpen) policy.open = body.open;
  if (hasCode) {
    if (body.code === 'generate') policy.code = String(Math.floor(100000 + Math.random() * 900000));
    else if (typeof body.code === 'string' && /^\d{6}$/.test(body.code.trim())) policy.code = body.code.trim();
    else return jsonError('Le code doit contenir exactement 6 chiffres.', 400);
  }
  const saved = await kvPut(schoolId, POLICY_KEY, JSON.stringify(policy), `${session.roleId}|${session.staffId || ''}`);
  if (!saved) return jsonError('Enregistrement impossible pour le moment. Réessayez.', 503);
  return NextResponse.json(
    {
      success: true,
      openToComptable: policy.open,
      policyChangedAt: policy.changedAt,
      figuresCode: policy.code,
      hasFiguresCode: !!policy.code,
    },
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

  // Code des chiffres à 6 chiffres (fixé par le Fondateur / DGA) ; à défaut, leur code personnel.
  const policy = await readPolicy(schoolId);
  let validCodes: string[];
  if (policy.code) {
    validCodes = [policy.code];
  } else {
    const staff = await getStaffUsersFromSupabase(slug);
    validCodes = staff
      .filter((s) => FIGURES_VISIBLE_ROLES.includes(s.roleId))
      .map((s) => String(s.authCode || '').trim().toUpperCase())
      .filter(Boolean);
  }
  if (validCodes.length === 0) {
    return jsonError("Aucun code des chiffres n'est configuré pour cet établissement.", 409);
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
