import { NextRequest, NextResponse } from 'next/server';
import {
  getSchoolLoginInfo,
  getSchoolSubscriptionInfo,
  getStaffAuthRecords,
  getStaffUserById,
  getStudentsFromSupabase,
} from '@/lib/supabase/services';
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from '@/lib/server/session';
import {
  canonicalSlug,
  clientIp,
  clearLoginFailures,
  isLoginBlocked,
  jsonError,
  recordLoginFailure,
  STAFF_ROLES,
} from '@/lib/server/auth';
import {
  areNamesMatching,
  checkPhoneMatchesStudent,
  getStudentPhones,
  isGuardianNameExactMatch,
} from '@/lib/utils/auth-matching';
import { Student } from '@/lib/data/types';

export const dynamic = 'force-dynamic';

import { ROLE_LABELS } from '@/lib/auth/roles';
import { kvGet, kvPut, kvSchoolId } from '@/lib/supabase/kv';
import { TEACHER_TEACHING_PREFIX } from '@/lib/data/pointage';

const stripTitle = (name: string) =>
  name.replace(/\s*\((Fondateur|Fondatrice|Directeur des Études|Directeur Général|Directeur)\)/gi, '').trim();

/** Petite attente sur chaque échec : ralentit les essais de codes en rafale. */
async function refuse(message: string, status = 403) {
  await new Promise((r) => setTimeout(r, 400));
  return jsonError(message, status);
}

/**
 * Connexion — la décision est prise ICI, côté serveur, contre la base Cloud. Avant, toute la
 * vérification se faisait dans le navigateur (verifyUserAuthCodeForLogin) puis le navigateur
 * posait lui-même le cookie de session : il suffisait de fabriquer ce cookie pour entrer.
 */
export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return jsonError('Requête invalide.', 400);
  }

  const slug = canonicalSlug(String(body?.slug || '').trim());
  const roleId = String(body?.roleId || '').trim();
  const fullName = String(body?.fullName || '').trim();
  const inputCode = String(body?.code || '').trim().toUpperCase();
  const phone = String(body?.phone || '').trim();

  if (!slug || !roleId) return jsonError('Établissement ou profil manquant.', 400);
  if (roleId !== 'parent' && !STAFF_ROLES.includes(roleId)) return jsonError('Profil inconnu.', 400);

  // Échecs comptés par personne (adresse + école + poste + nom), jamais les connexions réussies.
  // Enseignant : compté par numéro de téléphone (pas de nom saisi) — un code à 4 chiffres ne doit
  // pas pouvoir être essayé en rafale.
  const who = roleId === 'enseignant' ? phone.replace(/\D/g, '').slice(-8) : fullName.toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
  const personKey = `login:${clientIp(request)}:${slug}:${roleId}:${who}`;
  if (isLoginBlocked(personKey)) {
    return jsonError('Trop de tentatives incorrectes pour ce profil. Veuillez patienter 10 minutes avant de réessayer.', 429);
  }
  const response = await handleLogin(request, body, slug, roleId, fullName, inputCode, phone);
  if (response.status === 403 || response.status === 404) recordLoginFailure(personKey);
  else if (response.status === 200) clearLoginFailures(personKey);
  return response;
}

