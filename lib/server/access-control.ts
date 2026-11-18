import { getAccessControl, DEFAULT_BLOCK_MESSAGE } from '@/lib/supabase/services';

/**
 * Blocage d'une école par la plateforme : lu en base au plus toutes les 15 s par école
 * (les sessions déjà ouvertes sont donc coupées en moins d'une minute).
 */
const cache = new Map<string, { blocked: boolean; message: string; at: number }>();
const CACHE_MS = 15_000;

export async function getBlockState(slug: string): Promise<{ blocked: boolean; message: string }> {
  if (!slug || slug === 'epc-manoi') return { blocked: false, message: '' };
  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < CACHE_MS) return { blocked: hit.blocked, message: hit.message };
  try {
    const a = await getAccessControl(slug);
    const state = { blocked: a.blocked, message: a.blockMessage || DEFAULT_BLOCK_MESSAGE, at: Date.now() };
    cache.set(slug, state);
    return { blocked: state.blocked, message: state.message };
  } catch (e) {
    return { blocked: false, message: '' }; // base injoignable : on ne bloque pas
  }
}

export function forgetBlockState(slug: string) {
  cache.delete(slug);
}
