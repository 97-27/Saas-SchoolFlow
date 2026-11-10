import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/server/session';

import { allowedPages, homePage } from '@/lib/auth/roles';

/**
 * Pages /admin/<segment> autorisées par poste : lib/auth/roles.ts (même source que le menu).
 * Sans ce contrôle, un lien deviné ou un ancien favori ouvrait une page masquée du menu.
 */

/**
 * Protège les pages /[ecole]/admin/* : sans session valide (cookie signé posé
 * par /api/auth/login), on redirige vers la page de connexion de
 * l'école au lieu de laisser passer la requête. Avant ce correctif, ces pages
 * étaient des Server Components sans aucune vérification : quiconque avait le
 * lien direct (ex: via le bouton "Partager l'accès") accédait aux données
 * réelles (élèves, paiements, personnel) sans jamais se connecter.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const match = pathname.match(/^\/([^/]+)\/admin(?:\/([^/]+))?/);
  if (!match) return NextResponse.next();

  const ecole = match[1];
  const subPath = match[2] || '';

  // La page de connexion elle-même doit toujours rester accessible.
  if (subPath === 'login') return NextResponse.next();

  // Session signée par le serveur (lib/server/session.ts) : un cookie fabriqué ou modifié à la
  // main n'a pas de signature valide et renvoie vers la page de connexion.
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.redirect(new URL(`/${ecole}/admin/login`, request.url));
  }

  try {
    const normalizedEcole = ecole === 'college-excellence' ? 'epc-manoi' : ecole;
    if (!session.slug || (session.slug !== ecole && session.slug !== normalizedEcole)) {
      return NextResponse.redirect(new URL(`/${ecole}/admin/login`, request.url));
    }

    // Blocage réel à l'échéance d'abonnement (1, 2 ou 3 ans) — la date de fin a été calculée
    // et posée dans le cookie au moment de la connexion (contre la base Cloud, jamais depuis un
    // localStorage falsifiable). L'établissement pilote epc-manoi ne doit JAMAIS être bloqué par
    // ce mécanisme, quoi qu'il arrive. Un cookie ancien sans cette date (posé avant ce correctif)
    // n'est pas bloqué non plus : il sera réévalué à la prochaine connexion (cookie 30 jours).
    if (normalizedEcole !== 'epc-manoi' && session.subscriptionEndDate) {
      const endDate = new Date(session.subscriptionEndDate).getTime();
      if (!isNaN(endDate) && Date.now() > endDate) {
        return NextResponse.redirect(new URL(`/${ecole}/admin/login?expired=true`, request.url));
      }
    }

    const roleId = session.roleId;
    const allowedPaths = allowedPages(roleId);
    // Poste inconnu : refusé (jamais d'accès total par défaut).
    if (allowedPaths.length === 0) {
      return NextResponse.redirect(new URL(`/${ecole}/admin/login`, request.url));
    }
    if (!allowedPaths.includes(subPath)) {
      return NextResponse.redirect(new URL(`/${ecole}/admin/${homePage(roleId)}`, request.url));
    }
  } catch (e) {
    return NextResponse.redirect(new URL(`/${ecole}/admin/login`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/:ecole/admin/:path*'],
};
