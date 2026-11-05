/**
 * PLAN DES VERSEMENTS PAR CLASSE — montant du 1er, 2e, 3e, 4e et 5e versement de scolarité de
 * chaque classe, et date limite de chaque versement (commune à toutes les classes). Fixé par
 * l'école (Fondateur, Directeur, Comptable) depuis la page « Suivi des versements ».
 * Enregistré en base via cloud-kv (famille « schoolflow_versement_plan_v1 ») : identique sur
 * tous les appareils et mis à jour automatiquement sur tous les écrans.
 *
 * Forme enregistrée (une clé par classe, pour que deux appareils qui modifient deux classes
 * différentes ne s'écrasent pas) :
 *   { "class:CP1": [25000, 20000, 15000, 10000, 0], "dates": ["2026-09-30", "2026-11-30", ...] }
 */

export const MAX_VERSEMENTS = 5;
export type VersementPlan = { classes: Record<string, number[]>; dates: string[] };

export const versementPlanKey = (slug: string) =>
  `schoolflow_versement_plan_v1_${slug === 'college-excellence' ? 'epc-manoi' : slug}`;

const cleanAmounts = (v: any): number[] =>
  Array.from({ length: MAX_VERSEMENTS }, (_, i) => {
    const n = Math.round(Number(Array.isArray(v) ? v[i] : 0));
    return Number.isFinite(n) && n > 0 ? n : 0;
  });

const cleanDates = (v: any): string[] =>
  Array.from({ length: MAX_VERSEMENTS }, (_, i) => {
    const d = String(Array.isArray(v) ? v[i] || '' : '');
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
  });

export function getVersementPlan(slug: string): VersementPlan {
  const empty: VersementPlan = { classes: {}, dates: cleanDates([]) };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = localStorage.getItem(versementPlanKey(slug));
    if (!raw) return empty;
    const obj = JSON.parse(raw) || {};
    const classes: Record<string, number[]> = {};
    Object.keys(obj).forEach((k) => {
      if (k.startsWith('class:')) {
        const amounts = cleanAmounts(obj[k]);
        if (amounts.some((a) => a > 0)) classes[k.slice(6)] = amounts;
      }
    });
    return { classes, dates: cleanDates(obj.dates) };
  } catch (e) {
    return empty;
  }
}

export function saveVersementPlan(slug: string, plan: VersementPlan): void {
  if (typeof window === 'undefined') return;
  const obj: Record<string, any> = { dates: cleanDates(plan.dates) };
  Object.keys(plan.classes).forEach((grade) => {
    const amounts = cleanAmounts(plan.classes[grade]);
    // Classe sans aucun montant : gardée à zéro (pas retirée), pour que la suppression soit
    // transmise aux autres appareils.
    obj[`class:${grade}`] = amounts;
  });
  localStorage.setItem(versementPlanKey(slug), JSON.stringify(obj));
}

export type VersementStatus = {
  /** Plan défini pour la classe de l'élève. */
  hasPlan: boolean;
  /** Versement attendu (1 à 5), 0 = scolarité soldée. */
  due: number;
  /** Reste à payer sur CE versement. */
  dueAmount: number;
  /** Date limite du versement attendu (si définie). */
  dueDate: string;
  /** La date limite du versement attendu est dépassée. */
  late: boolean;
  /** Reste total de la scolarité. */
  remaining: number;
};

/**
 * Où en est l'élève : on compare ce qu'il a déjà versé au CUMUL du plan de sa classe.
 * Ex. plan 25 000 / 20 000 / 15 000 ; déjà versé 30 000 → 1er versement couvert (25 000),
 * il doit le 2e versement, dont il reste 15 000 (cumul 45 000 − 30 000).
 * Une réduction (scolarité nette plus faible que le plan) est déduite des derniers versements.
 */
export function versementStatus(
  paid: number,
  net: number,
  planAmounts: number[] | undefined,
  dates: string[],
  today: string
): VersementStatus {
  const planTotal = (planAmounts || []).reduce((s, a) => s + (a || 0), 0);
  const hasPlan = planTotal > 0;
  const total = net > 0 ? net : planTotal;
  const remaining = Math.max(0, total - paid);

  if (!hasPlan) {
    return { hasPlan, due: 0, dueAmount: remaining, dueDate: '', late: false, remaining };
  }
  if (total > 0 && paid >= total) {
    return { hasPlan, due: 0, dueAmount: 0, dueDate: '', late: false, remaining: 0 };
  }

  const amounts = planAmounts!;
  let lastUsed = 0;
  amounts.forEach((a, i) => {
    if (a > 0) lastUsed = i + 1;
  });
  let cum = 0;
  for (let k = 1; k <= lastUsed; k++) {
    cum = Math.min(cum + (amounts[k - 1] || 0), total);
    if (paid < cum || k === lastUsed) {
      const target = k === lastUsed ? total : cum;
      const dueAmount = Math.max(0, target - paid);
      const dueDate = dates[k - 1] || '';
      return { hasPlan, due: k, dueAmount, dueDate, late: !!dueDate && dueDate < today, remaining };
    }
  }
  return { hasPlan, due: 0, dueAmount: 0, dueDate: '', late: false, remaining };
}
