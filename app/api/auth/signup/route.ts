import { currentAcademicYear } from '@/lib/data/school-calendar';
import { NextRequest, NextResponse } from 'next/server';
import { createNewSchoolInSupabase, saveStaffUserToSupabase, getSchoolSubscriptionInfo, getAllSchoolsFromSupabase, saveSignupInfo, recordSchoolPayment, findUnusedGoldenCard, consumeGoldenCard, findPromoCode, recordPromoUse, setAccessControl } from '@/lib/supabase/services';
import { isStudentTierId } from '@/lib/data/subscription-tiers';
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from '@/lib/server/session';
import { clientIp, isRateLimited, jsonError } from '@/lib/server/auth';
import { School } from '@/lib/data/types';
import { createChallenge, generateEmailCode, sendVerificationEmail, verifyChallenge } from '@/lib/server/email-verification';

export const dynamic = 'force-dynamic';

const PLAN_PRICES: Record<string, number> = { mensuel: 30000, annuel: 250000, triennal: 750000 };
const PLAN_MONTHS: Record<string, number> = { mensuel: 1, annuel: 12, triennal: 36 };

// Sans caractères ambigus (0/O, 1/I/L) : les codes sont recopiés à la main ou dictés.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Code d'accès aléatoire cryptographique (Math.random n'est pas imprévisible). */
function generateAuthCode(prefix: string): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `${prefix}-${out}`;
}

function randomSuffix(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 4);
}

/**
 * Création d'un nouvel établissement + fiches Directeur / Fondateur, entièrement côté serveur.
 * Les codes d'accès sont générés ici et ne transitent qu'une fois vers le navigateur du
 * créateur, pour lui être affichés.
 */
