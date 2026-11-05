/**
 * SOMMES DES RAPPELS DE VERSEMENT — montant que l'école saisit, élève par élève, pour un
 * versement dont la case est encore vide (page « Suivi des versements »), afin de l'indiquer
 * dans le rappel envoyé au parent. Aucun calcul à partir de la scolarité totale.
 * Enregistré en base via cloud-kv (famille « schoolflow_versement_reminders_v1 ») : identique
 * sur tous les appareils et mis à jour automatiquement sur tous les écrans.
 *
 * Forme enregistrée (une clé par élève et par versement, pour que deux appareils qui saisissent
 * des élèves différents ne s'écrasent pas) :
 *   { "2:<id élève>": 20000, "3:<id élève>": 15000 }
 * Une somme effacée est gardée à 0 (pas retirée), pour que l'effacement soit transmis partout.
 */

export const MAX_VERSEMENTS = 5;
export type ReminderAmounts = Record<string, number>;

export const reminderAmountsKey = (slug: string) =>
  `schoolflow_versement_reminders_v1_${slug === 'college-excellence' ? 'epc-manoi' : slug}`;

export const reminderId = (versement: number, studentId: string) => `${versement}:${studentId}`;

export function getReminderAmounts(slug: string): ReminderAmounts {
  if (typeof window === 'undefined') return {};
  try {
    const obj = JSON.parse(localStorage.getItem(reminderAmountsKey(slug)) || '{}') || {};
    const out: ReminderAmounts = {};
    Object.keys(obj).forEach((k) => {
      const n = Math.round(Number(obj[k]));
      out[k] = Number.isFinite(n) && n > 0 ? n : 0;
    });
    return out;
  } catch (e) {
    return {};
  }
}

/** Enregistre (ou efface avec 0) les sommes données, sans toucher aux autres. */
export function setReminderAmounts(slug: string, changes: ReminderAmounts): void {
  if (typeof window === 'undefined') return;
  const cur = getReminderAmounts(slug);
  Object.keys(changes).forEach((k) => {
    const n = Math.round(Number(changes[k]));
    cur[k] = Number.isFinite(n) && n > 0 ? n : 0;
  });
  localStorage.setItem(reminderAmountsKey(slug), JSON.stringify(cur));
}
