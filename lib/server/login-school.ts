import { mockSchools } from '@/lib/data/mock-data';
import type { School } from '@/lib/data/types';
import { getSchoolFromSupabase } from '@/lib/supabase/services';
import { canonicalSlug } from '@/lib/server/auth';

/**
 * École affichée sur la page de connexion : la VRAIE fiche de la base. Avant, la page prenait
 * une fiche de démonstration intégrée au code, et toute école absente de cette liste
 * s'affichait comme « EPC MANOI » (et se connectait sur le mauvais établissement).
 */
export async function loadLoginSchool(rawSlug: string): Promise<School> {
  const slug = canonicalSlug(String(rawSlug || '').toLowerCase());
  try {
    const real = slug ? await getSchoolFromSupabase(slug) : null;
    if (real) {
      const base = mockSchools[slug];
      return { ...(base || {}), ...real, slug: real.slug || slug } as School;
    }
  } catch (e) {}
  const known = mockSchools[slug];
  if (known) return known;
  // École inconnue : on garde le lien demandé, sans emprunter l'identité d'une autre école.
  return { ...mockSchools['epc-manoi'], id: slug, slug, name: slug.toUpperCase(), shortName: slug.toUpperCase(), logoUrl: '' } as School;
}
