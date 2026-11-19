import { PAGE_ACCESS_KEY, type PageOverrides } from '@/lib/auth/roles';
import { DATA_UPDATED_EVENT } from '@/lib/data/live-store';

/** Clé locale (synchronisée en base par cloud-kv) des pages accordées / retirées par poste. */
export const pageAccessKey = (slug: string) => `${PAGE_ACCESS_KEY}_${slug === 'college-excellence' ? 'epc-manoi' : slug}`;

export function readPageOverrides(slug: string): PageOverrides {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(pageAccessKey(slug));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function savePageOverrides(slug: string, overrides: PageOverrides): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(pageAccessKey(slug), JSON.stringify(overrides));
    window.dispatchEvent(new Event(DATA_UPDATED_EVENT));
  } catch {}
}