async function handleLogin(
  request: NextRequest,
  body: any,
  slug: string,
  roleId: string,
  fullName: string,
  inputCode: string,
  phone: string
): Promise<NextResponse> {

  // Lectures LÉGÈRES (sans logo, cachet ni photos) : voir getStaffAuthRecords.
  const school = await getSchoolLoginInfo(slug);
  if (!school) return refuse('❌ Établissement introuvable. Vérifiez le lien de connexion de votre école.', 404);
  if (school.status === 'suspended') {
    return refuse("❌ L'accès à cet établissement est suspendu. Veuillez contacter le support SchoolFlow.");
  }

  // Échéance réelle d'abonnement (jamais pour l'établissement pilote).
  let subscriptionEndDate: string | undefined;
  if (slug !== 'epc-manoi') {
    const sub = await getSchoolSubscriptionInfo(slug);
    if (sub) {
      subscriptionEndDate = sub.endDate;
      if (sub.isExpired) {
        return refuse(
          `❌ Abonnement expiré le ${new Date(sub.endDate).toLocaleDateString('fr-FR')}. L'accès à l'espace de gestion est suspendu. Veuillez renouveler votre abonnement pour continuer.`
        );
      }
    }
  }

  // ─── Parents : nom complet du tuteur + téléphone enregistré à l'inscription ───
  if (roleId === 'parent') {
    if (fullName.length < 2) return refuse('Veuillez renseigner votre Nom et Prénoms de parent / tuteur légal.', 400);
    if (phone.replace(/\D/g, '').length < 8) {
      return refuse("Veuillez renseigner le numéro de téléphone WhatsApp ou tuteur renseigné lors de l'inscription de votre enfant.", 400);
    }

    const students = await getStudentsFromSupabase(slug);
    const byName = students.filter((s) => isGuardianNameExactMatch(fullName, s.guardianName || ''));
    const matched = byName.filter((s) => checkPhoneMatchesStudent(phone, s));
    if (matched.length === 0) {
      // Message volontairement identique pour un nom ou un téléphone incorrect : ne pas
      // indiquer à un inconnu lequel des deux est juste.
      return refuse(
        "❌ Accès refusé : le nom complet du tuteur et le numéro de téléphone doivent correspondre exactement à ceux enregistrés lors de l'inscription de votre enfant."
      );
    }

    const parentPhones = Array.from(
      new Set(matched.flatMap((s) => getStudentPhones(s).map((p) => p.replace(/\D/g, '')).filter((p) => p.length >= 8)))
    );
    const code = `PARENT-${phone.replace(/\D/g, '')}`;
    return issueSession(
      { slug, roleId, code, childIds: matched.map((s) => s.id), parentPhones, subscriptionEndDate },
      { matchedStudents: matched as Student[] }
    );
  }

  // ─── Enseignants : numéro de téléphone enregistré par la Direction + matière ───
  if (roleId === 'enseignant') {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) return refuse('Veuillez saisir votre numéro de téléphone.', 400);
    const subject = String(body?.subject || '').trim();
    if (!subject) return refuse('Veuillez indiquer la matière que vous enseignez.', 400);
    // Comparaison sur les 8 derniers chiffres : « +225 07 48 92 11 00 » = « 0748921100 ».
    const tail = digits.slice(-8);
    const teachers = (await getStaffAuthRecords(slug)).filter(
      (s) => s.roleId === 'enseignant' && String(s.phone || '').replace(/\D/g, '').slice(-8) === tail
    );
    if (teachers.length === 0) {
      return refuse(
        "❌ Ce numéro n'est enregistré pour aucun enseignant de l'établissement. Demandez à la Direction de l'ajouter (Administration & Codes, champ téléphone)."
      );
    }
    if (teachers.length > 1) {
      return refuse('❌ Ce numéro est enregistré pour plusieurs enseignants. Demandez à la Direction de corriger les fiches.');
    }
    const t = teachers[0];
    if (t.status === 'Verrouillé') {
      return refuse("❌ Accès bloqué : ce compte a été verrouillé par la Direction de l'école.");
    }
    // Code personnel à 4 chiffres. Un ancien code « ENS-1234 » reste valable en tapant 1234.
    // Compteur d'essais EN BASE (tous les serveurs le partagent) : 5 codes faux → 15 min bloqué.
    const schoolId = await kvSchoolId(slug);
    const attemptsKey = `sf_private_teacher_login_attempts_${t.id}`;
    let attempts = { failures: 0, lockedUntil: 0 };
    if (schoolId) {
      const row = await kvGet(schoolId, attemptsKey);
      try {
        if (row) attempts = { failures: Number(JSON.parse(row.value).failures) || 0, lockedUntil: Number(JSON.parse(row.value).lockedUntil) || 0 };
      } catch {}
    }
    const nowMs = Date.now();
    if (attempts.lockedUntil > nowMs) {
      const min = Math.ceil((attempts.lockedUntil - nowMs) / 60000);
      return jsonError(`❌ Trop de codes incorrects. Réessayez dans ${min} minute${min > 1 ? 's' : ''}.`, 429);
    }
    if (attempts.lockedUntil) attempts = { failures: 0, lockedUntil: 0 };

    const pin = inputCode.replace(/\D/g, '');
    const stored = String(t.authCode || '').trim().toUpperCase();
    if (!/^\d{4}$/.test(pin) || !(stored === pin || stored.replace(/\D/g, '') === pin)) {
      const failures = attempts.failures + 1;
      const lockedUntil = failures >= 5 ? nowMs + 15 * 60 * 1000 : 0;
      if (schoolId) await kvPut(schoolId, attemptsKey, JSON.stringify({ failures, lockedUntil }), `enseignant|${t.id}`);
      return refuse(
        lockedUntil
          ? '❌ Code incorrect. Connexion bloquée 15 minutes après 5 essais.'
          : `❌ Code personnel incorrect. Il vous reste ${5 - failures} essai${5 - failures > 1 ? 's' : ''}.`
      );
    }
    if (schoolId && attempts.failures) {
      await kvPut(schoolId, attemptsKey, JSON.stringify({ failures: 0, lockedUntil: 0 }), `enseignant|${t.id}`);
    }
    // Matières et classes cochées : enregistrées sur la fiche de l'enseignant (visibles en
    // Administration & Codes).
    const classes = String(body?.teachingClass || '').trim().slice(0, 400);
    if (schoolId) {
      await kvPut(
        schoolId,
        `${TEACHER_TEACHING_PREFIX}${t.id}`,
        JSON.stringify({ subjects: subject.slice(0, 400), classes, at: new Date().toISOString() }),
        `enseignant|${t.id}`
      );
    }
    const full = (await getStaffUserById(slug, t.id)) || t;
    const code = String(t.authCode || '').toUpperCase();
    // Le navigateur garde le code interne de l'enseignant (notes diverses, photo…) : il est
    // déjà connecté avec son numéro, ce code ne lui donne rien de plus.
    return issueSession(
      { slug, roleId, code, staffId: t.id, subscriptionEndDate },
      { staffUser: full, extraJson: { authCode: code } }
    );
  }

  // ─── Personnel (Fondateur, Directeur et collaborateurs) : code personnel obligatoire ───
  if (!inputCode) {
    return refuse("Veuillez saisir votre Code d'Authentification officiel transmis par la Direction.", 400);
  }

  // Anciens codes de démonstration, identiques pour toutes les écoles : jamais acceptés.
  if (/^(FND|DIR)-2026$/i.test(inputCode)) {
    return refuse(
      "❌ Ce code de démonstration n'est plus valable. Demandez votre code personnel au Fondateur ou au Directeur de l'établissement."
    );
  }

  const staff = await getStaffAuthRecords(slug);

  if (roleId === 'fondateur' || roleId === 'directeur') {
    if (fullName.length < 2) return refuse('Veuillez renseigner votre Nom et Prénoms officiels.', 400);

    const officialFounder = stripTitle(school.founderName || (slug === 'epc-manoi' ? 'LAWANI MOUSSA' : ''));
    const officialDirector = stripTitle(school.directorName || (slug === 'epc-manoi' ? 'LAWANI MOUHAMED' : ''));
    // S'il reste plusieurs fiches pour ce poste (anciens doublons), on prend celle dont le code
    // correspond — avant, seule la PREMIÈRE fiche était comparée, et la page Administration
    // pouvait afficher une autre fiche (donc un autre code) que celle utilisée pour se connecter.
    const sameRole = staff.filter((s) => s.roleId === roleId);
    const record =
      sameRole.find((s) => String(s.authCode || '').trim().toUpperCase() === inputCode) || sameRole[0];

    const nameOk =
      areNamesMatching(fullName, officialFounder) ||
      areNamesMatching(fullName, officialDirector) ||
      (record ? areNamesMatching(fullName, record.fullName || '') : false);
    if (!nameOk) {
      return refuse(
        "❌ Accès refusé : ce nom ne correspond pas à la Direction officielle de cet établissement. Seuls le Directeur désigné et le Fondateur ayant souscrit l'abonnement peuvent utiliser ce profil."
      );
    }

    // Plus AUCUN code générique de secours (FND-2026 / DIR-2026) : sans fiche configurée en
    // base, la connexion est refusée — ces codes identiques pour toutes les écoles ouvraient
    // l'accès à quiconque connaissait le nom du Directeur.
    if (!record || !record.authCode) {
      return refuse(
        '❌ Aucun code d’accès n’est encore configuré pour ce profil dans la base de l’établissement. Contactez le support SchoolFlow pour l’activer.'
      );
    }
    if (String(record.authCode).trim().toUpperCase() !== inputCode) {
      return refuse("❌ Accès refusé : le Code d'Authentification saisi est incorrect pour ce profil.");
    }

    return issueSession(
      { slug, roleId, code: inputCode, staffId: record.id, subscriptionEndDate },
      { staffUser: (await getStaffUserById(slug, record.id)) || record }
    );
  }

  const record = staff.find((s) => s.roleId === roleId && String(s.authCode || '').trim().toUpperCase() === inputCode);
  if (!record) {
    return refuse(
      `❌ Accès refusé : ce code d'authentification est invalide pour le poste de « ${ROLE_LABELS[roleId] || 'Personnel'} ». Vérifiez le poste sélectionné ou contactez la Direction de l'école.`
    );
  }
  if (record.status === 'Verrouillé') {
    return refuse(
      `❌ Accès bloqué : ce compte a été verrouillé par la Direction de l'école. Contactez la Direction pour le réactiver.`
    );
  }

  return issueSession(
    { slug, roleId, code: inputCode, staffId: record.id, subscriptionEndDate },
    { staffUser: (await getStaffUserById(slug, record.id)) || record }
  );
}

