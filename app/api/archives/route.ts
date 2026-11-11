import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import { jsonError, requireSession } from '@/lib/server/auth';
import { kvSchoolId } from '@/lib/supabase/kv';
import { getStaffAuthRecords } from '@/lib/supabase/services';
import { FOUNDER_ROLES, ROLE_LABELS } from '@/lib/auth/roles';
import { verifyFiguresCode } from '@/lib/server/figures-code';
import {
  ARCHIVE_LIST_COLUMNS as LIST_COLUMNS,
  ARCHIVE_SECTIONS,
  ArchiveSection,
  ArchiveSnapshot,
  createArchive,
  extractSection,
} from '@/lib/server/archives';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * ARCHIVES DES ANNÉES SCOLAIRES — accès strict :
 *  - Fondateur et Fondateur adjoint (DGA) : consultation + création d'archives ;
 *  - Comptable : consultation SEULEMENT avec le code des chiffres (en-tête x-figures-code,
 *    vérifié ici à chaque demande ; 3 codes faux → 30 min de blocage, compteur en base) ;
 *  - tous les autres postes : refusé.
 *
 * GET                       → liste des archives (sans leur contenu)
 * GET ?id=…&section=…       → une rubrique d'une archive (résumé, élèves, salaires…)
 * POST { kind, label? }     → nouvelle archive (Fondateur / DGA)
 *   kind = 'cloture' (clôture d'année, gardée pour toujours) | 'manuel' (sauvegarde ponctuelle)
 *
 * Sauvegarde automatique : à l'ouverture de la page par le Fondateur ou le DGA, si la dernière
 * date de plus de 7 jours, une archive « auto » est prise ; seules les 8 plus récentes « auto »
 * sont gardées (les clôtures et sauvegardes manuelles ne sont JAMAIS supprimées).
 */
const AUTO_EVERY_MS = 7 * 24 * 60 * 60 * 1000;
const AUTO_KEEP = 8;
const NO_STORE = { 'Cache-Control': 'no-store' };

type Access = { ok: true; session: any; slug: string; schoolId: string; founder: boolean } | { ok: false; res: NextResponse };

async function checkAccess(request: NextRequest): Promise<Access> {
  const auth = await requireSession(request);
  if ('error' in auth) return { ok: false, res: auth.error };
  const { session, slug } = auth;
  const founder = FOUNDER_ROLES.includes(session.roleId);
  if (!founder && session.roleId !== 'comptable') {
    return { ok: false, res: jsonError('Archives réservées au Fondateur et au Fondateur adjoint (DGA).', 403) };
  }
  const schoolId = await kvSchoolId(slug);
  if (!schoolId) return { ok: false, res: jsonError('Archives indisponibles pour le moment. Réessayez.', 503) };
  if (!founder) {
    const check = await verifyFiguresCode(slug, schoolId, session, request.headers.get('x-figures-code') || '');
    if (!check.ok) {
      return {
        ok: false,
        res: NextResponse.json(
          { success: false, needCode: true, error: check.error, ...(check.lockedUntil ? { lockedUntil: check.lockedUntil } : {}) },
          { status: check.status === 400 ? 401 : check.status, headers: NO_STORE }
        ),
      };
    }
  }
  return { ok: true, session, slug, schoolId, founder };
}

async function actorName(slug: string, session: any): Promise<string> {
  const label = ROLE_LABELS[session.roleId] || 'Direction';
  try {
    const staff = await getStaffAuthRecords(slug);
    const me = staff.find((s) => s.id === session.staffId);
    if (me?.fullName) return `${me.fullName} — ${label}`;
  } catch {}
  return label;
}


export async function GET(request: NextRequest) {
  const access = await checkAccess(request);
  if (!access.ok) return access.res;
  const { slug, schoolId, founder, session } = access;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  // ─── Une rubrique d'une archive ───
  if (id) {
    const section = String(searchParams.get('section') || 'resume') as ArchiveSection;
    if (!ARCHIVE_SECTIONS.includes(section)) return jsonError('Rubrique inconnue.', 400);
    const { data, error } = await supabase
      .from('school_archives')
      .select('id, data')
      .eq('school_id', schoolId)
      .eq('id', id)
      .maybeSingle();
    if (error) return jsonError('Lecture de l’archive impossible pour le moment.', 503);
    if (!data) return jsonError('Archive introuvable.', 404);
    let snap: ArchiveSnapshot;
    try {
      snap = JSON.parse(data.data);
    } catch {
      return jsonError('Archive illisible.', 500);
    }
    return NextResponse.json({ success: true, section, rows: extractSection(snap, section) }, { headers: NO_STORE });
  }

  // ─── Liste ───
  const list = async () =>
    supabase.from('school_archives').select(LIST_COLUMNS).eq('school_id', schoolId).order('created_at', { ascending: false }).limit(500);
  let { data, error } = await list();
  if (error) {
    const missing = /(does not exist|not find|schema cache)/i.test(error.message || '');
    return jsonError(
      missing
        ? 'La table des archives n’existe pas encore : lancez le script 012 dans Supabase (SQL Editor).'
        : 'Lecture des archives impossible pour le moment.',
      503
    );
  }

  // Sauvegarde automatique hebdomadaire (Fondateur / DGA uniquement).
  let autoCreated = false;
  if (founder) {
    const latest = (data || [])[0];
    const age = latest ? Date.now() - Date.parse(latest.created_at) : Infinity;
    if (age > AUTO_EVERY_MS) {
      const res = await createArchive(slug, schoolId, 'auto', 'Sauvegarde automatique hebdomadaire', 'SchoolFlow (automatique)');
      if ('row' in res) {
        autoCreated = true;
        const autos = [res.row, ...(data || [])].filter((a: any) => a.kind === 'auto');
        const toDelete = autos.slice(AUTO_KEEP).map((a: any) => a.id);
        if (toDelete.length) {
          await supabase.from('school_archives').delete().eq('school_id', schoolId).eq('kind', 'auto').in('id', toDelete);
        }
        ({ data, error } = await list());
      }
    }
  }

  const { data: sch } = await supabase.from('schools').select('academic_year').eq('id', schoolId).maybeSingle();
  return NextResponse.json(
    {
      success: true,
      archives: data || [],
      canCreate: founder,
      roleId: session.roleId,
      autoCreated,
      academicYear: (sch as any)?.academic_year || '',
    },
    { headers: NO_STORE }
  );
}

export async function POST(request: NextRequest) {
  const access = await checkAccess(request);
  if (!access.ok) return access.res;
  const { slug, schoolId, founder, session } = access;
  if (!founder) return jsonError('Seuls le Fondateur et le DGA peuvent créer une archive.', 403);
  let body: any = {};
  try {
    body = await request.json();
  } catch {}
  const kind = body?.kind === 'cloture' ? 'cloture' : 'manuel';
  const label =
    String(body?.label || '').trim() || (kind === 'cloture' ? 'Clôture de l’année scolaire' : 'Sauvegarde manuelle');
  const res = await createArchive(slug, schoolId, kind, label, await actorName(slug, session));
  if ('error' in res) return jsonError(res.error as string, 503);
  return NextResponse.json({ success: true, archive: res.row }, { headers: NO_STORE });
}
