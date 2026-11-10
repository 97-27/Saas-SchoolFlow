import { NextRequest, NextResponse } from 'next/server';
import { getStaffUsersFromSupabase } from '@/lib/supabase/services';
import { isRateLimited, jsonError, requireSession } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

/**
 * Chiffres globaux (totaux encaissés, recettes du jour, structure des encaissements…) :
 * visibles en clair par le Fondateur SEULEMENT. Le Directeur peut les afficher en saisissant
 * le code du Fondateur ; tous les autres postes (Comptable, Secrétaire…) ne les voient jamais.
 *
 * GET  → rôle réel de la session (le navigateur ne décide pas seul qui est Fondateur).
 * POST → { code } : vérifie, côté serveur, le code du Fondateur pour le Directeur.
 */
export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if ('error' in auth) return auth.error;
  return NextResponse.json(
    { success: true, roleId: auth.session.roleId },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if ('error' in auth) return auth.error;
  const { session, slug } = auth;

  if (session.roleId === 'fondateur') return NextResponse.json({ success: true });
  if (session.roleId !== 'directeur') {
    return jsonError('Les chiffres globaux sont réservés au Fondateur.', 403);
  }

  if (isRateLimited(`figures:${slug}:${session.staffId || session.code}`, 5)) {
    return jsonError('Trop de codes incorrects. Veuillez patienter 10 minutes.', 429);
  }

  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return jsonError('Requête invalide.', 400);
  }
  const inputCode = String(body?.code || '').trim().toUpperCase();
  if (!inputCode) return jsonError('Veuillez saisir le code.', 400);

  const staff = await getStaffUsersFromSupabase(slug);
  const founder = staff.find((s) => s.roleId === 'fondateur');
  const founderCode = String(founder?.authCode || '').trim().toUpperCase();
  if (!founderCode) {
    return jsonError("Aucun code Fondateur n'est configuré pour cet établissement.", 409);
  }
  if (founderCode !== inputCode) {
    await new Promise((r) => setTimeout(r, 400));
    return jsonError('Code incorrect.', 403);
  }
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
}
