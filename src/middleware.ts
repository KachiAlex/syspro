import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getTenantUserPermissions } from '@/lib/tenant-admin/permissions';

function getRequiredPermissionForPath(pathname: string): string | null {
  if (pathname === '/api/tenant/user/permissions' || pathname.startsWith('/api/auth/')) return null;
  if (pathname.startsWith('/api/automation/')) return 'automation';
  if (pathname.startsWith('/api/finance/') || pathname.startsWith('/api/tenant/billing')) return 'finance';
  if (pathname.startsWith('/api/crm/')) return 'crm';
  if (pathname.startsWith('/api/hr/') || pathname.startsWith('/api/tenant/employees')) return 'people';
  if (pathname.startsWith('/api/projects/')) return 'projects';
  if (pathname.startsWith('/api/reports/')) return 'reports';
  if (pathname.startsWith('/api/inventory/')) return 'crm';
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

  // Enforce dashboard permissions on tenant-scoped API routes
  if (pathname.startsWith('/api/')) {
    const permissionKey = getRequiredPermissionForPath(pathname);
    if (permissionKey) {
      const tenantSlug =
        request.nextUrl.searchParams.get('tenantSlug') ||
        request.cookies.get('tenantSlug')?.value;
      const userId =
        request.nextUrl.searchParams.get('userId') ||
        request.headers.get('x-user-id') ||
        request.headers.get('x-dev-user-id') ||
        request.cookies.get('dev-user-id')?.value ||
        request.cookies.get('userId')?.value;

      if (!tenantSlug || !userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      try {
        const perms = await getTenantUserPermissions(tenantSlug, userId);
        const hasAccess =
          perms.isAdmin ||
          perms.dashboards.includes(permissionKey) ||
          ((perms as any)[permissionKey] !== 'none' &&
            (perms as any)[permissionKey] !== undefined);
        if (!hasAccess) {
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

  return NextResponse.next();
}

export const config = {
  matcher: ['/superadmin/:path*', '/tenant-admin/:path*', '/api/:path*'],
};