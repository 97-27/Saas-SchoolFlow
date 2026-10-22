import { NextRequest, NextResponse } from 'next/server';
import {
  getSchoolFromSupabase,
  getSchoolSubscriptionInfo,
  getStaffUsersFromSupabase,
  getStudentsFromSupabase,
} from '@/lib/supabase/services';
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from '@/lib/server/session';
import { canonicalSlug, clientIp, isRateLimited, jsonError, STAFF_ROLES } from '@/lib/server/auth';
import {
  areNamesMatching,
  checkPhoneMatchesStudent,
  getStudentPhones,
  isGuardianNameExactMatch,
} from '@/lib/utils/auth-matching';
import { Student } from '@/lib/data/types';

export const dynamic = 'force-dynamic';

const ROLE_LABELS: Record<string, string> = {
  secretaire: 'Secrétaire de Direction',
  comptable: 'Comptable / Gestionnaire',
  assistant_direction: 'Assistant(e) de Direction',
  educateur: 'Éducateur / Conseiller d’Éducation',
  enseignant: 'Enseignant / Professeur',
};

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

  if (isRateLimited(`login:${clientIp(request)}:${slug}`, 15)) {
    return jsonError('Trop de tentatives de connexion. Veuillez patienter 10 minutes avant de réessayer.', 429);
  }

  const school = await getSchoolFromSupabase(slug);
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

  // ─── Personnel (Fondateur, Directeur et collaborateurs) : code personnel obligatoire ───
  if (!inputCode) {
    return refuse("Veuillez saisir votre Code d'Authentification officiel transmis par la Direction.", 400);
  }

  const staff = await getStaffUsersFromSupabase(slug);

  if (roleId === 'fondateur' || roleId === 'directeur') {
    if (fullName.length < 2) return refuse('Veuillez renseigner votre Nom et Prénoms officiels.', 400);

    const officialFounder = stripTitle(school.founderName || (slug === 'epc-manoi' ? 'LAWANI MOUSSA' : ''));
    const officialDirector = stripTitle(school.directorName || school.studiesDirectorName || (slug === 'epc-manoi' ? 'LAWANI MOUHAMED' : ''));
    const record = staff.find((s) => s.roleId === roleId);

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
      { staffUser: record }
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

  return issueSession({ slug, roleId, code: inputCode, staffId: record.id, subscriptionEndDate }, { staffUser: record });
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
  extra: { staffUser?: any; matchedStudents?: Student[] }
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
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
