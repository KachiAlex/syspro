import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect superadmin routes
  if (pathname.startsWith('/superadmin') && pathname !== '/superadmin/login') {
    const authCookie = request.cookies.get('superadmin_auth');

    if (!authCookie || authCookie.value !== 'true') {
      return NextResponse.redirect(new URL('/superadmin/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/superadmin/:path*',
};