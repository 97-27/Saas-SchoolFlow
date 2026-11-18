import type { School } from '@/lib/data/types';

/** Les numéros de l'école (principal d'abord), sans doublon ni valeur vide. */
export function schoolPhones(school: Partial<School> | null | undefined): string[] {
  if (!school) return [];
  const raw = [school.phone || school.receiptHeaderPhone || '', school.phone2 || '', school.phone3 || ''];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const v = String(r || '').trim();
    const key = v.replace(/\D/g, '');
    if (!v || (key && seen.has(key))) continue;
    if (key) seen.add(key);
    out.push(v);
  }
  return out;
}

/** « +225 07 … / +225 05 … / +225 01 … » pour les reçus et documents. */
export const schoolPhonesText = (school: Partial<School> | null | undefined, fallback = 'Non renseigné') => {
  const list = schoolPhones(school);
  return list.length ? list.join(' / ') : fallback;
};
