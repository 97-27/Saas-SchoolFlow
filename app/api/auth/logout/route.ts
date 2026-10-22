import { NextResponse } from 'next/server';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

/** Déconnexion : le cookie httpOnly ne peut être effacé que par le serveur. */
export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0));
  return res;
}
