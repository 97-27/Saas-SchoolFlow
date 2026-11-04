'use client';

import { DATA_UPDATED_EVENT } from '@/lib/data/live-store';
import { kvFamilyForKey, kvIdsOf } from '@/lib/data/cloud-kv-keys';

/**
 * SYNCHRONISATION EN BASE DES DONNÉES QUI N'ÉTAIENT QUE DANS LE NAVIGATEUR
 * (notes, appel, bulletins validés, dépenses, salaires, réductions, santé, documents…)
 *
 * Les écrans continuent de lire et d'écrire leur copie locale (rapide, marche hors connexion),
 * mais chaque écriture d'une de ces données part automatiquement en base (/api/kv), et les
 * modifications faites sur les AUTRES appareils arrivent toutes les 15 s. La base est la
 * référence : ce qui est sur un téléphone n'est plus jamais perdu ni invisible ailleurs.
 *
 * Fusion sans écrasement : chaque envoi indique ce que l'appareil avait déjà vu (baseIds) ;
 * le serveur ne supprime que ce que cet appareil a réellement retiré et garde ce que les autres
 * ont ajouté entre-temps (voir mergeKvValue dans lib/supabase/kv.ts).
 */

const POLL_MS = 15000;
const FLUSH_DELAY_MS = 800;

let activeSlug = '';
let patched = false;
let listenersAdded = false;
let applyingRemote = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let pulling = false;
const editVersion = new Map<string, number>();

let originalSetItem: ((key: string, value: string) => void) | null = null;

const baseStoreKey = (slug: string) => `schoolflow_kv_base_v1_${slug}`;
const dirtyStoreKey = (slug: string) => `schoolflow_kv_dirty_v1_${slug}`;
const cursorStoreKey = (slug: string, role: string) => `schoolflow_kv_cursor_v1_${slug}_${role}`;
const migratedStoreKey = (slug: string, role: string) => `schoolflow_kv_migrated_v1_${slug}_${role}`;

function rawSet(key: string, value: string): void {
  try {
    if (originalSetItem) originalSetItem.call(window.localStorage, key, value);
    else window.localStorage.setItem(key, value);
  } catch (e) {}
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (e) {
    return fallback;
  }
}

function currentRole(): string {
  const session = readJson<any>('schoolflow_active_session_v2', null);
  return String(session?.roleId || '');
}

/** Clé synchronisée ET modifiable par le rôle connecté. */
function canPush(key: string): boolean {
  if (!activeSlug) return false;
  const fam = kvFamilyForKey(key, activeSlug);
  return !!fam && fam.write.includes(currentRole());
}

function loadBases(): Record<string, string[] | null> {
  return readJson<Record<string, string[] | null>>(baseStoreKey(activeSlug), {});
}
function saveBase(key: string, ids: string[] | null): void {
  const bases = loadBases();
  bases[key] = ids;
  rawSet(baseStoreKey(activeSlug), JSON.stringify(bases));
}
function loadDirty(): string[] {
  return readJson<string[]>(dirtyStoreKey(activeSlug), []);
}
function saveDirty(keys: string[]): void {
  rawSet(dirtyStoreKey(activeSlug), JSON.stringify(Array.from(new Set(keys))));
}

function markDirty(key: string): void {
  editVersion.set(key, (editVersion.get(key) || 0) + 1);
  const dirty = loadDirty();
  if (!dirty.includes(key)) {
    dirty.push(key);
    saveDirty(dirty);
  }
  scheduleFlush(FLUSH_DELAY_MS);
}

function scheduleFlush(delay: number): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushCloudKv();
  }, delay);
}

function notifyScreens(keys: string[]): void {
  if (!keys.length) return;
  try {
    window.dispatchEvent(
      new CustomEvent(DATA_UPDATED_EVENT, { detail: { action: 'cloud_kv_updated', keys, isRemoteSync: true } })
    );
  } catch (e) {}
}

/** Écrit localement une valeur venue de la base, sans la renvoyer au serveur. */
function applyServerValue(key: string, value: string): boolean {
  let changed = false;
  try {
    if (window.localStorage.getItem(key) !== value) {
      applyingRemote = true;
      rawSet(key, value);
      changed = true;
    }
  } finally {
    applyingRemote = false;
  }
  saveBase(key, kvIdsOf(value));
  return changed;
}

