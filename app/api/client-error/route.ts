import { NextRequest, NextResponse } from 'next/server';
import { clientIp, getSession, isRateLimited } from '@/lib/server/auth';

/**
 * RAPPORT D'ERREURS DES ÉCRANS
 * Une erreur sur le téléphone d'un utilisateur était invisible pour nous. Chaque écran envoie
 * ici un court rapport (message, page, type d'appareil), écrit dans les journaux du serveur
 * (Vercel > Logs, rechercher « [SchoolFlow][écran] »). Aucune donnée d'élève n'est envoyée.
 */
export const dynamic = 'force-dynamic';

const clip = (v: unknown, n: number) => String(v ?? '').replace(/[\r\n]+/g, ' ').slice(0, n);

export async function POST(request: NextRequest) {
  if (isRateLimited(`client-error:${clientIp(request)}`, 30)) return NextResponse.json({ ok: true });
  let body: any = {};
  try {
    body = await request.json();
  } catch (e) {}
  const session = await getSession(request).catch(() => null);
  console.error(
    '[SchoolFlow][écran]',
    JSON.stringify({
      ecole: session?.slug || '-',
      role: session?.roleId || '-',
      page: clip(body.page, 200),
      message: clip(body.message, 500),
      stack: clip(body.stack, 1500),
      appareil: clip(request.headers.get('user-agent'), 200),
      version: clip(body.version, 60),
    })
  );
  return NextResponse.json({ ok: true });
}
