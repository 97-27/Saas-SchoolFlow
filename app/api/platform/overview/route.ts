import { NextRequest, NextResponse } from 'next/server';
import { jsonError } from '@/lib/server/auth';
import { isPlatformRequest } from '@/lib/server/platform-auth';
import {
  getPlatformOverview,
  recordSchoolPayment,
  renewSchoolSubscription,
  setAccessControl,
  deleteSchoolCompletely,
  readPlatformCodes,
  writePlatformCodes,
  generateGoldenCode,
  findUnusedGoldenCard,
  consumeGoldenCard,
  type PlatformSchoolRow,
} from '@/lib/supabase/services';
import { forgetBlockState } from '@/lib/server/access-control';

export const dynamic = 'force-dynamic';

const PLAN_MONTHS: Record<string, number> = { mensuel: 1, annuel: 12, triennal: 36 };

export async function GET(request: NextRequest) {
  if (!(await isPlatformRequest(request))) return jsonError('Accès refusé.', 401);
  // Suppressions programmées arrivées à échéance : exécutées ici aussi (le tableau se met à jour toutes les 60 s).
  const [overview, codes] = await Promise.all([getPlatformOverview(), readPlatformCodes()]);
  const schools = await purgeDueSchools(overview.schools);
  return NextResponse.json(
    { success: true, schools, serviceRevenue: overview.serviceRevenue, codes, version: appVersion(), generatedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

function appVersion(): string {
  return process.env.NEXT_PUBLIC_BUILD_ID || 'local';
}

async function purgeDueSchools(schools: PlatformSchoolRow[]): Promise<PlatformSchoolRow[]> {
  const kept: PlatformSchoolRow[] = [];
  for (const s of schools) {
    if (s.access?.deleteAt && new Date(s.access.deleteAt).getTime() <= Date.now()) {
      if (await deleteSchoolCompletely(s.slug)) {
        forgetBlockState(s.slug);
        continue;
      }
    }
    kept.push(s);
  }
  return kept;
}

const randomDigits = () => generateGoldenCode();

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

  // Cartes dorées et codes promo globaux.
  if (body?.action === 'golden-create' || body?.action === 'golden-remove' || body?.action === 'promo-create' || body?.action === 'promo-remove') {
    const codes = await readPlatformCodes();
    if (body.action === 'golden-create') {
      const months = body.months === null || body.months === 'unlimited' ? null : Math.round(Number(body.months));
      if (months !== null && (!months || months < 1 || months > 120)) return jsonError('Durée invalide (1 à 120 mois ou illimitée).', 400);
      const count = Math.min(Math.max(Math.round(Number(body.count) || 1), 1), 20);
      for (let i = 0; i < count; i++) {
        let code = randomDigits();
        while (codes.cards.some((c) => c.code === code)) code = randomDigits();
        codes.cards.unshift({ code, months, label: String(body.label || '').slice(0, 60), createdAt: new Date().toISOString() });
      }
    } else if (body.action === 'golden-remove') {
      const code = String(body.code || '');
      codes.cards = codes.cards.filter((c) => !(c.code === code && !c.usedBy));
    } else if (body.action === 'promo-create') {
      const code = String(body.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
      const percent = Math.round(Number(body.percent) || 0);
      if (!code || percent < 1 || percent > 100) return jsonError('Code promo : code et pourcentage (1 à 100) requis.', 400);
      if (codes.promos.some((p) => p.code === code)) return jsonError('Ce code promo existe déjà.', 400);
      const exp = body.expiresAt ? new Date(body.expiresAt) : null;
      codes.promos.unshift({ code, percent, uses: [], ...(exp && !isNaN(exp.getTime()) ? { expiresAt: exp.toISOString() } : {}) });
    } else {
      const code = String(body.code || '');
      codes.promos = codes.promos.filter((p) => p.code !== code);
    }
    if (!(await writePlatformCodes(codes))) return jsonError('Enregistrement impossible.', 500);
    return NextResponse.json({ success: true, codes });
  }

  // Applique à une école existante une carte dorée (12 chiffres) du stock : accès illimité ou durée de la carte.
  if (body?.action === 'golden-apply') {
    if (!slug) return jsonError('École manquante.', 400);
    const card = await findUnusedGoldenCard(String(body.code || ''));
    if (!card) return jsonError('Carte dorée invalide ou déjà utilisée (12 chiffres).', 400);
    const until = card.months ? new Date(new Date().setMonth(new Date().getMonth() + card.months)).toISOString() : null;
    const res = await setAccessControl(slug, { unlimited: card.months === null, goldUntil: until, goldOnly: false });
    if (!res.success) return jsonError('Modification impossible (école introuvable ou protégée).', 400);
    await consumeGoldenCard(card.code, slug);
    forgetBlockState(slug);
    return NextResponse.json({ success: true, access: res.access, message: card.months ? `Carte dorée appliquée : ${card.months} mois.` : 'Carte dorée appliquée : accès illimité.' });
  }

  // Bannissement : suppression de l'école après un compte à rebours de 60 secondes (annulable).
  if (body?.action === 'delete' || body?.action === 'delete-cancel') {
    if (!slug) return jsonError('École manquante.', 400);
    const deleteAt = body.action === 'delete' ? new Date(Date.now() + 60_000).toISOString() : null;
    const res = await setAccessControl(slug, { deleteAt });
    if (!res.success) return jsonError('Modification impossible (école introuvable ou protégée).', 400);
    forgetBlockState(slug);
    return NextResponse.json({ success: true, access: res.access });
  }

  // Contrôle d'accès : blocage, carte dorée (durée), code promo.
  if (body?.action === 'access') {
    if (!slug) return jsonError('École manquante.', 400);
    const patch: Record<string, any> = {};
    // Carte dorée : mois (1 à 120), « unlimited » ou « off » (retirer).
    if ('gold' in body) {
      if (body.gold === 'off') Object.assign(patch, { unlimited: false, goldUntil: null, goldOnly: false });
      else if (body.gold === 'unlimited') Object.assign(patch, { unlimited: true, goldUntil: null, goldOnly: false });
      else if (typeof body.goldUntil === 'string' && !isNaN(new Date(body.goldUntil).getTime())) {
        Object.assign(patch, { unlimited: false, goldUntil: new Date(body.goldUntil).toISOString(), goldOnly: false });
      } else {
        const m = Math.round(Number(body.gold));
        if (!m || m < 1 || m > 120) return jsonError('Durée de la carte dorée invalide.', 400);
        const d = new Date();
        d.setMonth(d.getMonth() + m);
        Object.assign(patch, { unlimited: false, goldUntil: d.toISOString(), goldOnly: false });
      }
    }
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
