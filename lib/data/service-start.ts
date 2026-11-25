/**
 * MOIS DE DÉBUT D'UN ABONNEMENT (Internat, Cantine, Transport)
 *
 * Un élève qui s'abonne en novembre ne doit RIEN pour septembre et octobre : ces mois sont
 * « non applicables » (affichés en gris) et n'apparaissent jamais dans le Suivi des versements,
 * sauf si l'école décide de les appliquer (bouton « Compter depuis septembre »).
 *
 * Enregistré en base via cloud-kv (famille « schoolflow_service_start_v1 ») : identique sur tous
 * les appareils. Une clé par élève et par service, pour que deux appareils n'écrasent rien :
 *   { "internat:<id élève>": "Novembre", "cantine:<id élève>": "Septembre" }
 */

export const SERVICE_START_MONTHS = ['Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai'];
export type ServiceStartId = 'internat' | 'cantine' | 'transport';
export type ServiceStarts = Record<string, string>;

export const serviceStartKey = (slug: string) =>
  `schoolflow_service_start_v1_${slug === 'college-excellence' ? 'epc-manoi' : slug}`;

export const serviceStartId = (service: ServiceStartId, studentId: string) => `${service}:${studentId}`;

export function getServiceStarts(slug: string): ServiceStarts {
  if (typeof window === 'undefined') return {};
  try {
    const obj = JSON.parse(localStorage.getItem(serviceStartKey(slug)) || '{}') || {};
    const out: ServiceStarts = {};
    Object.keys(obj).forEach((k) => {
      if (SERVICE_START_MONTHS.includes(obj[k])) out[k] = obj[k];
    });
    return out;
  } catch (e) {
    return {};
  }
}

/** Enregistre (ou remplace) le mois de début donné, sans toucher aux autres. */
export function setServiceStarts(slug: string, changes: ServiceStarts): void {
  if (typeof window === 'undefined') return;
  let cur: ServiceStarts = {};
  try {
    cur = JSON.parse(localStorage.getItem(serviceStartKey(slug)) || '{}') || {};
  } catch (e) {}
  Object.keys(changes).forEach((k) => {
    if (SERVICE_START_MONTHS.includes(changes[k])) cur[k] = changes[k];
  });
  localStorage.setItem(serviceStartKey(slug), JSON.stringify(cur));
}

/** Mois scolaire en cours (Septembre → Mai). Juin à août : Septembre. */
export function currentServiceMonth(now: Date = new Date()): string {
  const names = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const m = names[now.getMonth()];
  return SERVICE_START_MONTHS.includes(m) ? m : SERVICE_START_MONTHS[0];
}

/**
 * À appeler quand un NOUVEL abonnement est créé : le service commence ce mois-ci. Ne remplace
 * jamais un début déjà enregistré (modifier un abonnement ne déplace pas son début).
 */
export function markServiceStart(slug: string, service: ServiceStartId, studentId: string, month?: string): void {
  if (typeof window === 'undefined' || !studentId) return;
  try {
    const id = serviceStartId(service, studentId);
    if (getServiceStarts(slug)[id]) return;
    setServiceStarts(slug, { [id]: month && SERVICE_START_MONTHS.includes(month) ? month : currentServiceMonth() });
  } catch (e) {}
}

/** Mois (Septembre → Mai) d'une date JJ/MM/AAAA, AAAA-MM-JJ ou ISO complète ; null si illisible. */
export function monthOfDate(value?: string | null): string | null {
  if (!value) return null;
  const v = String(value).trim();
  let month = 0;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const fr = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (iso) month = Number(iso[2]);
  else if (fr) month = Number(fr[2]);
  if (!month || month < 1 || month > 12) return null;
  const names = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const n = names[month - 1];
  return SERVICE_START_MONTHS.includes(n) ? n : SERVICE_START_MONTHS[0];
}

/**
 * Mois de début d'un abonné : celui enregistré s'il existe ; sinon (anciens abonnements) le plus
 * ancien entre le mois de sa date d'abonnement (si connue) et son premier mois réellement payé ;
 * à défaut, Septembre (tous les mois comptent, comme avant).
 */
export function resolveStartMonth(opts: {
  stored?: string;
  subscriptionDate?: string | null;
  paid: Record<string, boolean>;
}): string {
  if (opts.stored && SERVICE_START_MONTHS.includes(opts.stored)) return opts.stored;
  const idx = (m: string | null | undefined) => (m ? SERVICE_START_MONTHS.indexOf(m) : -1);
  const candidates: number[] = [];
  const fromDate = idx(monthOfDate(opts.subscriptionDate));
  if (fromDate >= 0) candidates.push(fromDate);
  const firstPaid = SERVICE_START_MONTHS.findIndex((m) => opts.paid[m]);
  if (firstPaid >= 0) candidates.push(firstPaid);
  if (candidates.length === 0) return SERVICE_START_MONTHS[0];
  return SERVICE_START_MONTHS[Math.min(...candidates)];
}
