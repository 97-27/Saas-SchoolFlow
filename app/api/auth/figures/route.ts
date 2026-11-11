import { NextRequest, NextResponse } from 'next/server';
import { jsonError, requireSession } from '@/lib/server/auth';
import { FIGURES_UNLOCK_ROLES, FIGURES_VISIBLE_ROLES } from '@/lib/auth/roles';
import { kvSchoolId, kvPut } from '@/lib/supabase/kv';
import {
  FIGURES_POLICY_KEY,
  FiguresPolicy,
  figuresAttemptsKey,
  readFiguresAttempts,
  readFiguresPolicy,
  verifyFiguresCode,
} from '@/lib/server/figures-code';

export const dynamic = 'force-dynamic';

/**
 * Chiffres globaux (totaux encaissés, recettes du jour, structure des encaissements…) :
 * en clair pour le Fondateur et le Fondateur adjoint. Le Comptable peut les afficher avec le
 * code des chiffres (6 chiffres, fixé par le Fondateur / DGA) : 3 codes faux → saisie bloquée
 * 30 minutes. Tous les autres postes ne les voient jamais.
 *
 * Le compteur d'essais est gardé EN BASE (school_kv, clé hors des familles synchronisées donc
 * jamais lisible ni modifiable depuis un navigateur) : voir lib/server/figures-code.ts, partagé
 * avec les Archives des années scolaires.
 *
 * Interrupteur « chiffres ouverts au Comptable » : ouvert → le Comptable voit les chiffres sans
 * code. Fermé → masqués aussitôt, y compris un déverrouillage en cours (changedAt).
 *
 * GET  → { roleId, lockedUntil, openToComptable, … }
 * PUT  → { open } | { code: '123456' | 'generate' }  (Fondateur / DGA)
 * POST → { code }
 */

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if ('error' in auth) return auth.error;
  const { session, slug } = auth;
  let lockedUntil = 0;
  let policy: FiguresPolicy = { open: false, changedAt: 0, code: '' };
  const concerned = FIGURES_UNLOCK_ROLES.includes(session.roleId) || FIGURES_VISIBLE_ROLES.includes(session.roleId);
  if (concerned) {
    const schoolId = await kvSchoolId(slug);
    if (schoolId) {
      policy = await readFiguresPolicy(schoolId);
      if (FIGURES_UNLOCK_ROLES.includes(session.roleId)) {
        const a = await readFiguresAttempts(schoolId, figuresAttemptsKey(session));
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

/** Fondateur / Fondateur adjoint : ouvrir ou fermer les chiffres au Comptable, fixer le code. */
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
  const current = await readFiguresPolicy(schoolId);
  const policy: FiguresPolicy = { ...current, changedAt: Date.now() };
  if (hasOpen) policy.open = body.open;
  if (hasCode) {
    if (body.code === 'generate') policy.code = String(Math.floor(100000 + Math.random() * 900000));
    else if (typeof body.code === 'string' && /^\d{6}$/.test(body.code.trim())) policy.code = body.code.trim();
    else return jsonError('Le code doit contenir exactement 6 chiffres.', 400);
  }
  const saved = await kvPut(schoolId, FIGURES_POLICY_KEY, JSON.stringify(policy), `${session.roleId}|${session.staffId || ''}`);
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

  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return jsonError('Requête invalide.', 400);
  }

  const check = await verifyFiguresCode(slug, schoolId, session, String(body?.code || ''));
  if (!check.ok) {
    return NextResponse.json(
      { success: false, error: check.error, ...(check.lockedUntil ? { lockedUntil: check.lockedUntil } : {}) },
      { status: check.status, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
}
