import { NextResponse } from 'next/server';
import { PLATFORM_COOKIE, platformCookieOptions } from '@/lib/server/platform-auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(PLATFORM_COOKIE, '', platformCookieOptions(0));
  return res;
}
