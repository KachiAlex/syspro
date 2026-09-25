import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionEdge } from '@/lib/session-edge';

// ─── Rate limiting (in-memory, edge-safe) ───
// Best-effort per warm instance; auth routes carry their own stricter limits.
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  if (record.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((record.resetTime - now) / 1000) };
  }
  record.count++;
  return { allowed: true, retryAfter: 0 };
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  return forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
}

// ─── API route classification ───

// Paths reachable without any session. Each of these enforces its own auth
// (login endpoints, bearer secrets, API keys) or is intentionally public.
const PUBLIC_API_PREFIXES = [
  '/api/auth/',
  '/api/hr/employees/auth/',
  '/api/tenant/signin',
  '/api/apply',
  '/api/employee-lookup',
  '/api/health',
  '/api/_db-health',
  '/api/cron/',
  '/api/superadmin/auth/',
  '/api/superadmin/setup',
  '/api/ai/agent',
];

// Platform-admin surface: requires a verified superadmin session.
const SUPERADMIN_API_PREFIXES = ['/api/superadmin/', '/api/tenants'];

// Development/debug tooling: never exposed in production.
const DEV_ONLY_API_PREFIXES = ['/api/dev/', '/api/debug/', '/api/support/seed', '/api/support/health'];

function startsWithAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p.endsWith('/') ? p : p + '/') || pathname === p.replace(/\/$/, ''));
}

interface ResolvedIdentity {
  userId: string;
  tenantSlug?: string;
  roleId?: string;
  isEmployee: boolean;
  isSuperadmin: boolean;
}

