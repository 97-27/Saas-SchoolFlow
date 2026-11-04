import { NextRequest, NextResponse } from 'next/server';
import { requireSession, jsonError } from '@/lib/server/auth';
import { actorLabel, setRequestActor } from '@/lib/server/actor';
import { kvFamilyForKey } from '@/lib/data/cloud-kv-keys';
import { kvSchoolId, kvList, kvGet, kvPut, mergeKvValue, kvIds, MAX_VALUE_LENGTH } from '@/lib/supabase/kv';

/**
 * Données enregistrées en base à la place du seul navigateur (notes, appel, dépenses, salaires…).
 * GET  /api/kv?slug=X[&since=date]  → les valeurs que ce rôle peut lire (modifiées depuis « since »).
 * POST /api/kv { slug, changes: [{ key, value, baseIds }] } → fusion puis enregistrement.
 * Le rôle et l'école viennent TOUJOURS de la session signée, jamais du navigateur.
 */
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET(request: NextRequest) {
  const slugParam = request.nextUrl.searchParams.get('slug');
  const auth = await requireSession(request, slugParam);
  if ('error' in auth) return auth.error;
  const { session, slug } = auth;

  const schoolId = await kvSchoolId(slug);
  if (!schoolId) return jsonError('Établissement introuvable.', 404);

  const since = request.nextUrl.searchParams.get('since');
  const rows = await kvList(schoolId, since && !isNaN(Date.parse(since)) ? since : null);
  if (!rows) return jsonError('Lecture impossible pour le moment.', 503);

  const entries = rows.filter((r) => {
    const fam = kvFamilyForKey(r.key, slug);
    return !!fam && fam.read.includes(session.roleId);
  });
  return NextResponse.json({ success: true, serverTime: new Date().toISOString(), entries }, { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError('Requête invalide.', 400);
  }
  const auth = await requireSession(request, body?.slug);
  if ('error' in auth) return auth.error;
  const { session, slug } = auth;
  setRequestActor(session);
  const actor = actorLabel(session);

  const schoolId = await kvSchoolId(slug);
  if (!schoolId) return jsonError('Établissement introuvable.', 404);

  const changes: any[] = Array.isArray(body?.changes) ? body.changes.slice(0, 200) : [];
  const results: any[] = [];

  for (const change of changes) {
    const key = typeof change?.key === 'string' ? change.key : '';
    const value = typeof change?.value === 'string' ? change.value : null;
    const baseIds = Array.isArray(change?.baseIds) ? change.baseIds.map(String).slice(0, 100000) : null;

    const fam = kvFamilyForKey(key, slug);
    if (!fam || value === null) {
      results.push({ key, ok: false, error: 'Donnée non reconnue.' });
      continue;
    }
    if (!fam.write.includes(session.roleId)) {
      results.push({ key, ok: false, forbidden: true, error: `Modification réservée (${fam.label}).` });
      continue;
    }
    if (value.length > MAX_VALUE_LENGTH) {
      results.push({ key, ok: false, error: 'Donnée trop volumineuse.' });
      continue;
    }

    const current = await kvGet(schoolId, key);
    if (current === undefined) {
      results.push({ key, ok: false, error: 'Lecture impossible pour le moment.' });
      continue;
    }
    const merged = mergeKvValue(current ? current.value : null, value, baseIds);
    if ('refused' in merged) {
      results.push({ key, ok: false, refused: true, error: merged.refused, value: current?.value ?? null, updatedAt: current?.updatedAt ?? null, ids: kvIds(current?.value) });
      continue;
    }
    if (current && current.value === merged.value) {
      results.push({ key, ok: true, value: current.value, updatedAt: current.updatedAt, ids: kvIds(current.value) });
      continue;
    }
    const saved = await kvPut(schoolId, key, merged.value, actor);
    if (!saved) {
      results.push({ key, ok: false, error: 'Enregistrement impossible pour le moment.' });
      continue;
    }
    results.push({ key, ok: true, value: saved.value, updatedAt: saved.updatedAt, ids: kvIds(saved.value) });
  }

  return NextResponse.json({ success: true, results }, { headers: NO_STORE });
}
