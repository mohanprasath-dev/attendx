import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login'];
const PUBLIC_PREFIXES = ['/scan/', '/p/'];
const SESSION_COOKIE_NAME = 'attendx-session';

export function middleware(request: NextRequest) {
  // Temporarily bypass authentication check to allow access everywhere
  return NextResponse.next();

  /*
  const { pathname } = request.nextUrl;

  const isPublicPath = PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isPublicPath) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
  */
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)']
};