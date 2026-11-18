import { NextRequest, NextResponse } from 'next/server';
import { clientIp, isLoginBlocked, recordLoginFailure, clearLoginFailures, jsonError } from '@/lib/server/auth';
import {
  PLATFORM_COOKIE,
  checkPlatformCode,
  createPlatformToken,
  platformCodeConfigured,
  platformCookieOptions,
} from '@/lib/server/platform-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!platformCodeConfigured()) {
    return jsonError(
      'L’espace plateforme n’est pas encore activé : définissez la variable PLATFORM_ADMIN_CODE (8 caractères minimum) dans l’hébergement, puis redéployez.',
      503
    );
  }
  const key = `platform:${clientIp(request)}`;
  if (isLoginBlocked(key)) return jsonError('Trop de tentatives. Réessayez dans quelques minutes.', 429);

  let body: any = null;
  try {
    body = await request.json();
  } catch (e) {}

  if (!checkPlatformCode(String(body?.code || ''))) {
    recordLoginFailure(key);
    await new Promise((r) => setTimeout(r, 500));
    return jsonError('Code incorrect.', 403);
  }
  clearLoginFailures(key);
  const res = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  res.cookies.set(PLATFORM_COOKIE, await createPlatformToken(), platformCookieOptions());
  return res;
}