export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return jsonError('Requête invalide.', 400);
  }

  // Étape 2 : le navigateur renvoie le défi signé + le code reçu par e-mail. Sans code exact,
  // AUCUN compte n'est ouvert. Les données d'inscription sont celles figées dans le défi.
  let emailVerified = false;
  if (body?.challenge) {
    const sigPart = String(body.challenge).split('.')[1] || 'x';
    if (isRateLimited(`signupcode:${sigPart}`, 6, 15 * 60 * 1000) || isRateLimited(`signupcodeip:${clientIp(request)}`, 20, 15 * 60 * 1000)) {
      return jsonError('Trop d’essais. Redemandez un nouveau code de confirmation.', 429);
    }
    const check = await verifyChallenge(String(body.challenge), String(body.emailCode || ''));
    if (!check.ok) {
      const msg =
        check.reason === 'expired'
          ? '⌛ Ce code a expiré (15 minutes). Cliquez sur « Renvoyer le code ».'
          : check.reason === 'wrong-code'
            ? '❌ Code incorrect. Vérifiez le code à 6 chiffres reçu par e-mail.'
            : 'Demande de confirmation invalide. Recommencez l’inscription.';
      return jsonError(msg, 400);
    }
    body = check.data;
    emailVerified = true;
  } else if (isRateLimited(`signup:${clientIp(request)}`, 8, 60 * 60 * 1000)) {
    return jsonError('Trop de demandes depuis cette connexion. Réessayez dans une heure.', 429);
  }

  const schoolName = String(body?.schoolName || '').trim();
  const shortName = String(body?.shortName || '').trim().toUpperCase();
  const address = String(body?.address || '').trim();
  const email = String(body?.email || '').trim();
  const phone = String(body?.phone || '').trim();
  const responsableName = String(body?.responsableName || '').trim();
  const founderName = String(body?.founderName || '').trim() || responsableName;
  const plan = PLAN_PRICES[body?.plan] ? String(body.plan) : 'annuel';
  const studentTier = isStudentTierId(body?.studentTier) ? String(body.studentTier) : '';
  const paymentMethod = ['wave', 'orange', 'card'].includes(body?.paymentMethod) ? String(body.paymentMethod) : 'autre';
  const paymentPhone = String(body?.paymentPhone || '').trim().slice(0, 30);
  const goldenDigits = String(body?.goldenCode || '').replace(/\D/g, '');
  const promoInput = String(body?.promoCode || '').trim();

  // Carte dorée et code promo sont vérifiés AVANT toute création : un mauvais code ne crée rien.
  const goldenCard = goldenDigits ? await findUnusedGoldenCard(goldenDigits) : null;
  if (goldenDigits && !goldenCard) {
    return jsonError('❌ Carte d’accès dorée invalide ou déjà utilisée. Vérifiez les 12 chiffres ou contactez SchoolFlow Africa.', 400);
  }
  const promo = promoInput && !goldenCard ? await findPromoCode(promoInput) : null;
  if (promoInput && !goldenCard && !promo) {
    return jsonError('❌ Ce code promo est invalide ou expiré. Corrigez-le ou laissez le champ vide.', 400);
  }
  const activationCodeGiven = !!goldenCard;

  if (!studentTier) {
    return jsonError('Veuillez indiquer le nombre d’élèves de votre établissement (tranche d’effectif).', 400);
  }
  if (!schoolName || !shortName || !address || !email || !responsableName) {
    return jsonError('Veuillez renseigner tous les champs obligatoires (*) incluant le sigle et l’adresse de l’établissement.', 400);
  }
  if (phone.replace(/\D/g, '').length < 8) {
    return jsonError('Veuillez renseigner un numéro de téléphone / WhatsApp valide.', 400);
  }

  // Le sigle sert à retrouver l'établissement à la connexion : il doit être UNIQUE.
  if (shortName.length < 2) {
    return jsonError('Le sigle de l’établissement doit contenir au moins 2 caractères (ex : EPC MANOI).', 400);
  }
  {
    const normalizeSigle = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const existing = await getAllSchoolsFromSupabase();
    const taken = existing.some((s) => s.shortName && normalizeSigle(s.shortName) === normalizeSigle(shortName));
    if (taken) {
      return jsonError(`❌ Le sigle « ${shortName} » est déjà utilisé par un autre établissement. Choisissez un sigle différent (ex : ajoutez la ville).`, 409);
    }
  }

  // Étape 1 : tout est valide, mais rien n'est créé tant que l'e-mail n'est pas confirmé.
  if (!emailVerified) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return jsonError('Adresse e-mail invalide. Vérifiez-la : le code de confirmation y sera envoyé.', 400);
    }
    if (isRateLimited(`signupmail:${email.toLowerCase()}`, 4, 15 * 60 * 1000)) {
      return jsonError('Un code vient déjà d’être envoyé à cette adresse. Patientez quelques minutes avant d’en redemander un.', 429);
    }
    const code = generateEmailCode();
    const sent = await sendVerificationEmail(email, code, schoolName);
    if (!sent.ok) {
      return jsonError(
        sent.error === 'not-configured'
          ? '❌ L’envoi du code de confirmation n’est pas encore activé sur le serveur. Contactez SchoolFlow Africa.'
          : '❌ Impossible d’envoyer le code à cette adresse. Vérifiez l’e-mail saisi puis réessayez.',
        sent.error === 'not-configured' ? 503 : 502
      );
    }
    const challenge = await createChallenge(
      { schoolName, shortName, address, email, phone, responsableName, founderName, plan, studentTier, paymentMethod, paymentPhone, goldenCode: goldenDigits, promoCode: promoInput },
      code
    );
    return NextResponse.json(
      { success: true, needsEmailCode: true, challenge, email },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const baseSlug =
    (shortName.length >= 2 ? shortName : schoolName)
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || `ecole-${Date.now()}`;

  const newSchool: School = {
    id: '',
    slug: baseSlug === 'epc-manoi' || baseSlug === 'college-excellence' ? `${baseSlug}-${randomSuffix()}` : baseSlug,
    name: schoolName.toUpperCase(),
    shortName,
    logoColor: '#059669',
    academicYear: currentAcademicYear(),
    currentTerm: 'Trimestre 1',
    termType: 'trimestriel',
    phone,
    whatsappPhone: phone,
    email,
    motto: 'Discipline • Rigueur • Réussite',
    slogan: 'L’Excellence au service de l’Éducation',
    city: address || 'Abidjan',
    address: address || 'Abidjan, Côte d’Ivoire',
    country: 'Côte d’Ivoire',
    district: 'Abidjan',
    ministryCode: '',
    founderName,
    directorName: responsableName,
    studiesDirectorName: responsableName,
    logoUrl: '',
    stampUrl: '',
    countryEmblemUrl: '',
    status: 'active',
    subscriptionPlan: plan,
    subscriptionPrice: PLAN_PRICES[plan],
    createdAt: new Date().toISOString(),
  };

  // Un INSERT (jamais un upsert) échoue sur la contrainte unique du slug : en cas de collision,
  // on régénère un suffixe au lieu d'écraser une autre école.
  let created = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await createNewSchoolInSupabase(newSchool);
    if (result.success) {
      created = true;
      newSchool.id = result.id || '';
      break;
    }
    if (!result.collision) break;
    newSchool.slug = `${baseSlug}-${randomSuffix()}`;
  }
  if (!created) {
    return jsonError('❌ Impossible de créer votre espace pour le moment (problème de connexion au serveur). Veuillez réessayer dans quelques instants.', 503);
  }

  const directorAuthCode = generateAuthCode('DIR');
  const founderAuthCode = generateAuthCode('FND');
  const [dirSaved, fndSaved] = await Promise.all([
    saveStaffUserToSupabase(
      { fullName: responsableName, role: 'Directeur des Études (Contrôle)', roleId: 'directeur', email, phone, authCode: directorAuthCode, status: 'Actif', matricule: 'DIR-001' },
      newSchool.slug
    ),
    saveStaffUserToSupabase(
      { fullName: founderName, role: 'Fondateur (Contrôle Total)', roleId: 'fondateur', email, phone, authCode: founderAuthCode, status: 'Actif', matricule: 'FND-001' },
      newSchool.slug
    ),
  ]);

  // Mode découverte : le règlement n'est pas encore relié à Wave / Orange Money / carte. Le choix
  // est enregistré « en attente » (jamais les numéros de carte) pour le suivi dans l'espace plateforme.
  const nowIso = new Date().toISOString();
  const basePrice = PLAN_PRICES[plan];
  const dueAmount = promo ? Math.max(0, Math.round(basePrice * (1 - promo.percent / 100))) : basePrice;
  await saveSignupInfo(newSchool.slug, {
    studentTier,
    paymentMethod,
    paymentPhone,
    activationCodeGiven,
    signedUpAt: nowIso,
    ...(promo ? { promoCode: promo.code, promoPercent: promo.percent } : {}),
    ...(goldenCard ? { goldenCard: true } : {}),
  });
  if (goldenCard) {
    // Carte dorée : accès sans paiement, pour la durée de la carte (ou sans limite).
    const consumed = await consumeGoldenCard(goldenCard.code, newSchool.slug);
    if (consumed) {
      const until = goldenCard.months ? new Date(new Date().setMonth(new Date().getMonth() + goldenCard.months)).toISOString() : null;
      await setAccessControl(newSchool.slug, { unlimited: goldenCard.months === null, goldUntil: until, goldOnly: true });
      await recordSchoolPayment(newSchool.slug, {
        at: nowIso,
        amount: 0,
        plan,
        method: 'code',
        kind: 'inscription',
        status: 'confirme',
        note: `Carte dorée ${goldenCard.months ? goldenCard.months + ' mois' : 'illimitée'}`,
      });
    }
  } else {
    await recordSchoolPayment(newSchool.slug, {
      at: nowIso,
      amount: dueAmount,
      plan,
      method: paymentMethod,
      phone: paymentPhone,
      kind: 'inscription',
      status: 'en_attente',
      note: promo ? `Règlement à confirmer — code promo ${promo.code} (−${promo.percent} %)` : 'Règlement à confirmer',
    });
    if (promo) await recordPromoUse(promo.code, newSchool.slug);
  }

  const sub = await getSchoolSubscriptionInfo(newSchool.slug);
  const fallbackEnd = new Date();
  fallbackEnd.setMonth(fallbackEnd.getMonth() + (PLAN_MONTHS[plan] || 12));
  const subscriptionEndDate = sub?.endDate || fallbackEnd.toISOString();

  const token = await createSessionToken({
    slug: newSchool.slug,
    roleId: 'directeur',
    code: directorAuthCode,
    subscriptionEndDate,
  });

  const res = NextResponse.json(
    {
      success: true,
      school: newSchool,
      directorAuthCode,
      founderAuthCode,
      staffSaved: dirSaved && fndSaved,
      subscriptionEndDate,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
