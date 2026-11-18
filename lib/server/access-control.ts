import { getAccessControl, getSchoolSubscriptionInfo, deleteSchoolCompletely, DEFAULT_BLOCK_MESSAGE } from '@/lib/supabase/services';

/**
 * État d'accès d'une école décidé par la plateforme : blocage, suppression programmée, échéance.
 * Lu en base au plus toutes les 15 s par école (les sessions déjà ouvertes sont donc coupées en
 * moins d'une minute).
 */
export interface AccessState {
  blocked: boolean;
  message: string;
  /** Suppression programmée (ISO) : avant cette date, compte à rebours ; après, l'école est effacée. */
  deleteAt: string | null;
  deleted: boolean;
  /** Échéance réelle de l'abonnement (null = inconnue). */
  endDate: string | null;
  daysRemaining: number | null;
  expired: boolean;
}

const OPEN: AccessState = { blocked: false, message: '', deleteAt: null, deleted: false, endDate: null, daysRemaining: null, expired: false };
const cache = new Map<string, { state: AccessState; at: number }>();
const CACHE_MS = 15_000;

export async function getBlockState(slug: string): Promise<AccessState> {
  if (!slug || slug === 'epc-manoi') return { ...OPEN };
  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.state;
  try {
    const [a, sub] = await Promise.all([getAccessControl(slug), getSchoolSubscriptionInfo(slug).catch(() => null)]);
    let state: AccessState = {
      blocked: a.blocked,
      message: a.blockMessage || DEFAULT_BLOCK_MESSAGE,
      deleteAt: a.deleteAt || null,
      deleted: false,
      endDate: sub?.endDate || null,
      daysRemaining: typeof sub?.daysRemaining === 'number' ? sub.daysRemaining : null,
      expired: !!sub?.isExpired,
    };
    // Suppression programmée arrivée à échéance : on efface l'école pour de bon.
    if (state.deleteAt && new Date(state.deleteAt).getTime() <= Date.now()) {
      const ok = await deleteSchoolCompletely(slug);
      if (ok) state = { ...state, blocked: true, deleted: true, message: 'Cet établissement a été supprimé de SchoolFlow Africa.' };
    }
    cache.set(slug, { state, at: Date.now() });
    return state;
  } catch (e) {
    return { ...OPEN }; // base injoignable : on ne bloque pas
  }
}

export function forgetBlockState(slug: string) {
  cache.delete(slug);
}
