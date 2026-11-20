import { NextRequest, NextResponse } from 'next/server';
import { isRateLimited, jsonError, requireSession } from '@/lib/server/auth';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/server/session';
import { FOUNDER_ROLES } from '@/lib/auth/roles';
import { createChallenge, generateEmailCode, sendVerificationEmail, verifyChallenge } from '@/lib/server/email-verification';
import { deleteSchoolCompletely, getSchoolFromSupabase } from '@/lib/supabase/services';
import { forgetBlockState } from '@/lib/server/access-control';

export const dynamic = 'force-dynamic';

function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(1, name.length - 2))}@${domain}`;
}

/**
 * Suppression définitive du compte établissement, protégée par un code envoyé par e-mail à
 * l'adresse enregistrée de l'école (lue en base, jamais fournie par le navigateur).
 *   { action: 'request' }                       → envoie le code
 *   { action: 'confirm', challenge, code }      → supprime l'école si le code est exact
 */
export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if ('error' in auth) return auth.error;
  const { session, slug } = auth;
  if (!FOUNDER_ROLES.includes(session.roleId)) return jsonError('Seuls le Fondateur et le DGA peuvent supprimer le compte.', 403);
  if (slug === 'epc-manoi') return jsonError('Cet établissement est protégé et ne peut pas être supprimé.', 403);

  let body: any = null;
  try {
    body = await request.json();
  } catch (e) {}

  if (body?.action === 'request') {
    if (isRateLimited(`delreq:${slug}`, 4, 15 * 60 * 1000)) return jsonError('Un code vient déjà d’être envoyé. Patientez quelques minutes.', 429);
    const school = await getSchoolFromSupabase(slug, { stamp: false });
    const email = String(school?.email || '').trim();
    if (!school || !email) return jsonError('Aucune adresse e-mail enregistrée pour cet établissement. Renseignez-la dans Paramètres.', 400);
    const code = generateEmailCode();
    const sent = await sendVerificationEmail(email, code, school.name, 'delete');
    if (!sent.ok) {
      return jsonError(
        sent.error === 'not-configured' ? 'L’envoi d’e-mails n’est pas activé sur le serveur. Contactez SchoolFlow Africa.' : 'Impossible d’envoyer le code. Réessayez dans un instant.',
        sent.error === 'not-configured' ? 503 : 502
      );
    }
    const challenge = await createChallenge({ purpose: 'delete-school', slug }, code);
    return NextResponse.json({ success: true, challenge, email: maskEmail(email) }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (body?.action === 'confirm') {
    const sigPart = String(body.challenge || '').split('.')[1] || 'x';
    if (isRateLimited(`delcode:${sigPart}`, 6, 15 * 60 * 1000)) return jsonError('Trop d’essais. Redemandez un nouveau code.', 429);
    const check = await verifyChallenge(String(body.challenge || ''), String(body.code || ''));
    if (!check.ok) {
      return jsonError(
        check.reason === 'expired' ? 'Ce code a expiré (15 minutes). Redemandez-en un.' : check.reason === 'wrong-code' ? 'Code incorrect.' : 'Demande invalide. Recommencez.',
        400
      );
    }
    if (check.data.purpose !== 'delete-school' || check.data.slug !== slug) return jsonError('Demande invalide. Recommencez.', 400);
    const ok = await deleteSchoolCompletely(slug);
    if (!ok) return jsonError('Suppression impossible pour le moment. Réessayez.', 500);
    forgetBlockState(slug);
    const res = NextResponse.json({ success: true });
    res.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0));
    return res;
  }

  return jsonError('Action inconnue.', 400);
}
