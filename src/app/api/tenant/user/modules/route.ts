/**
 * Combined permission endpoint
 * GET /api/tenant/user/modules?tenantSlug=...
 * Returns role-based permissions AND employee module permissions in one call.
 */

import { NextRequest, NextResponse } from "next/server";
import { getTenantUserPermissions } from "@/lib/tenant-admin/permissions";
import { verifySession } from "@/lib/session";
import { sql } from "@/lib/sql-client";
import { cached } from "@/lib/cache";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tenantSlug = searchParams.get("tenantSlug");
  const userId =
    searchParams.get("userId") ||
    request.headers.get("x-user-id") ||
    request.cookies.get("X-User-Id")?.value ||
    request.cookies.get("dev-user-id")?.value ||
    request.cookies.get("userId")?.value;
  const roleId =
    searchParams.get("roleId") ||
    request.headers.get("x-role-id") ||
    request.cookies.get("X-Role-Id")?.value ||
    request.cookies.get("roleId")?.value ||
    undefined;

  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  // Try to get userId from session cookies
  let effectiveUserId = userId;
  let isEmployee = false;
  let employeeModules: Record<string, boolean> = {};

  if (!effectiveUserId) {
    const sysSession = request.cookies.get("syspro_session")?.value;
    if (sysSession) {
      const session = verifySession(sysSession);
      if (session) effectiveUserId = session.id;
    }
  }

  // Check employee session
  const empCookie = request.cookies.get("employee_session")?.value;
  if (empCookie) {
    const empSession = verifySession(empCookie);
    if (empSession && empSession.id) {
      effectiveUserId = empSession.id;
      isEmployee = true;
    }
  }

  if (!effectiveUserId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    // Fetch role-based permissions
    let permissions = await getTenantUserPermissions(tenantSlug, effectiveUserId, roleId ?? undefined);

    // If employee, also fetch module permissions
    if (isEmployee || (!permissions.isAdmin && permissions.dashboards.length === 0)) {
      const cacheKey = `empmods:${tenantSlug}:${effectiveUserId}`;
      employeeModules = await cached(cacheKey, 30_000, async () => {
        try {
          const empRows = await sql`
            SELECT portal_permissions FROM admin_employees
            WHERE id = ${effectiveUserId} AND tenant_slug = ${tenantSlug} AND is_portal_active = true
            LIMIT 1
          `;
          const emp = (empRows as any[])[0];
          if (emp && emp.portal_permissions) {
            return typeof emp.portal_permissions === 'string'
              ? JSON.parse(emp.portal_permissions)
              : emp.portal_permissions;
          }
          return {};
        } catch {
          return {};
        }
      });

      if (isEmployee && Object.keys(employeeModules).length > 0) {
        // Override role-based perms with employee module perms
        const level = (key: string) => employeeModules[key] === true ? "write" : "none";
        permissions = {
          people: level("people"),
          admin: level("admin"),
          integrations: "none",
          billing: "none",
          automation: level("automation"),
          crm: level("crm"),
          finance: level("finance"),
          projects: level("projects"),
          dashboards: [],
          isAdmin: false,
        };
      }
    }

    return NextResponse.json({
      ...permissions,
      isEmployee,
      employeeModules,
    });
  } catch (error) {
    console.error("Failed to fetch combined permissions:", error);
    return NextResponse.json({ error: "Failed to fetch permissions" }, { status: 500 });
  }
}
