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
  deleteServiceInvoicesFromSupabase,
  applyServiceChangesToSupabase,
  getSchoolDataVersion,
  getJournalFromSupabase,
  restoreJournalInSupabase,
  purgeJournalInSupabase,
  saveStaffUserToSupabase,
  deleteStaffUserFromSupabase,
  updateStaffContactInSupabase,
  getServicesDataFromSupabase,
  saveServicesDataToSupabase,
  getStaffUsersFromSupabase,
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
import { isLegacyDemoStudent, isLegacyDemoInvoice } from '@/lib/data/legacy-ids';
import { setRequestActor, actorLabel } from '@/lib/server/actor';

export const dynamic = 'force-dynamic';

/** Codes réservés aux lignes techniques de staff_users (cachet, données de services...). */
// Codes système, et anciens codes de démonstration identiques pour toutes les écoles.
const RESERVED_CODE = /^(SYS-|STAMP-|FND-2026$|DIR-2026$)/i;

/** Codes d'accès et profils du personnel : réservés au seul Directeur (sauf le compte du
 *  Fondateur lui-même, protégé plus bas). Corbeille & Journal : réservés au seul Fondateur. */
const isDirector = (session: { roleId: string }) => session.roleId === 'directeur';
const isFounder = (session: { roleId: string }) => session.roleId === 'fondateur';

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
  // Position du slug dans les arguments. saveStudent et saveStaffUser portent des réglages APRÈS
  // le slug (identityOnly, versements attendus, changement de code) : prendre « le dernier
  // argument » renvoyait ce réglage au lieu du slug, et le serveur REFUSAIT alors tous les
  // enregistrements d'élèves et de personnel (versements perdus le 05/11).
  const slugArg: string | undefined =
    op === 'saveSchool'
      ? args[0]?.slug
      : op === 'saveServicesData' || op === 'getServicesData'
        ? args[0]
        : op === 'saveStudent' || op === 'saveStaffUser'
          ? args[1]
          : args[args.length - 1];
  const auth = await requireSession(request, typeof slugArg === 'string' ? slugArg : null);
  if ('error' in auth) return auth.error;
  const { session, slug } = auth;
  if (!slugArg || canonicalSlug(slugArg) !== slug) {
    return jsonError('Établissement manquant ou invalide.', 400);
  }
  // Auteur de toutes les écritures de cette requête (journal, migration 007).
  setRequestActor(session);

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
      if (isLegacyDemoStudent(args[0])) return ok(false);
      return ok(
        await saveStudentToSupabase(args[0], slug, {
          identityOnly: args[2] === true,
          expectedVersements: Array.isArray(args[3]) ? args[3].slice(0, 5).map((v: any) => Number(v) || 0) : null,
        })
      );

    case 'saveInvoice':
      if (!hasRole(session, STUDENT_WRITE_ROLES)) return deny();
      if (isLegacyDemoInvoice(args[0])) return ok(false);
      return ok(await saveInvoiceToSupabase(args[0], slug));

    case 'deleteStudent':
      if (!hasRole(session, DELETE_ROLES)) return deny();
      return ok(await deleteStudentFromSupabase(String(args[0] || ''), slug));

    case 'deleteInvoice':
      if (!hasRole(session, DELETE_ROLES)) return deny();
      return ok(await deleteInvoiceFromSupabase(String(args[0] || ''), slug));

    case 'applyServiceChanges':
      if (!hasRole(session, SERVICES_WRITE_ROLES)) return deny();
      return ok(await applyServiceChangesToSupabase(slug, Array.isArray(args[0]) ? args[0] : []));

    case 'getDataVersion':
      return ok(await getSchoolDataVersion(slug));

    // Corbeille & Journal : réservés au Fondateur (choix de l'établissement).
    case 'getJournal': {
      if (!isFounder(session)) return deny();
      const kind = args[0] === 'changes' || args[0] === 'all' ? args[0] : 'trash';
      return ok(await getJournalFromSupabase(slug, kind, Number(args[1]) || 400));
    }

    case 'restoreJournal':
      if (!isFounder(session)) return deny();
      return ok(await restoreJournalInSupabase(slug, Number(args[0]), actorLabel(session)));

    case 'purgeJournal':
      if (!isFounder(session)) return deny();
      return ok(await purgeJournalInSupabase(slug, args[0] === 'all' ? 'all' : Number(args[0])));

    case 'deleteServiceInvoices':
      if (!hasRole(session, DELETE_ROLES) && !hasRole(session, SERVICES_WRITE_ROLES)) return deny();
      return ok(await deleteServiceInvoicesFromSupabase(String(args[0] || ''), args[1], slug));

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

      // Créer / modifier les profils et les codes d'accès (« Administration & Codes ») : Fondateur
      // et Directeur. Le Directeur ne peut ni créer ni modifier un compte Fondateur. Les autres
      // membres ne modifient que leurs propres coordonnées.
      if (isAdmin(session)) {
        if (!STAFF_ROLES.includes(staff.roleId)) return jsonError('Rôle inconnu.', 400);
        if (/^MASQUE-/i.test(rawCode)) return deny();
        if (isDirector(session) && rawCode.toUpperCase() !== session.code.toUpperCase()) {
          const current = (await getStaffUsersFromSupabase(slug)).find(
            (s: any) => String(s.authCode || '').toUpperCase() === rawCode.toUpperCase() || (staff.id && s.id === staff.id)
          );
          if (staff.roleId === 'fondateur' || current?.roleId === 'fondateur') {
            return jsonError('Le compte du Fondateur ne peut être modifié que par le Fondateur lui-même.', 403);
          }
        }
        return ok(await saveStaffUserToSupabase({ ...staff, authCode: rawCode }, slug, args[2] === true));
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
      // Fondateur : peut supprimer tout membre, Directeur compris. Directeur : tout membre SAUF
      // le Fondateur. Personne ne peut supprimer son propre compte.
      if (!isAdmin(session)) return deny();
      const rawCode = String(args[0] || '').trim();
      if (!rawCode || RESERVED_CODE.test(rawCode) || /^MASQUE-/i.test(rawCode) || rawCode.toUpperCase() === session.code.toUpperCase()) return deny();
      const target = (await getStaffUsersFromSupabase(slug)).find(
        (s: any) => String(s.authCode || '').toUpperCase() === rawCode.toUpperCase()
      );
      if (isDirector(session) && target?.roleId === 'fondateur') {
        return jsonError('Le Directeur ne peut pas supprimer le compte du Fondateur.', 403);
      }
      return ok(await deleteStaffUserFromSupabase(rawCode, slug));
    }

    default:
      return jsonError('Opération inconnue.', 400);
  }
}
