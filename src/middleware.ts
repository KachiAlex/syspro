import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProduction = process.env.NODE_ENV === 'production';

  // Protect superadmin routes
  if (pathname.startsWith('/superadmin') && pathname !== '/superadmin/login') {
    const authCookie = request.cookies.get('superadmin_auth');

    if (!authCookie || authCookie.value !== 'true') {
      return NextResponse.redirect(new URL('/superadmin/login', request.url));
    }
  }

  // Protect tenant-admin routes (first-line defense in production)
  if (
    pathname.startsWith('/tenant-admin') &&
    pathname !== '/tenant-admin/tenant-signin'
  ) {
    if (isProduction) {
      const hasSession = request.cookies.has('syspro_session');
      const hasUserId =
        request.cookies.has('X-User-Id') ||
        request.cookies.has('dev-user-id') ||
        request.cookies.has('userId');
      const hasSuperadmin = request.cookies.has('superadmin_auth');

      if (!hasSession && !hasUserId && !hasSuperadmin) {
        return NextResponse.redirect(
          new URL('/access?error=auth_required', request.url)
        );
      }
    }
    // In development, the tenant-admin layout handles dev fallbacks
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/superadmin/:path*', '/tenant-admin/:path*'],
};