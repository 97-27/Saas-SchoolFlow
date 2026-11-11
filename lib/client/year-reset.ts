'use client';

/**
 * Passage à l'année suivante, côté appareil : chaque navigateur garde une copie locale des
 * données (rapidité, hors connexion). Quand le numéro d'année de l'école change (voir
 * lib/server/year-epoch.ts), cette copie est celle de l'année passée : on l'efface entièrement
 * pour repartir de zéro, en gardant seulement les préférences de connexion (email, matricule,
 * numéro mémorisés) et la session.
 */
const KEEP_EXACT = new Set([
  'schoolflow_active_session_v2',
  'schoolflow_login_profiles_v1',
  'schoolflow_staff_matricule_v1',
  'schoolflow_teacher_login_v1',
  'schoolflow_registered_schools_v2',
  'schoolflow_deleted_schools_v1',
  'schoolflow_payment_notif_prompt_v1',
  'schoolflow_logout_at',
]);
const epochKey = (slug: string) => `schoolflow_year_epoch_${slug === 'college-excellence' ? 'epc-manoi' : slug}`;

export function wipeLocalSchoolData(): void {
  try {
    const ls = window.localStorage;
    const toRemove: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (!k || !k.startsWith('schoolflow_')) continue;
      if (KEEP_EXACT.has(k) || k.startsWith('schoolflow_year_epoch_')) continue;
      toRemove.push(k);
    }
    toRemove.forEach((k) => ls.removeItem(k));
  } catch (e) {}
  try {
    const ss = window.sessionStorage;
    const toRemove: string[] = [];
    for (let i = 0; i < ss.length; i++) {
      const k = ss.key(i);
      if (k && k.startsWith('schoolflow_')) toRemove.push(k);
    }
    toRemove.forEach((k) => ss.removeItem(k));
  } catch (e) {}
}

/**
 * Cale l'appareil sur le numéro d'année du serveur. Renvoie true si la copie locale vient d'être
 * effacée (l'écran doit alors se recharger). Premier passage sur un appareil avec le numéro 0 :
 * on note simplement le numéro, rien n'est effacé.
 */
export function syncYearEpoch(slug: string, serverEpoch: number | undefined | null): boolean {
  if (typeof window === 'undefined' || !slug || typeof serverEpoch !== 'number') return false;
  let local: string | null = null;
  try {
    local = window.localStorage.getItem(epochKey(slug));
  } catch (e) {}
  const changed = local === null ? serverEpoch > 0 : Number(local) !== serverEpoch;
  if (changed) wipeLocalSchoolData();
  try {
    window.localStorage.setItem(epochKey(slug), String(serverEpoch));
  } catch (e) {}
  return changed;
}
