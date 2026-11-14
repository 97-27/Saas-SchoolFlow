import { NextRequest, NextResponse } from 'next/server';
import { loadSchoolPwaIdentity } from '@/lib/server/school-pwa';

export const dynamic = 'force-dynamic';

/**
 * Manifeste d'installation propre à chaque école : le nom de l'application devient le sigle de
 * l'école (ex. « UPC Manoir ») au lieu de « School Flow Africa ». Public (lu par le navigateur
 * avant toute connexion), sans aucune donnée sensible.
 */
export async function GET(req: NextRequest) {
  const ecole = req.nextUrl.searchParams.get('ecole') || '';
  const { slug, label, fullName } = await loadSchoolPwaIdentity(ecole);
  const base = slug ? `/${slug}` : '';

  const manifest = {
    id: `${base || '/'}`,
    name: label,
    short_name: label.slice(0, 12),
    description: `${fullName} — gestion scolaire`,
    lang: 'fr',
    start_url: `${base}/login?source=pwa`,
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8fafc',
    theme_color: '#059669',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
