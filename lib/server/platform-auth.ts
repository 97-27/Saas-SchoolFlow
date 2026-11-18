import { NextRequest } from 'next/server';
import { createSessionToken, verifySessionToken } from './session';

/**
 * Espace plateforme (propriétaire de SchoolFlow). Accès protégé par un code secret défini dans la
 * variable d'environnement PLATFORM_ADMIN_CODE (jamais écrit dans le code). La session est un
 * cookie httpOnly signé, distinct du cookie des écoles.
 */
export const PLATFORM_COOKIE = 'sf_platform_session';
export const PLATFORM_ROLE = 'platform_owner';
const PLATFORM_MAX_AGE = 60 * 60 * 12; // 12 heures

export function platformCodeConfigured(): boolean {
  return (process.env.PLATFORM_ADMIN_CODE || '').trim().length >= 8;
}

/** Comparaison en temps constant du code saisi avec le code configuré. */
export function checkPlatformCode(input: string): boolean {
  const expected = (process.env.PLATFORM_ADMIN_CODE || '').trim();
  if (expected.length < 8) return false;
  const a = new TextEncoder().encode(String(input || '').trim());
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a[i] || 0) ^ (b[i] || 0);
  return diff === 0;
}

export async function createPlatformToken(): Promise<string> {
  return createSessionToken({ slug: '__platform__', roleId: PLATFORM_ROLE, code: 'platform' });
}

export async function isPlatformRequest(request: NextRequest): Promise<boolean> {
  const s = await verifySessionToken(request.cookies.get(PLATFORM_COOKIE)?.value);
  if (!s || s.roleId !== PLATFORM_ROLE || s.slug !== '__platform__') return false;
  return Math.floor(Date.now() / 1000) - s.iat < PLATFORM_MAX_AGE;
}

export function platformCookieOptions(maxAge: number = PLATFORM_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge,
  };
}
