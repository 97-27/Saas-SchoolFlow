import { NextRequest, NextResponse } from 'next/server';
import { jsonError } from '@/lib/server/auth';
import { isPlatformRequest } from '@/lib/server/platform-auth';
import { getPlatformOverview, recordSchoolPayment, renewSchoolSubscription } from '@/lib/supabase/services';

export const dynamic = 'force-dynamic';

const PLAN_MONTHS: Record<string, number> = { mensuel: 1, annuel: 12, triennal: 36 };

export async function GET(request: NextRequest) {
  if (!(await isPlatformRequest(request))) return jsonError('Accès refusé.', 401);
  const schools = await getPlatformOverview();
  return NextResponse.json({ success: true, schools, generatedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
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