/** Envoie en base toutes les modifications locales en attente. */
export async function flushCloudKv(keepalive = false): Promise<void> {
  if (!activeSlug || flushing) return;
  const dirty = loadDirty().filter((k) => kvFamilyForKey(k, activeSlug));
  if (!dirty.length) return;
  flushing = true;
  const bases = loadBases();
  const sentVersions = new Map<string, number>();
  const changes: { key: string; value: string; baseIds: string[] | null }[] = [];
  const dropped: string[] = [];
  for (const key of dirty) {
    const value = window.localStorage.getItem(key);
    if (value === null || !canPush(key)) {
      dropped.push(key);
      continue;
    }
    sentVersions.set(key, editVersion.get(key) || 0);
    changes.push({ key, value, baseIds: key in bases ? bases[key] : null });
  }
  if (dropped.length) saveDirty(loadDirty().filter((k) => !dropped.includes(k)));
  if (!changes.length) {
    flushing = false;
    return;
  }

  const slug = activeSlug;
  try {
    const res = await fetch('/api/kv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, changes }),
      keepalive: keepalive && JSON.stringify(changes).length < 60000,
    });
    const json = await res.json().catch(() => null);
    if (slug !== activeSlug) return;
    if (!res.ok || !json?.success || !Array.isArray(json.results)) {
      scheduleFlush(10000); // réseau ou serveur indisponible : on réessaie plus tard
      return;
    }
    const done: string[] = [];
    const updated: string[] = [];
    let refusedCount = 0;
    for (const r of json.results) {
      const key = String(r?.key || '');
      if (!key) continue;
      const editedSince = (editVersion.get(key) || 0) !== (sentVersions.get(key) || 0);
      if (r.ok) {
        if (!editedSince) {
          done.push(key);
          if (typeof r.value === 'string' && applyServerValue(key, r.value)) updated.push(key);
        } else if (Array.isArray(r.ids)) {
          saveBase(key, r.ids);
        }
      } else if (r.refused || r.forbidden) {
        // Envoi refusé : la base reste la référence, l'écran est remis à jour avec elle.
        refusedCount++;
        done.push(key);
        if (typeof r.value === 'string' && applyServerValue(key, r.value)) updated.push(key);
      } else {
        done.push(key); // donnée non reconnue ou trop grosse : inutile de réessayer en boucle
      }
    }
    saveDirty(loadDirty().filter((k) => !done.includes(k) || (editVersion.get(k) || 0) !== (sentVersions.get(k) || 0)));
    notifyScreens(updated);
    if (refusedCount) console.warn(`[SchoolFlow] ${refusedCount} envoi(s) refusé(s) par le serveur — écran resynchronisé.`);
    if (loadDirty().length) scheduleFlush(FLUSH_DELAY_MS);
  } catch (e) {
    scheduleFlush(10000);
  } finally {
    flushing = false;
  }
}

/** Récupère en base les modifications faites sur les autres appareils. */
export async function pullCloudKv(full = false): Promise<void> {
  if (!activeSlug || pulling) return;
  pulling = true;
  const slug = activeSlug;
  const role = currentRole();
  try {
    const migrated = window.localStorage.getItem(migratedStoreKey(slug, role)) === 'true';
    const cursor = full || !migrated ? '' : window.localStorage.getItem(cursorStoreKey(slug, role)) || '';
    const res = await fetch(`/api/kv?slug=${encodeURIComponent(slug)}${cursor ? `&since=${encodeURIComponent(cursor)}` : ''}&t=${Date.now()}`, {
      cache: 'no-store',
    });
    const json = await res.json().catch(() => null);
    if (slug !== activeSlug || !res.ok || !json?.success || !Array.isArray(json.entries)) return;
    const entries: { key: string; value: string; updatedAt: string }[] = json.entries;

    // Premier passage sur cet appareil : ce qu'il avait seulement en local part en base
    // (union, rien n'est supprimé) au lieu d'être écrasé par la version de la base.
    if (!migrated) {
      const serverValues = new Map(entries.map((e) => [e.key, e.value]));
      const toUpload: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (!key || !canPush(key)) continue;
        const local = window.localStorage.getItem(key);
        if (local === null || local === '' || local === '[]' || local === '{}') continue;
        if (serverValues.get(key) !== local) toUpload.push(key);
      }
      if (toUpload.length) {
        const bases = loadBases();
        toUpload.forEach((k) => delete bases[k]); // aucune base : fusion par union
        rawSet(baseStoreKey(slug), JSON.stringify(bases));
        saveDirty([...loadDirty(), ...toUpload]);
      }
    }

    const dirty = new Set(loadDirty());
    const updated: string[] = [];
    let maxUpdated = cursor;
    for (const e of entries) {
      if (e.updatedAt && (!maxUpdated || e.updatedAt > maxUpdated)) maxUpdated = e.updatedAt;
      if (dirty.has(e.key)) continue; // une modification locale est en route : la fusion se fera au serveur
      if (typeof e.value === 'string' && applyServerValue(e.key, e.value)) updated.push(e.key);
    }
    if (maxUpdated) {
      // 2 s de recouvrement pour ne rien manquer d'une écriture simultanée.
      const t = new Date(Date.parse(maxUpdated) - 2000).toISOString();
      rawSet(cursorStoreKey(slug, role), t);
    }
    if (!migrated) rawSet(migratedStoreKey(slug, role), 'true');
    notifyScreens(updated);
    if (dirty.size) scheduleFlush(200);
  } catch (e) {
    // hors connexion : nouvel essai au prochain passage
  } finally {
    pulling = false;
  }
}

function patchLocalStorage(): void {
  if (patched || typeof window === 'undefined' || typeof Storage === 'undefined') return;
  patched = true;
  const proto = Storage.prototype;
  const original = proto.setItem;
  originalSetItem = original;
  proto.setItem = function (this: Storage, key: string, value: string) {
    original.call(this, key, value);
    try {
      if (!applyingRemote && activeSlug && this === window.localStorage && canPush(String(key))) {
        markDirty(String(key));
      }
    } catch (e) {}
  };
}

/** À appeler une fois par écran (DashboardShell). */
export function installCloudKv(slug: string): void {
  if (typeof window === 'undefined' || !slug) return;
  const canonical = slug === 'college-excellence' ? 'epc-manoi' : slug;
  patchLocalStorage();
  if (activeSlug === canonical && pollTimer) return;
  activeSlug = canonical;

  pullCloudKv();
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    pullCloudKv();
    if (loadDirty().length) flushCloudKv();
  }, POLL_MS);

  if (listenersAdded) return;
  listenersAdded = true;
  window.addEventListener('focus', () => pullCloudKv());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushCloudKv(true);
    else pullCloudKv();
  });
  window.addEventListener('pagehide', () => flushCloudKv(true));
  window.addEventListener('online', () => flushCloudKv());
}
