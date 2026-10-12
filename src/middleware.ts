import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'reisin_session';

// Only /admin needs a staff login. The portal (/, /r/…, /captain, /done…)
// is public and gates itself with its own captain / team cookies.
export async function middleware(req: NextRequest) {
  // leaderboard.<domain>/ → current race leaderboard (old bajaxing URLs keep working).
  const host = req.headers.get('host') || '';
  if (/^leaderboard\./i.test(host) && req.nextUrl.pathname === '/') {
    return NextResponse.rewrite(new URL('/leaderboard', req.url));
  }
  if (!req.nextUrl.pathname.startsWith('/admin') && !req.nextUrl.pathname.startsWith('/api/admin')) return NextResponse.next();
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const secret = process.env.SESSION_SECRET;
  const toLogin = () => {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  };
  if (!token || !secret) return toLogin();
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return NextResponse.next();
  } catch {
    return toLogin();
  }
}

export const config = {
  matcher: ['/', '/admin/:path*', '/api/admin/:path*'],
};
