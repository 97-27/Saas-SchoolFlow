import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import { jsonError, requireSession } from '@/lib/server/auth';
import { kvSchoolId } from '@/lib/supabase/kv';
import { getStaffAuthRecords } from '@/lib/supabase/services';
import { FOUNDER_ROLES, ROLE_LABELS } from '@/lib/auth/roles';
import { kvFamilyForKey } from '@/lib/data/cloud-kv-keys';
import { createArchive, listAllKv } from '@/lib/server/archives';
import { bumpYearEpoch } from '@/lib/server/year-epoch';
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from '@/lib/server/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * PASSER À L'ANNÉE SUIVANTE — Fondateur et DGA uniquement (décision de l'établissement 11/2026).
 *
 * 1. Archive de clôture COMPLÈTE de l'année (si elle échoue, on s'arrête : rien n'est effacé).
 * 2. Remise à zéro de TOUTES les pages : élèves, reçus et paiements, internat / cantine /
 *    transport, échéanciers, salaires, dépenses, réductions, rappels, appel des élèves, notes,
 *    bulletins, distinctions, santé, documents, notes diverses, messages des parents, annonces,
 *    pointage du personnel, matières / classes des enseignants, Corbeille & Journal.
 *    Administration & Codes : seuls le Fondateur et le DGA restent (sauf si « garder le personnel »).
 * 3. Réglages conservés (ce ne sont pas des données de l'année) : identité de l'école, logo,
 *    cachet, position et horaires de pointage, code des chiffres, coefficients des notes, lignes
 *    de transport, capacité de l'internat, menu de la cantine.
 * 4. Nouveau numéro d'année : toutes les sessions ouvertes sont fermées, chaque appareil efface
 *    sa copie locale à la reconnexion (lib/server/year-epoch.ts, lib/client/year-reset.ts).
 *
 * Sécurité : le Fondateur / DGA retape son propre code d'accès ET la phrase « NOUVELLE ANNÉE ».
 */

/** Familles synchronisées qui sont des RÉGLAGES (gardées) et non des données de l'année. */
const KEEP_FAMILIES = new Set(['schoolflow_grades_config_v1', 'schoolflow_transport_lines']);
/** Clés privées de l'année (supprimées). Les autres clés privées sont des réglages ou des codes. */
const PRIVATE_YEAR_PREFIXES = [
  'sf_private_teacher_teaching_',
  'sf_private_teacher_login_attempts_',
  'sf_private_figures_attempts_',
];
const isPointageDayKey = (k: string) => /^sf_private_pointage_\d{4}-\d{2}-\d{2}_/.test(k);
const NON_FOUNDER_STAFF = ['directeur', 'informaticien', 'assistant_direction', 'secretaire', 'comptable', 'enseignant', 'educateur'];

const normalize = (v: string) =>
  v.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if ('error' in auth) return auth.error;
  const { session, slug } = auth;
  if (!FOUNDER_ROLES.includes(session.roleId)) {
    return jsonError('Seuls le Fondateur et le DGA peuvent passer à l’année suivante.', 403);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError('Requête invalide.', 400);
  }
  const newYear = String(body?.newYear || '').trim();
  const keepStaff = body?.keepStaff === true;
  const m = newYear.match(/^(\d{4})-(\d{4})$/);
  if (!m || Number(m[2]) !== Number(m[1]) + 1) {
    return jsonError('Nouvelle année invalide : écrivez-la comme « 2027-2028 ».', 400);
  }
  if (normalize(String(body?.confirmText || '')) !== 'NOUVELLE ANNEE') {
    return jsonError('Tapez exactement « NOUVELLE ANNÉE » pour confirmer.', 400);
  }
  if (String(body?.code || '').trim().toUpperCase() !== String(session.code || '').trim().toUpperCase()) {
    await new Promise((r) => setTimeout(r, 600));
    return jsonError('Code d’accès incorrect : retapez VOTRE code personnel de connexion.', 403);
  }

  const schoolId = await kvSchoolId(slug);
  if (!schoolId) return jsonError('Établissement introuvable. Réessayez.', 503);
  const { data: sch, error: schErr } = await supabase.from('schools').select('academic_year').eq('id', schoolId).maybeSingle();
  if (schErr || !sch) return jsonError('Lecture de l’établissement impossible. Réessayez.', 503);
  const oldYear = String((sch as any).academic_year || '');
  if (oldYear === newYear) return jsonError(`L’établissement est déjà en ${newYear}.`, 409);

  // Auteur (journal de l'archive).
  let actor = ROLE_LABELS[session.roleId] || 'Direction';
  try {
    const me = (await getStaffAuthRecords(slug)).find((s) => s.id === session.staffId);
    if (me?.fullName) actor = `${me.fullName} — ${actor}`;
  } catch {}

  // ─── 1. Archive de clôture (réutilisée si un essai précédent s'est arrêté en route) ───
  const recentCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from('school_archives')
    .select('id')
    .eq('school_id', schoolId)
    .eq('kind', 'cloture')
    .eq('academic_year', oldYear)
    .like('label', `Clôture avant passage à ${newYear}%`)
    .gt('created_at', recentCutoff)
    .limit(1);
  if (!recent || recent.length === 0) {
    const arch = await createArchive(slug, schoolId, 'cloture', `Clôture avant passage à ${newYear}`, actor);
    if ('error' in arch) return jsonError(`Archive de clôture impossible — RIEN n’a été effacé. ${arch.error}`, 503);
  }

  // ─── 2. Remise à zéro ───
  const failures: string[] = [];
  const del = async (label: string, run: () => PromiseLike<{ error: any }>) => {
    const { error } = await run();
    // Table absente (migration non lancée) : rien à effacer.
    if (error && !/(does not exist|not find|schema cache)/i.test(error.message || '')) failures.push(`${label} (${error.message})`);
  };

  await del('mois payés des services', () => supabase.from('service_month_payments').delete().eq('school_id', schoolId));
  await del('abonnements des services', () => supabase.from('service_subscriptions').delete().eq('school_id', schoolId));
  await del('reçus', () => supabase.from('invoices').delete().eq('school_id', schoolId));
  await del('reçus supprimés', () => supabase.from('deleted_invoices').delete().eq('school_id', schoolId));
  await del('élèves', () => supabase.from('students').delete().eq('school_id', schoolId));
  await del('notes diverses / messages', () =>
    supabase.from('staff_users').delete().eq('school_id', schoolId).in('role_id', ['system_diverse_notes', 'system_parent_messages'])
  );
  if (!keepStaff) {
    await del('personnel', () => supabase.from('staff_users').delete().eq('school_id', schoolId).in('role_id', NON_FOUNDER_STAFF));
  }

  // Bloc des services : on ne garde que les réglages (capacité de l'internat, menu de la cantine).
  {
    const { data: blobRow, error } = await supabase
      .from('staff_users')
      .select('id, department')
      .eq('school_id', schoolId)
      .eq('role_id', 'system_services_data')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) failures.push(`services (${error.message})`);
    else if (blobRow) {
      let blob: any = {};
      try {
        blob = JSON.parse((blobRow as any).department || '{}');
      } catch {}
      const kept: any = {};
      if (blob.boardingCapacity !== undefined) kept.boardingCapacity = blob.boardingCapacity;
      if (blob.canteenWeeklyMenu !== undefined) kept.canteenWeeklyMenu = blob.canteenWeeklyMenu;
      const { error: upErr } = await supabase.from('staff_users').update({ department: JSON.stringify(kept) }).eq('id', (blobRow as any).id);
      if (upErr) failures.push(`services (${upErr.message})`);
    }
  }

  // Données de l'année gardées dans school_kv.
  const rows = await listAllKv(schoolId);
  if (!rows) failures.push('données synchronisées (lecture impossible)');
  else {
    const toDelete = rows
      .map((r) => r.key)
      .filter((k) => {
        if (isPointageDayKey(k)) return true;
        if (PRIVATE_YEAR_PREFIXES.some((p) => k.startsWith(p))) return true;
        if (k.startsWith('sf_private_')) return false;
        const fam = kvFamilyForKey(k, slug);
        if (!fam || KEEP_FAMILIES.has(fam.base)) return false;
        if (keepStaff && fam.base === 'schoolflow_teachers_data_v3') return false;
        return true;
      });
    for (let i = 0; i < toDelete.length; i += 100) {
      const chunk = toDelete.slice(i, i + 100);
      await del('données synchronisées', () => supabase.from('school_kv').delete().eq('school_id', schoolId).in('key', chunk));
    }
  }

  // Corbeille & Journal : les élèves effacés ne doivent pas pouvoir « revenir » dans la nouvelle année.
  // (Non bloquant : un journal non vidé n'empêche pas d'ouvrir la nouvelle année.)
  {
    const { error } = await supabase.from('data_journal').delete().eq('school_id', schoolId);
    if (error) console.warn('[SchoolFlow] Journal non vidé au passage d’année :', error.message);
  }

  if (failures.length) {
    return jsonError(
      `Remise à zéro incomplète (l’archive de l’année est bien enregistrée) : ${failures.slice(0, 3).join(' ; ')}. Relancez « Passer à l’année suivante » : l’archive ne sera pas refaite.`,
      503
    );
  }

  // ─── 3. Nouvelle année ───
  const { error: yErr } = await supabase
    .from('schools')
    .update({ academic_year: newYear, current_term: 'Trimestre 1' })
    .eq('id', schoolId);
  if (yErr) return jsonError('Données remises à zéro, mais l’année n’a pas pu être changée. Modifiez-la dans Paramètres.', 503);

  const epoch = await bumpYearEpoch(slug, schoolId, { from: oldYear, to: newYear, actor: `${session.roleId}|${session.staffId || ''}` });
  if (epoch === null) return jsonError('Année changée, mais les appareils connectés n’ont pas pu être prévenus. Réessayez.', 503);

  // La personne qui vient de passer l'année garde sa session (avec le nouveau numéro).
  const { iat, exp, ...rest } = session as any;
  const token = await createSessionToken({ ...rest, yearEpoch: epoch });
  const res = NextResponse.json(
    { success: true, oldYear, newYear, yearEpoch: epoch, keptStaff: keepStaff },
    { headers: { 'Cache-Control': 'no-store' } }
  );
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