async function issueSession(
  data: {
    slug: string;
    roleId: string;
    code: string;
    staffId?: string;
    childIds?: string[];
    parentPhones?: string[];
    subscriptionEndDate?: string;
  },
  extra: { staffUser?: any; matchedStudents?: Student[]; extraJson?: Record<string, unknown> }
) {
  let token: string;
  try {
    token = await createSessionToken(data);
  } catch (e: any) {
    console.error('[SchoolFlow] Impossible de créer la session :', e?.message);
    return jsonError('Configuration du serveur incomplète (SESSION_SECRET). Contactez le support.', 500);
  }

  // Ne jamais renvoyer le code d'accès au navigateur : il le connaît déjà (il vient de le saisir).
  const staffUser = extra.staffUser
    ? {
        id: extra.staffUser.id,
        fullName: extra.staffUser.fullName,
        role: extra.staffUser.role,
        roleId: extra.staffUser.roleId,
        email: extra.staffUser.email,
        phone: extra.staffUser.phone,
        avatarUrl: extra.staffUser.avatarUrl,
        status: extra.staffUser.status,
        matricule: extra.staffUser.matricule,
      }
    : undefined;

  const res = NextResponse.json(
    {
      success: true,
      staffUser,
      matchedStudents: extra.matchedStudents,
      subscriptionEndDate: data.subscriptionEndDate,
      ...(extra.extraJson || {}),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
