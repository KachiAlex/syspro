/**
 * Next.js Middleware for Route Protection
 * Handles authentication and tenant context for protected routes
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define protected and public routes
const protectedRoutes = ['/dashboard'];
const publicRoutes = ['/login', '/'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if the current path is protected
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  );
  
  // Check if the current path is public
  const isPublicRoute = publicRoutes.some(route => 
    pathname === route || pathname.startsWith(route)
  );

  // Get authentication token from cookies or headers
  const token = request.cookies.get('accessToken')?.value || 
                request.headers.get('authorization')?.replace('Bearer ', '');

  // If accessing a protected route without a token, redirect to login
  if (isProtectedRoute && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If accessing login page with a valid token, redirect to dashboard
  if (pathname === '/login' && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // For protected routes with token, add tenant header if available
  if (isProtectedRoute && token) {
    const tenantId = request.cookies.get('tenantId')?.value ||
                    request.headers.get('x-tenant-id');
    
    const requestHeaders = new Headers(request.headers);
    
    // Add authorization header
    requestHeaders.set('authorization', `Bearer ${token}`);
    
    // Add tenant header if available
    if (tenantId) {
      requestHeaders.set('x-tenant-id', tenantId);
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};