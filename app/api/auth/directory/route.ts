import { NextRequest, NextResponse } from 'next/server';
import { canonicalSlug, clientIp, isRateLimited, jsonError, STAFF_ROLES } from '@/lib/server/auth';
import { getSchoolFromSupabase, getStaffUsersFromSupabase } from '@/lib/supabase/services';

/**
 * ANNUAIRE DE LA PAGE DE CONNEXION (sans session)
 * Un téléphone qui ouvre le lien de l'école pour la première fois n'a encore rien en mémoire :
 * il ne reconnaissait ni l'école (fiche de démonstration affichée) ni les membres déjà créés
 * (« Aucun compte créé pour ce poste »). Cet annuaire renvoie UNIQUEMENT le nom de l'école et
 * le nom + poste de chaque membre. Jamais de code d'accès, de téléphone ni d'email : la
 * connexion reste décidée par /api/auth/login avec le code personnel.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const slug = canonicalSlug(String(request.nextUrl.searchParams.get('slug') || '').trim().toLowerCase());
  if (!slug || slug.length > 80) return jsonError('Établissement manquant.', 400);
  if (isRateLimited(`directory:${clientIp(request)}`, 60)) return jsonError('Trop de requêtes.', 429);

  const school = await getSchoolFromSupabase(slug);
  if (!school) return jsonError('Établissement introuvable.', 404);

  const staff = (await getStaffUsersFromSupabase(slug))
    .filter((s: any) => s && STAFF_ROLES.includes(s.roleId) && s.fullName)
    .filter((s: any) => !/^(FND|DIR)-2026$/i.test(String(s.authCode || '')))
    .map((s: any) => ({ id: String(s.id), fullName: String(s.fullName), roleId: String(s.roleId) }));

  return NextResponse.json(
    {
      success: true,
      school: {
        id: school.id,
        slug: school.slug,
        name: school.name,
        shortName: school.shortName,
        logoUrl: school.logoUrl && /^https?:\/\//.test(school.logoUrl) ? school.logoUrl : '',
        status: (school as any).status,
      },
      staff,
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
