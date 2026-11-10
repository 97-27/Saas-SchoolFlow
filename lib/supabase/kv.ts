import { supabaseAdmin as supabase } from './admin';
import { isSupabaseConfigured } from './client';
import { kvIdsOf } from '@/lib/data/cloud-kv-keys';

/**
 * Stockage en base des données qui n'existaient que dans le navigateur (table school_kv,
 * migration 008). Voir lib/data/cloud-kv-keys.ts pour la liste et les droits.
 */

export type KvRow = { key: string; value: string; updatedAt: string };

/** Au-delà, une seule écriture qui ferait disparaître autant d'éléments d'une liste est refusée
 *  (protection contre un onglet périmé qui renverrait une liste vide ou incomplète — cas de
 *  l'internat vidé). Une vraie suppression se fait un élément à la fois. */
export const MAX_LIST_REMOVALS_PER_WRITE = 5;
/** Taille maximale d'une valeur (≈ 2 Mo). */
export const MAX_VALUE_LENGTH = 2_000_000;

const schoolIdCache = new Map<string, string>();

export async function kvSchoolId(slug: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const cached = schoolIdCache.get(slug);
  if (cached) return cached;
  const { data, error } = await supabase.from('schools').select('id').eq('slug', slug).limit(1).maybeSingle();
  if (error || !data?.id) return null;
  schoolIdCache.set(slug, data.id);
  return data.id;
}

export async function kvList(schoolId: string, since?: string | null): Promise<KvRow[] | null> {
  let query = supabase.from('school_kv').select('key, value, updated_at').eq('school_id', schoolId);
  if (since) query = query.gt('updated_at', since);
  const { data, error } = await query.order('updated_at', { ascending: true }).limit(5000);
  if (error) return null;
  return (data || []).map((r: any) => ({ key: r.key, value: r.value, updatedAt: r.updated_at }));
}

export async function kvGet(schoolId: string, key: string): Promise<KvRow | null | undefined> {
  const { data, error } = await supabase
    .from('school_kv')
    .select('key, value, updated_at')
    .eq('school_id', schoolId)
    .eq('key', key)
    .maybeSingle();
  if (error) return undefined; // lecture impossible : l'appelant ne doit rien écrire
  if (!data) return null;
  return { key: data.key, value: data.value, updatedAt: data.updated_at };
}

/** Toutes les clés qui commencent par `prefix` (comparaison par intervalle : aucun joker). */
export async function kvListPrefix(schoolId: string, prefix: string): Promise<KvRow[] | null> {
  const { data, error } = await supabase
    .from('school_kv')
    .select('key, value, updated_at')
    .eq('school_id', schoolId)
    .gte('key', prefix)
    .lt('key', `${prefix}￿`)
    .limit(2000);
  if (error) return null;
  return (data || []).map((r: any) => ({ key: r.key, value: r.value, updatedAt: r.updated_at }));
}

export async function kvPut(schoolId: string, key: string, value: string, actor: string): Promise<KvRow | null> {
  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from('school_kv')
    .upsert({ school_id: schoolId, key, value, updated_at: updatedAt, updated_by: actor }, { onConflict: 'school_id,key' });
  if (error) return null;
  return { key, value, updatedAt };
}

// ─── Fusion à trois voies ───────────────────────────────────────────────────────────────

function parse(raw: string | null | undefined): any {
  if (raw === null || raw === undefined) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

const isPlainObject = (v: any) => !!v && typeof v === 'object' && !Array.isArray(v);
const itemId = (item: any): string | null =>
  item && typeof item === 'object' && (typeof item.id === 'string' || typeof item.id === 'number') ? String(item.id) : null;
const isIdList = (v: any) => Array.isArray(v) && v.every((x) => itemId(x) !== null);

/** Identifiants des éléments d'une valeur (clés d'un objet, « id » des éléments d'une liste). */
export const kvIds = kvIdsOf;

export type MergeResult = { value: string } | { refused: string };

/**
 * Fusionne l'envoi d'un appareil avec la version de la base :
 *  - ajoute / met à jour ce que l'appareil envoie ;
 *  - garde ce que d'AUTRES appareils ont ajouté entre-temps ;
 *  - ne supprime que ce que l'appareil avait déjà vu (baseIds) et a retiré.
 * Sans baseIds (premier envoi depuis cet appareil), rien n'est supprimé : simple union.
 */
export function mergeKvValue(currentRaw: string | null, incomingRaw: string, baseIds: string[] | null): MergeResult {
  if (currentRaw === null || currentRaw === incomingRaw) return { value: incomingRaw };
  const current = parse(currentRaw);
  const incoming = parse(incomingRaw);
  const base = new Set(baseIds || []);

  if (isPlainObject(current) && isPlainObject(incoming)) {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(current)) {
      if (k in incoming) continue;
      if (base.has(k)) continue; // vu puis retiré par cet appareil
      result[k] = v; // ajouté par un autre appareil
    }
    return { value: JSON.stringify({ ...result, ...incoming }) };
  }

  if (isIdList(current) && isIdList(incoming)) {
    const incomingIds = new Set((incoming as any[]).map((x) => itemId(x) as string));
    const kept: any[] = [];
    let removed = 0;
    for (const item of current as any[]) {
      const id = itemId(item) as string;
      if (incomingIds.has(id)) continue;
      if (base.has(id)) {
        removed++;
        continue;
      }
      kept.push(item);
    }
    if (removed > MAX_LIST_REMOVALS_PER_WRITE) {
      return { refused: `Envoi refusé : il aurait supprimé ${removed} éléments d'un coup.` };
    }
    return { value: JSON.stringify([...(incoming as any[]), ...kept]) };
  }

  // Une liste sans identifiants ne peut pas être fusionnée : on refuse seulement qu'elle soit
  // vidée d'un coup (même protection que ci-dessus).
  if (Array.isArray(current) && Array.isArray(incoming) && current.length - incoming.length > MAX_LIST_REMOVALS_PER_WRITE) {
    return { refused: `Envoi refusé : il aurait supprimé ${current.length - incoming.length} éléments d'un coup.` };
  }

  // Autre forme (texte, liste sans identifiants) : la dernière version enregistrée l'emporte.
  return { value: incomingRaw };
}
