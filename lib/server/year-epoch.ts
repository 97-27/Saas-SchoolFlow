import { kvGet, kvPut, kvSchoolId } from '@/lib/supabase/kv';

/**
 * NUMÉRO D'ANNÉE SCOLAIRE (« époque ») de chaque école — clé privée school_kv.
 * Augmente de 1 à chaque « Passer à l'année suivante ». Il est inscrit dans chaque session à la
 * connexion : une session ouverte AVANT le passage (autre téléphone, onglet oublié) n'a plus le
 * bon numéro → refusée (401) → la personne se reconnecte et son appareil efface sa copie locale
 * de l'année passée. Ainsi aucun appareil ne peut renvoyer en base les données de l'ancienne
 * année, ni les réafficher.
 */
export const YEAR_EPOCH_KEY = 'sf_private_year_epoch';

type Cached = { epoch: number; at: number };
const cache = new Map<string, Cached>();
const CACHE_MS = 10_000;

/** Numéro actuel (0 tant qu'aucun passage n'a eu lieu) ; null si la base est injoignable. */
export async function getYearEpoch(slug: string, fresh = false): Promise<number | null> {
  const hit = cache.get(slug);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.epoch;
  try {
    const schoolId = await kvSchoolId(slug);
    if (!schoolId) return hit ? hit.epoch : null;
    const row = await kvGet(schoolId, YEAR_EPOCH_KEY);
    if (row === undefined) return hit ? hit.epoch : null; // lecture impossible
    let epoch = 0;
    if (row) {
      try {
        epoch = Number(JSON.parse(row.value).epoch) || 0;
      } catch {}
    }
    cache.set(slug, { epoch, at: Date.now() });
    return epoch;
  } catch {
    return hit ? hit.epoch : null;
  }
}

export async function bumpYearEpoch(slug: string, schoolId: string, info: { from: string; to: string; actor: string }): Promise<number | null> {
  const current = (await getYearEpoch(slug, true)) ?? 0;
  const epoch = current + 1;
  const saved = await kvPut(
    schoolId,
    YEAR_EPOCH_KEY,
    JSON.stringify({ epoch, from: info.from, to: info.to, at: new Date().toISOString() }),
    info.actor
  );
  if (!saved) return null;
  cache.set(slug, { epoch, at: Date.now() });
  return epoch;
}
