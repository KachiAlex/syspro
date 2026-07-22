import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getTenantUserPermissions } from '@/lib/tenant-admin/permissions';
import { verifySession } from '@/lib/session';
import { checkRateLimit, getRateLimitKey } from '@/lib/rate-limit';

function getRequiredPermissionForPath(pathname: string): string | null {
  if (pathname === '/api/tenant/user/permissions' || pathname === '/api/tenant/user/modules' || pathname.startsWith('/api/auth/') || pathname === '/api/employee-lookup') return null;
  // Employee portal auth routes must be public
  if (
    pathname.startsWith('/api/hr/employees/auth/login') ||
    pathname.startsWith('/api/hr/employees/auth/logout') ||
    pathname.startsWith('/api/hr/employees/auth/forgot-password') ||
    pathname.startsWith('/api/hr/employees/auth/reset-password') ||
    pathname.startsWith('/api/hr/employees/me') ||
    pathname.startsWith('/api/hr/employees/portal/')
  ) return null;
  if (pathname.startsWith('/api/automation/')) return 'automation';
  if (pathname.startsWith('/api/finance/') || pathname.startsWith('/api/tenant/billing')) return 'finance';
  if (pathname.startsWith('/api/crm/')) return 'crm';
  if (pathname.startsWith('/api/hr/') || pathname.startsWith('/api/tenant/employees')) return 'people';
  if (pathname.startsWith('/api/projects/')) return 'projects';
  if (pathname.startsWith('/api/sales/') || pathname.startsWith('/api/suppliers/') || pathname.startsWith('/api/purchase-orders/')) return 'sales';
  if (pathname.startsWith('/api/reports/') || pathname.startsWith('/api/analytics/')) return 'analytics';
  if (pathname.startsWith('/api/inventory/')) return 'sales';
  if (
    pathname.startsWith('/api/tenant/branches') ||
    pathname.startsWith('/api/tenant/users') ||
    pathname.startsWith('/api/tenant/health') ||
    pathname.startsWith('/api/tenant/audit') ||
    pathname.startsWith('/api/tenant/org-structure') ||
    pathname.startsWith('/api/tenant/access-restrictions') ||
    pathname.startsWith('/api/tenant/roles') ||
    pathname.startsWith('/api/tenant/modules')
  ) {
    return 'admin';
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
      // No Origin or Referer header — reject in production, allow in dev for curl/postman
      isValidOrigin = !isProduction;
    }

    if (!isValidOrigin) {
      return NextResponse.json(
        { error: 'CSRF validation failed: invalid origin' },
        { status: 403 }
      );
    }
  }

  // General API rate limiting (auth routes have their own limits)
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/') && !pathname.startsWith('/api/hr/employees/auth/')) {
    const { allowed, retryAfter } = checkRateLimit(`api:${getRateLimitKey(request)}`, 120, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please slow down.' },
        { status: 429, headers: { 'Retry-After': retryAfter.toString() } }
      );
    }
  }

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
    const hasSession = request.cookies.has('syspro_session');
    const hasEmployeeSession = request.cookies.has('employee_session');
    const hasUserId =
      request.cookies.has('X-User-Id') ||
      request.cookies.has('dev-user-id') ||
      request.cookies.has('userId');
    const hasSuperadmin = request.cookies.has('superadmin_auth');

    if (isProduction) {
      if (!hasSession && !hasEmployeeSession && !hasUserId && !hasSuperadmin) {
        return NextResponse.redirect(
          new URL('/login?error=auth_required', request.url)
        );
      }
    }

    // Employees share the same tenant-admin routes as admins.
    // Access to specific modules is controlled by the sidebar canView logic,
    // the shell's allowed check, and the API permission enforcement below.
  }

  // Enforce dashboard permissions on tenant-scoped API routes
  if (pathname.startsWith('/api/')) {
    const permissionKey = getRequiredPermissionForPath(pathname);
    if (permissionKey) {
      // Prefer session-derived tenantSlug to prevent cross-tenant access
      let tenantSlug: string | undefined;
      let userId: string | undefined;
      let roleId: string | undefined;

      // 1. Try extracting from syspro_session cookie first
      const sessionCookie = request.cookies.get('syspro_session')?.value;
      if (sessionCookie) {
        const session = verifySession(sessionCookie);
        if (session) {
          userId = session.id;
          tenantSlug = session.tenantSlug || undefined;
          roleId = session.roleId || undefined;
        }
      }

      // 1b. Try employee_session cookie
      if (!userId) {
        const empCookie = request.cookies.get('employee_session')?.value;
        if (empCookie) {
          const session = verifySession(empCookie);
          if (session) {
            userId = session.id;
            tenantSlug = session.tenantSlug || undefined;
            roleId = session.roleId || undefined;
          }
        }
      }

      // 2. Fallback to headers (proxy/dev flows)
      if (!userId) {
        userId =
          request.headers.get('x-user-id') ||
          request.headers.get('x-dev-user-id') ||
          request.cookies.get('X-User-Id')?.value ||
          request.cookies.get('dev-user-id')?.value ||
          request.cookies.get('userId')?.value ||
          undefined;
        roleId = roleId ||
          request.headers.get('x-role-id') ||
          request.cookies.get('X-Role-Id')?.value ||
          request.cookies.get('roleId')?.value ||
          undefined;
      }

      // 3. Tenant slug: prefer cookie, then query param (dev only)
      if (!tenantSlug) {
        tenantSlug =
          request.cookies.get('tenantSlug')?.value ||
          request.headers.get('x-tenant-slug') ||
          undefined;
      }

      const isDev = !isProduction;
      if (!tenantSlug && isDev) {
        tenantSlug = request.nextUrl.searchParams.get('tenantSlug') || undefined;
      }
      if (isDev && !userId) {
        userId = request.nextUrl.searchParams.get('userId') || undefined;
        roleId = request.nextUrl.searchParams.get('roleId') || roleId || undefined;
      }

      if (!tenantSlug || !userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      try {
        const perms = await getTenantUserPermissions(tenantSlug, userId, roleId ?? undefined);
        const hasAccess =
          perms.isAdmin ||
          perms.dashboards.includes(permissionKey) ||
          ((perms as any)[permissionKey] !== 'none' &&
            (perms as any)[permissionKey] !== undefined);

        if (!hasAccess) {
          // Check if user is an employee with module permissions
          const empCookie = request.cookies.get('employee_session')?.value;
          if (empCookie) {
            const empSession = verifySession(empCookie);
            if (empSession && empSession.id === userId) {
              try {
                const { sql } = await import('@/lib/sql-client');
                const empRows = await sql`
                  SELECT portal_permissions FROM admin_employees
                  WHERE id = ${userId} AND tenant_slug = ${tenantSlug} AND is_portal_active = true
                  LIMIT 1
                `;
                const emp = (empRows as any[])[0];
                if (emp && emp.portal_permissions) {
                  const modulePerms = typeof emp.portal_permissions === 'string'
                    ? JSON.parse(emp.portal_permissions)
                    : emp.portal_permissions;
                  // Map permission keys: 'sales' module covers inventory/sales, 'analytics' covers reports
                  const moduleKey = permissionKey === 'reports' ? 'analytics' : permissionKey;
                  if (modulePerms[moduleKey] === true || modulePerms[permissionKey] === true) {
                    // Access granted via employee module permission
                    const response = NextResponse.next();
                    return response;
                  }
                }
              } catch (empErr) {
                console.error('Employee module permission check failed:', empErr);
              }
            }
          }
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      } catch (err) {
        return NextResponse.json(
          { error: 'Permission check failed' },
          { status: 500 }
        );
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