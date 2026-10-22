import { NextRequest, NextResponse } from 'next/server';
import { createNewSchoolInSupabase, saveStaffUserToSupabase, getSchoolSubscriptionInfo } from '@/lib/supabase/services';
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from '@/lib/server/session';
import { clientIp, isRateLimited, jsonError } from '@/lib/server/auth';
import { School } from '@/lib/data/types';

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
  if (isRateLimited(`signup:${clientIp(request)}`, 5, 60 * 60 * 1000)) {
    return jsonError('Trop de créations d’établissement depuis cette connexion. Réessayez dans une heure.', 429);
  }

  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return jsonError('Requête invalide.', 400);
  }

  const schoolName = String(body?.schoolName || '').trim();
  const shortName = String(body?.shortName || '').trim().toUpperCase();
  const address = String(body?.address || '').trim();
  const email = String(body?.email || '').trim();
  const phone = String(body?.phone || '').trim();
  const responsableName = String(body?.responsableName || '').trim();
  const founderName = String(body?.founderName || '').trim() || responsableName;
  const plan = PLAN_PRICES[body?.plan] ? String(body.plan) : 'annuel';

  if (!schoolName || !shortName || !address || !email || !responsableName) {
    return jsonError('Veuillez renseigner tous les champs obligatoires (*) incluant le sigle et l’adresse de l’établissement.', 400);
  }
  if (phone.replace(/\D/g, '').length < 8) {
    return jsonError('Veuillez renseigner un numéro de téléphone / WhatsApp valide.', 400);
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
    academicYear: '2026-2027',
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
      { fullName: responsableName, role: 'Contrôle', roleId: 'directeur', email, phone, authCode: directorAuthCode, status: 'Actif' },
      newSchool.slug
    ),
    saveStaffUserToSupabase(
      { fullName: founderName, role: 'Contrôle Total', roleId: 'fondateur', email, phone, authCode: founderAuthCode, status: 'Actif' },
      newSchool.slug
    ),
  ]);

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
