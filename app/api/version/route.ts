import { NextResponse } from 'next/server';

/**
 * Version de l'application actuellement en ligne. Les écrans ouverts la comparent à celle
 * qu'ils avaient au chargement et se rechargent après une mise à jour (voir live-store.ts).
 * Ne renvoie aucune donnée d'école : accessible sans session.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  const version =
    process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_URL || 'local';
  return NextResponse.json({ version }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
