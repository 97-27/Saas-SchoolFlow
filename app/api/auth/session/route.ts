import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

/**
 * La session (cookie signé) est-elle encore valide ? Appelé par chaque écran de gestion avant
 * d'afficher quoi que ce soit, et à chaque retour sur l'onglet / flèche « retour » du navigateur :
 * après une déconnexion, l'ancienne page ne doit JAMAIS se réafficher.
 */
export async function GET(request: NextRequest) {
  const auth = await requireSession(request, request.nextUrl.searchParams.get('slug'));
  if ('error' in auth) return auth.error;
  return NextResponse.json(
    { success: true, roleId: auth.session.roleId, slug: auth.slug, yearEpoch: auth.session.yearEpoch || 0 },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
