import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/server/auth';
import { getBlockState } from '@/lib/server/access-control';

export const dynamic = 'force-dynamic';

/**
 * La session (cookie signé) est-elle encore valide ? Appelé par chaque écran de gestion avant
 * d'afficher quoi que ce soit, et à chaque retour sur l'onglet / flèche « retour » du navigateur :
 * après une déconnexion, l'ancienne page ne doit JAMAIS se réafficher.
 * Renvoie aussi l'état d'abonnement (alerte d'échéance) et la suppression programmée éventuelle.
 */
export async function GET(request: NextRequest) {
  const auth = await requireSession(request, request.nextUrl.searchParams.get('slug'));
  if ('error' in auth) return auth.error;
  const state = await getBlockState(auth.slug);
  return NextResponse.json(
    {
      success: true,
      roleId: auth.session.roleId,
      slug: auth.slug,
      yearEpoch: auth.session.yearEpoch || 0,
      daysRemaining: state.daysRemaining,
      endDate: state.endDate,
      deleteAt: state.deleteAt,
      serverNow: Date.now(),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
