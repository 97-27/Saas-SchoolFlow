import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Pages /admin/<segment> autorisées par rôle, à l'image exacte du menu affiché dans
 * sidebar.tsx pour chaque rôle. fondateur et directeur ont accès à tout (non listés ici).
 * Sans cette liste, un parent qui devine ou clique un ancien lien /admin/dashboard atteignait
 * le tableau de bord financier complet de l'école — la barre latérale masquait le lien mais
 * ne protégeait rien côté serveur.
 */
const ROLE_ALLOWED_PATHS: Record<string, string[]> = {
  secretaire: ['dashboard', 'documents', 'depenses', 'rapports', 'classes', 'notes-diverses', 'personnel'],
  comptable: ['dashboard', 'eleves', 'inscriptions', 'documents', 'cantine', 'transport', 'internat', 'depenses', 'rapports', 'reductions', 'salaires', 'notes-diverses'],
  enseignant: ['classes', 'presences', 'notes', 'bulletins', 'distinctions', 'notes-diverses'],
  assistant_direction: ['dashboard', 'classes', 'documents', 'personnel', 'notes-diverses'],
  // "communication" est volontairement absent : c'est la boîte de réception interne de la
  // Direction (communication-view.tsx n'a pas de vue dédiée aux parents). Le formulaire
  // "Envoyer à la Direction" pour les parents vit déjà sur la page bulletins-parents.
  parent: ['bulletins-parents', 'notes-diverses'],
  educateur: ['dashboard', 'classes', 'notes-diverses'],
  informaticien: ['dashboard', 'classes', 'notes-diverses'],
};

// Page d'atterrissage par défaut par rôle quand l'URL demandée n'est pas autorisée.
const ROLE_DEFAULT_PATH: Record<string, string> = {
  enseignant: 'notes',
  parent: 'bulletins-parents',
};

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

    const roleId = session.roleId;
    const allowedPaths = roleId ? ROLE_ALLOWED_PATHS[roleId] : undefined;
    // directeur et fondateur (absents de la liste) gardent l'accès total.
    if (allowedPaths && !allowedPaths.includes(subPath)) {
      const fallback = ROLE_DEFAULT_PATH[roleId] || allowedPaths[0] || 'dashboard';
      return NextResponse.redirect(new URL(`/${ecole}/admin/${fallback}`, request.url));
    }
  } catch (e) {
    return NextResponse.redirect(new URL(`/${ecole}/admin/login`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/:ecole/admin/:path*'],
};
