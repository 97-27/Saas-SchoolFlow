import { NextRequest, NextResponse } from 'next/server';
import {
  getAllSchoolsFromSupabase,
  getSchoolFromSupabase,
  saveSchoolToSupabase,
  getSchoolSubscriptionInfo,
  getStudentsFromSupabase,
  saveStudentToSupabase,
  deleteStudentFromSupabase,
  getInvoicesFromSupabase,
  saveInvoiceToSupabase,
  deleteInvoiceFromSupabase,
  saveStaffUserToSupabase,
  deleteStaffUserFromSupabase,
  updateStaffContactInSupabase,
  getServicesDataFromSupabase,
  saveServicesDataToSupabase,
} from '@/lib/supabase/services';
import {
  requireSession,
  isAdmin,
  isStaff,
  hasRole,
  jsonError,
  canonicalSlug,
  STAFF_ROLES,
  STUDENT_WRITE_ROLES,
  DELETE_ROLES,
  SERVICES_WRITE_ROLES,
} from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

/** Codes réservés aux lignes techniques de staff_users (cachet, données de services...). */
const RESERVED_CODE = /^(SYS-|STAMP-)/i;

function ok(result: unknown) {
  return NextResponse.json({ success: true, result }, { headers: { 'Cache-Control': 'no-store' } });
}

/**
 * Point d'entrée unique des accès aux données depuis le navigateur (lib/supabase/remote.ts).
 * Chaque opération vérifie : session signée valide, établissement = celui de la session, rôle
 * autorisé pour l'opération. Toute opération inconnue est refusée.
 */
export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return jsonError('Requête invalide.', 400);
  }
  const op: string = body?.op;
  const args: any[] = Array.isArray(body?.args) ? body.args : [];

  // Seule opération publique : la liste réduite des établissements (nom, sigle, logo, ville),
  // nécessaire à la page de connexion. Aucune coordonnée privée n'est renvoyée.
  if (op === 'getAllSchools') {
    const schools = await getAllSchoolsFromSupabase();
    return ok(
      schools.map((s) => ({
        id: s.id,
        slug: s.slug,
        name: s.name,
        shortName: s.shortName,
        logoUrl: s.logoUrl,
        logoColor: s.logoColor,
        city: s.city,
        country: s.country,
        academicYear: s.academicYear,
        currentTerm: s.currentTerm,
        motto: s.motto,
        slogan: s.slogan,
        status: s.status,
        subscriptionPlan: s.subscriptionPlan,
        subscriptionActive: s.subscriptionActive,
        createdAt: s.createdAt,
      }))
    );
  }

  // Toutes les opérations suivantes portent sur UN établissement : son slug est en argument.
  const slugArg: string | undefined =
    op === 'saveSchool' ? args[0]?.slug : op === 'saveServicesData' || op === 'getServicesData' ? args[0] : args[args.length - 1];
  const auth = await requireSession(request, typeof slugArg === 'string' ? slugArg : null);
  if ('error' in auth) return auth.error;
  const { session, slug } = auth;
  if (!slugArg || canonicalSlug(slugArg) !== slug) {
    return jsonError('Établissement manquant ou invalide.', 400);
  }

  const deny = () => jsonError('Action non autorisée pour votre profil.', 403);

  switch (op) {
    case 'getSubscriptionInfo':
      return ok(await getSchoolSubscriptionInfo(slug));

    case 'getSchool':
      if (!isStaff(session)) return deny();
      return ok(await getSchoolFromSupabase(slug));

    case 'saveSchool':
      if (!isAdmin(session)) return deny();
      return ok(await saveSchoolToSupabase({ ...args[0], slug }));

    case 'getStudents':
      if (!isStaff(session)) return deny();
      return ok(await getStudentsFromSupabase(slug));

    case 'getInvoices':
      if (!isStaff(session)) return deny();
      return ok(await getInvoicesFromSupabase(slug));

    case 'saveStudent':
      if (!hasRole(session, STUDENT_WRITE_ROLES)) return deny();
      return ok(await saveStudentToSupabase(args[0], slug));

    case 'saveInvoice':
      if (!hasRole(session, STUDENT_WRITE_ROLES)) return deny();
      return ok(await saveInvoiceToSupabase(args[0], slug));

    case 'deleteStudent':
      if (!hasRole(session, DELETE_ROLES)) return deny();
      return ok(await deleteStudentFromSupabase(String(args[0] || ''), slug));

    case 'deleteInvoice':
      if (!hasRole(session, DELETE_ROLES)) return deny();
      return ok(await deleteInvoiceFromSupabase(String(args[0] || ''), slug));

    case 'getServicesData':
      if (!isStaff(session)) return deny();
      return ok(await getServicesDataFromSupabase(slug));

    case 'saveServicesData':
      if (!hasRole(session, SERVICES_WRITE_ROLES)) return deny();
      return ok(await saveServicesDataToSupabase(slug, args[1]));

    case 'saveStaffUser': {
      const staff = args[0] || {};
      const rawCode = String(staff.authCode || '').trim();
      if (!rawCode || RESERVED_CODE.test(rawCode)) return deny();

      if (isAdmin(session)) {
        if (!STAFF_ROLES.includes(staff.roleId)) return jsonError('Rôle inconnu.', 400);
        return ok(await saveStaffUserToSupabase({ ...staff, authCode: rawCode }, slug));
      }
      // Un membre non administrateur ne peut modifier que SES coordonnées, jamais son rôle,
      // son code ou son statut (sinon il pourrait se promouvoir Directeur).
      if (isStaff(session) && rawCode.toUpperCase() === session.code.toUpperCase()) {
        return ok(
          await updateStaffContactInSupabase(slug, rawCode, {
            fullName: staff.fullName,
            email: staff.email,
            phone: staff.phone,
            avatarUrl: staff.avatarUrl,
          })
        );
      }
      return deny();
    }

    case 'deleteStaffUser': {
      if (!isAdmin(session)) return deny();
      const rawCode = String(args[0] || '').trim();
      if (!rawCode || RESERVED_CODE.test(rawCode) || rawCode.toUpperCase() === session.code.toUpperCase()) return deny();
      return ok(await deleteStaffUserFromSupabase(rawCode, slug));
    }

    default:
      return jsonError('Opération inconnue.', 400);
  }
}
