import { NextRequest, NextResponse } from 'next/server';
import { jsonError } from '@/lib/server/auth';
import { isPlatformRequest } from '@/lib/server/platform-auth';
import { getPlatformOverview, recordSchoolPayment, renewSchoolSubscription, setAccessControl } from '@/lib/supabase/services';
import { forgetBlockState } from '@/lib/server/access-control';

export const dynamic = 'force-dynamic';

const PLAN_MONTHS: Record<string, number> = { mensuel: 1, annuel: 12, triennal: 36 };

export async function GET(request: NextRequest) {
  if (!(await isPlatformRequest(request))) return jsonError('Accès refusé.', 401);
  const { schools, serviceRevenue } = await getPlatformOverview();
  return NextResponse.json({ success: true, schools, serviceRevenue, generatedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
}

/**
 * Confirmation manuelle d'un règlement reçu (Wave / Orange Money / virement / code remis) :
 * enregistre le paiement et prolonge l'abonnement de la durée du forfait.
 */
export async function POST(request: NextRequest) {
  if (!(await isPlatformRequest(request))) return jsonError('Accès refusé.', 401);
  let body: any = null;
  try {
    body = await request.json();
  } catch (e) {}
  const slug = String(body?.slug || '').trim();

  // Contrôle d'accès : blocage, accès illimité, code promo.
  if (body?.action === 'access') {
    if (!slug) return jsonError('École manquante.', 400);
    const patch: Record<string, any> = {};
    if (typeof body.blocked === 'boolean') patch.blocked = body.blocked;
    if (typeof body.blockMessage === 'string') patch.blockMessage = body.blockMessage.trim().slice(0, 300);
    if (typeof body.unlimited === 'boolean') patch.unlimited = body.unlimited;
    if ('promo' in body) {
      const pr = body.promo;
      if (pr === null) patch.promo = null;
      else {
        const code = String(pr?.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
        const percent = Math.round(Number(pr?.percent) || 0);
        if (!code || percent < 1 || percent > 100) return jsonError('Code promo : code et pourcentage (1 à 100) requis.', 400);
        const exp = pr?.expiresAt ? new Date(pr.expiresAt) : null;
        patch.promo = { code, percent, note: String(pr?.note || '').slice(0, 120), ...(exp && !isNaN(exp.getTime()) ? { expiresAt: exp.toISOString() } : {}) };
      }
    }
    const res = await setAccessControl(slug, patch);
    if (!res.success) return jsonError('Modification impossible (école introuvable ou protégée).', 400);
    forgetBlockState(slug);
    return NextResponse.json({ success: true, access: res.access });
  }

  const plan = String(body?.plan || '');
  const amount = Math.round(Number(body?.amount) || 0);
  const method = String(body?.method || 'autre').slice(0, 20);
  if (!slug || !PLAN_MONTHS[plan] || amount <= 0) return jsonError('École, forfait et montant sont obligatoires.', 400);

  // « inscription » : le premier forfait court déjà depuis la création de l'espace, on confirme
  // seulement le règlement. « renouvellement » : on prolonge l'abonnement de la durée du forfait.
  const kind = body?.kind === 'inscription' ? 'inscription' : 'renouvellement';
  let newEndDate: string | undefined;
  if (kind === 'renouvellement') {
    const renewed = await renewSchoolSubscription(slug, PLAN_MONTHS[plan], `Paiement confirmé (${method})`);
    if (!renewed.success) return jsonError('Impossible de prolonger l’abonnement (école introuvable ?).', 404);
    newEndDate = renewed.newEndDate;
  }
  await recordSchoolPayment(slug, {
    at: new Date().toISOString(),
    amount,
    plan,
    method,
    kind,
    status: 'confirme',
    note: String(body?.note || '').slice(0, 200),
  });
  return NextResponse.json({ success: true, newEndDate });
}
