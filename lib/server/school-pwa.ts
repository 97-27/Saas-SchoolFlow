import { getSchoolFromSupabase } from '@/lib/supabase/services';
import { canonicalSlug } from '@/lib/server/auth';

/**
 * Identité de l'application installable pour une école : le sigle de l'école (ex. « UPC Manoir »)
 * devient le nom affiché sur l'écran d'accueil et dans la fenêtre d'installation. Sans école
 * connue, on garde le nom générique « School Flow Africa ».
 */
export const DEFAULT_APP_NAME = 'School Flow Africa';

export interface SchoolPwaIdentity {
  slug: string;
  /** Nom affiché à l'installation (sigle de l'école). */
  label: string;
  /** Nom complet de l'établissement (description). */
  fullName: string;
}

export async function loadSchoolPwaIdentity(rawSlug: string): Promise<SchoolPwaIdentity> {
  const slug = canonicalSlug(String(rawSlug || '').toLowerCase()).replace(/[^a-z0-9-]/g, '');
  const fallback: SchoolPwaIdentity = { slug, label: DEFAULT_APP_NAME, fullName: DEFAULT_APP_NAME };
  if (!slug) return fallback;
  try {
    const school = await getSchoolFromSupabase(slug, { stamp: false });
    if (!school) return fallback;
    const sigle = String(school.shortName || '').trim();
    const fullName = String(school.name || '').trim() || DEFAULT_APP_NAME;
    // Le sigle sert de nom ; à défaut, le nom de l'école tronqué.
    const label = (sigle || fullName).slice(0, 30);
    return { slug, label, fullName };
  } catch {
    return fallback;
  }
}
