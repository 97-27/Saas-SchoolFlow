import { NextRequest, NextResponse } from 'next/server';
import { jsonError, requireSession } from '@/lib/server/auth';
import { kvSchoolId } from '@/lib/supabase/kv';
import { ALL_STAFF_ROLES } from '@/lib/auth/roles';
import { deletePushSubscription, pushConfigured, pushPublicKey, savePushSubscription } from '@/lib/server/push';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Abonnement aux notifications en arrière-plan (voir lib/server/push.ts).
 * GET    → { enabled, publicKey }
 * POST   { subscription, label } → enregistre l'abonnement de CET appareil pour la personne connectée
 * DELETE { endpoint }            → le retire
 */
export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if ('error' in auth) return auth.error;
  return NextResponse.json({ success: true, enabled: pushConfigured(), publicKey: pushPublicKey() }, { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if ('error' in auth) return auth.error;
  const { session, slug } = auth;
  if (!ALL_STAFF_ROLES.includes(session.roleId)) return jsonError('Réservé au personnel.', 403);
  if (!pushConfigured()) return jsonError('Notifications en arrière-plan non configurées sur le serveur.', 503);
  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError('Requête invalide.', 400);
  }
  const s = body?.subscription;
  const endpoint = String(s?.endpoint || '');
  const p256dh = String(s?.keys?.p256dh || '');
  const authKey = String(s?.keys?.auth || '');
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || !authKey) {
    return jsonError('Abonnement invalide.', 400);
  }
  const schoolId = await kvSchoolId(slug);
  if (!schoolId) return jsonError('Établissement introuvable.', 404);
  const ok = await savePushSubscription(schoolId, {
    endpoint,
    keys: { p256dh, auth: authKey },
    roleId: session.roleId,
    staffId: session.staffId || session.code,
    label: String(body?.label || '').slice(0, 80),
    at: new Date().toISOString(),
  });
  if (!ok) return jsonError('Enregistrement impossible pour le moment.', 503);
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireSession(request);
  if ('error' in auth) return auth.error;
  const { session, slug } = auth;
  let body: any = {};
  try {
    body = await request.json();
  } catch {}
  const endpoint = String(body?.endpoint || '');
  const schoolId = await kvSchoolId(slug);
  if (schoolId && endpoint) await deletePushSubscription(schoolId, session.staffId || session.code, endpoint);
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}
