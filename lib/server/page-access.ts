import { PAGE_ACCESS_KEY, type PageOverrides } from '@/lib/auth/roles';
import { kvGet, kvSchoolId } from '@/lib/supabase/kv';

/**
 * Pages accordées / retirées par poste (réglées par le Fondateur dans « Accès par poste »),
 * lues en base au plus toutes les 15 s par école. Base injoignable : aucun réglage (droits par défaut).
 */
const cache = new Map<string, { value: PageOverrides; at: number }>();

export async function getPageOverrides(slug: string): Promise<PageOverrides> {
  const canonical = slug === 'college-excellence' ? 'epc-manoi' : slug;
  const hit = cache.get(canonical);
  if (hit && Date.now() - hit.at < 15_000) return hit.value;
  try {
    const schoolId = await kvSchoolId(canonical);
    if (!schoolId) return {};
    const row = await kvGet(schoolId, `${PAGE_ACCESS_KEY}_${canonical}`);
    let value: PageOverrides = {};
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) value = parsed;
    }
    cache.set(canonical, { value, at: Date.now() });
    return value;
  } catch {
    return {};
  }
}
