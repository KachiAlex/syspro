import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Authentication middleware for API routes
 * Handles development headers and session management
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files, health checks, and non-API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('/health') ||
    !pathname.startsWith('/api')
  ) {
    return NextResponse.next();
  }

  // Add development headers for API routes in development mode
  if (process.env.NODE_ENV === 'development') {
    const response = NextResponse.next();
    
    // Only add headers if they don't exist (allow client to override)
    if (!request.headers.has('X-User-Id')) {
      response.headers.set('X-User-Id', 'dev-user-123');
    }
    if (!request.headers.has('X-User-Email')) {
      response.headers.set('X-User-Email', 'dev@example.com');
    }
    if (!request.headers.has('X-Tenant-Slug')) {
      response.headers.set('X-Tenant-Slug', 'kreatix-default');
    }
    if (!request.headers.has('X-Role-Id')) {
      response.headers.set('X-Role-Id', 'admin');
    }
    if (!request.headers.has('X-User-Name')) {
      response.headers.set('X-User-Name', 'Development User');
    }

    return response;
  }

  // Production: Check for existing authentication
  const sessionCookie = request.cookies.get('syspro_session') || request.cookies.get('session');
  
  if (!sessionCookie && pathname.startsWith('/api')) {
    // For API routes without session, check if we can add development fallback
    if (process.env.NODE_ENV === 'development') {
      const response = NextResponse.next();
      response.headers.set('X-User-Id', 'dev-user-123');
      response.headers.set('X-User-Email', 'dev@example.com');
      response.headers.set('X-Tenant-Slug', 'kreatix-default');
      response.headers.set('X-Role-Id', 'admin');
      response.headers.set('X-User-Name', 'Development User');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
