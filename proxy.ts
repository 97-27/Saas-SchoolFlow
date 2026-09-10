import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Protège les pages /[ecole]/admin/* : sans session valide (cookie posé à la
 * connexion dans login-view.tsx), on redirige vers la page de connexion de
 * l'école au lieu de laisser passer la requête. Avant ce correctif, ces pages
 * étaient des Server Components sans aucune vérification : quiconque avait le
 * lien direct (ex: via le bouton "Partager l'accès") accédait aux données
 * réelles (élèves, paiements, personnel) sans jamais se connecter.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const match = pathname.match(/^\/([^/]+)\/admin(?:\/([^/]+))?/);
  if (!match) return NextResponse.next();

  const ecole = match[1];
  const subPath = match[2] || '';

  // La page de connexion elle-même doit toujours rester accessible.
  if (subPath === 'login') return NextResponse.next();

  const sessionCookie = request.cookies.get('sf_admin_session')?.value;
  if (!sessionCookie) {
    return NextResponse.redirect(new URL(`/${ecole}/admin/login`, request.url));
  }

  try {
    const session = JSON.parse(decodeURIComponent(sessionCookie));
    const normalizedEcole = ecole === 'college-excellence' ? 'epc-manoi' : ecole;
    if (!session.slug || (session.slug !== ecole && session.slug !== normalizedEcole)) {
      return NextResponse.redirect(new URL(`/${ecole}/admin/login`, request.url));
    }

    // Communication Parents (messagerie reçue des familles) est réservée à la Direction
    // (fondateur, directeur, secrétaire, assistant de direction). La barre latérale la
    // masque déjà pour les enseignants, mais rien n'empêchait d'y accéder via l'URL directe.
    if (subPath === 'communication') {
      const allowedRoles = ['fondateur', 'directeur', 'secretaire', 'assistant_direction'];
      if (!allowedRoles.includes(session.roleId)) {
        return NextResponse.redirect(new URL(`/${ecole}/admin/dashboard`, request.url));
      }
    }
  } catch (e) {
    return NextResponse.redirect(new URL(`/${ecole}/admin/login`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/:ecole/admin/:path*'],
};
