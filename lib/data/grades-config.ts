/**
 * PARAMÈTRES DES NOTES — nombre de colonnes d'interrogations et de devoirs, fixé par l'école
 * (Fondateur / Directeur) depuis la page Notes. Enregistré en base via cloud-kv (famille
 * « schoolflow_grades_config_v1 ») et donc identique sur tous les appareils.
 *
 * Les notes sont rangées dans int1, int2, … intN et dev1, dev2, … devN. Les moyennes prennent
 * TOUTES les notes saisies, même au-delà du nombre de colonnes affichées : réduire le nombre de
 * colonnes ne fait jamais disparaître une note déjà comptée.
 */

export type GradesConfig = { interros: number; devoirs: number };

export const DEFAULT_GRADES_CONFIG: GradesConfig = { interros: 5, devoirs: 2 };
/** Maximum choisi par l'établissement : 15 interrogations et 5 devoirs (réglable par l'école). */
export const MAX_INTERROS = 15;
export const MAX_DEVOIRS = 5;
/** Nombre de colonnes d'interrogations affiché d'emblée ; le reste s'ouvre avec un bouton. */
export const INTERROS_VISIBLE = 5;

export const gradesConfigKey = (slug: string) => `schoolflow_grades_config_v1_${slug === 'college-excellence' ? 'epc-manoi' : slug}`;

const clamp = (n: any, min: number, max: number, fallback: number) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
};

export function getGradesConfig(slug: string): GradesConfig {
  if (typeof window === 'undefined') return DEFAULT_GRADES_CONFIG;
  try {
    const raw = localStorage.getItem(gradesConfigKey(slug));
    if (!raw) return DEFAULT_GRADES_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      interros: clamp(parsed?.interros, 1, MAX_INTERROS, DEFAULT_GRADES_CONFIG.interros),
      devoirs: clamp(parsed?.devoirs, 1, MAX_DEVOIRS, DEFAULT_GRADES_CONFIG.devoirs),
    };
  } catch (e) {
    return DEFAULT_GRADES_CONFIG;
  }
}

export function saveGradesConfig(slug: string, config: GradesConfig): GradesConfig {
  const clean: GradesConfig = {
    interros: clamp(config.interros, 1, MAX_INTERROS, DEFAULT_GRADES_CONFIG.interros),
    devoirs: clamp(config.devoirs, 1, MAX_DEVOIRS, DEFAULT_GRADES_CONFIG.devoirs),
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(gradesConfigKey(slug), JSON.stringify(clean));
    } catch (e) {}
  }
  return clean;
}

const toNumber = (val: any): number | null => {
  if (val === '' || val === null || val === undefined) return null;
  const n = parseFloat(String(val).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** Toutes les notes saisies d'un type (« int » ou « dev »), dans l'ordre int1, int2, … */
export function noteValues(entry: Record<string, any> | null | undefined, prefix: 'int' | 'dev'): number[] {
  if (!entry) return [];
  const re = new RegExp(`^${prefix}(\\d+)$`);
  return Object.keys(entry)
    .map((k) => {
      const m = k.match(re);
      return m ? { idx: Number(m[1]), val: toNumber(entry[k]) } : null;
    })
    .filter((x): x is { idx: number; val: number | null } => !!x && x.val !== null)
    .sort((a, b) => a.idx - b.idx)
    .map((x) => x.val as number);
}

/** Plus grand numéro de colonne réellement rempli (pour ne jamais masquer une note saisie). */
export function highestFilledIndex(entries: Array<Record<string, any> | null | undefined>, prefix: 'int' | 'dev'): number {
  const re = new RegExp(`^${prefix}(\\d+)$`);
  let max = 0;
  for (const e of entries) {
    if (!e) continue;
    for (const k of Object.keys(e)) {
      const m = k.match(re);
      if (m && toNumber(e[k]) !== null) max = Math.max(max, Number(m[1]));
    }
  }
  return max;
}