async function resolveIdentity(request: NextRequest, isProduction: boolean): Promise<ResolvedIdentity | null> {
  const sessionCookie = request.cookies.get('pisairtel_session')?.value;
  if (sessionCookie) {
    const session = await verifySessionEdge(sessionCookie);
    if (session?.id) {
      return {
        userId: session.id,
        tenantSlug: session.tenantSlug,
        roleId: session.roleId,
        isEmployee: false,
        isSuperadmin: session.roleId === 'superadmin',
      };
    }
  }

  const empCookie = request.cookies.get('employee_session')?.value;
  if (empCookie) {
    const session = await verifySessionEdge(empCookie);
    if (session?.id) {
      return {
        userId: session.id,
        tenantSlug: session.tenantSlug,
        roleId: session.roleId,
        isEmployee: true,
        isSuperadmin: false,
      };
    }
  }

  const superadminCookie = request.cookies.get('superadmin_auth')?.value;
  if (superadminCookie) {
    const session = await verifySessionEdge(superadminCookie);
    if (session?.id && session.roleId === 'superadmin') {
      return { userId: session.id, roleId: 'superadmin', isEmployee: false, isSuperadmin: true };
    }
  }

  // Dev-only fallbacks: unsigned identity headers/cookies/query params are
  // accepted only outside production so local tooling keeps working.
  if (!isProduction) {
    const userId =
      request.headers.get('x-user-id') ||
      request.cookies.get('X-User-Id')?.value ||
      request.cookies.get('dev-user-id')?.value ||
      request.cookies.get('userId')?.value ||
      request.nextUrl.searchParams.get('userId') ||
      undefined;
    if (userId) {
      return {
        userId,
        tenantSlug:
          request.cookies.get('tenantSlug')?.value ||
          request.headers.get('x-tenant-slug') ||
          request.nextUrl.searchParams.get('tenantSlug') ||
          undefined,
        roleId:
          request.headers.get('x-role-id') ||
          request.cookies.get('X-Role-Id')?.value ||
          request.cookies.get('roleId')?.value ||
          request.nextUrl.searchParams.get('roleId') ||
          undefined,
        isEmployee: false,
        isSuperadmin: false,
      };
    }
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProduction = process.env.NODE_ENV === 'production';

  // CSRF protection: validate Origin/Referer for state-changing requests
  const method = request.method.toUpperCase();
  if (pathname.startsWith('/api/') && (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE')) {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    let isValidOrigin = false;
    if (origin) {
      try {
        const originUrl = new URL(origin);
        const allowedUrl = new URL(allowedOrigin);
        isValidOrigin = originUrl.host === allowedUrl.host || originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1';
      } catch {
        isValidOrigin = false;
      }
    } else if (referer) {
      try {
        const refererUrl = new URL(referer);
        const allowedUrl = new URL(allowedOrigin);
        isValidOrigin = refererUrl.host === allowedUrl.host || refererUrl.hostname === 'localhost' || refererUrl.hostname === '127.0.0.1';
      } catch {
        isValidOrigin = false;
      }
    } else {
      isValidOrigin = !isProduction;
    }

    if (!isValidOrigin) {
      return NextResponse.json(
        { error: 'CSRF validation failed: invalid origin' },
        { status: 403 }
      );
    }
  }

  // Block dev/debug APIs in production entirely
  if (isProduction && startsWithAny(pathname, DEV_ONLY_API_PREFIXES)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // General API rate limiting (auth routes have their own stricter limits)
  if (
    pathname.startsWith('/api/') &&
    !pathname.startsWith('/api/auth/') &&
    !pathname.startsWith('/api/hr/employees/auth/') &&
    !pathname.startsWith('/api/superadmin/auth/')
  ) {
    const { allowed, retryAfter } = checkRateLimit(`api:${getClientIp(request)}`, 120, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please slow down.' },
        { status: 429, headers: { 'Retry-After': retryAfter.toString() } }
      );
    }
  }

  // Protect superadmin pages — requires a signed-token cookie
  if (pathname.startsWith('/superadmin') && pathname !== '/superadmin/login') {
    const authCookie = request.cookies.get('superadmin_auth');
    if (!authCookie || !authCookie.value || authCookie.value === 'true') {
      return NextResponse.redirect(new URL('/superadmin/login', request.url));
    }
    // Verify signed token structure: must contain a dot separator
    if (!authCookie.value.includes('.') || authCookie.value.split('.').length < 2) {
      return NextResponse.redirect(new URL('/superadmin/login', request.url));
    }
  }

  // Protect tenant-admin routes (first-line defense in production).
  // Unsigned identity cookies no longer count — only signed sessions.
  if (
    pathname.startsWith('/tenant-admin') &&
    pathname !== '/tenant-admin/tenant-signin'
  ) {
    const hasSession = request.cookies.has('pisairtel_session');
    const hasSuperadmin = request.cookies.has('superadmin_auth');

    if (isProduction && !hasSession && !hasSuperadmin) {
      return NextResponse.redirect(
        new URL('/login?error=auth_required', request.url)
      );
    }
  }

  // Protect employee portal pages — public auth pages stay reachable.
  if (
    pathname.startsWith('/employee') &&
    pathname !== '/employee/login' &&
    pathname !== '/employee/forgot-password' &&
    pathname !== '/employee/reset-password'
  ) {
    if (isProduction && !request.cookies.has('employee_session')) {
      return NextResponse.redirect(new URL('/employee/login', request.url));
    }
  }

  // ─── API authentication ───
  if (pathname.startsWith('/api/') && !startsWithAny(pathname, PUBLIC_API_PREFIXES)) {
    const identity = await resolveIdentity(request, isProduction);

    if (startsWithAny(pathname, SUPERADMIN_API_PREFIXES)) {
      if (!identity?.isSuperadmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else {
      if (!identity) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Tenant binding: a request that names a tenant must match the
      // session's tenant. Superadmin tokens carry no tenantSlug and skip this.
      if (!identity.isSuperadmin && identity.tenantSlug) {
        const requestedTenant =
          request.nextUrl.searchParams.get('tenantSlug') ||
          request.headers.get('x-tenant-slug') ||
          undefined;
        if (requestedTenant && requestedTenant !== identity.tenantSlug) {
          return NextResponse.json({ error: 'Forbidden: cross-tenant access denied' }, { status: 403 });
        }
      }
    }
  }

  const response = NextResponse.next();

  // Allow microphone access on employee dashboard pages
  if (pathname.startsWith('/employee')) {
    response.headers.set('Permissions-Policy', 'microphone=(self), camera=(), geolocation=()');
  }

  return response;
}

export const config = {
  matcher: ['/superadmin/:path*', '/tenant-admin/:path*', '/employee/:path*', '/api/:path*'],
};
