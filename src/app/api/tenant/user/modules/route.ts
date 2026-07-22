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
  let roleId =
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

  // Check syspro_session (tenant admin) FIRST — takes priority over employee session
  const sysSession = request.cookies.get("syspro_session")?.value;
  if (sysSession) {
    const session = verifySession(sysSession);
    if (session) {
      effectiveUserId = session.id;
      // Also extract roleId from session if not already set
      if (!roleId && session.roleId) {
        roleId = session.roleId;
      }
    }
  }

  // Only check employee session if no admin session was found
  if (!effectiveUserId) {
    const empCookie = request.cookies.get("employee_session")?.value;
    if (empCookie) {
      const empSession = verifySession(empCookie);
      if (empSession && empSession.id) {
        effectiveUserId = empSession.id;
        isEmployee = true;
      }
    }
  }

  if (!effectiveUserId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    // Fetch role-based permissions
    let permissions = await getTenantUserPermissions(tenantSlug, effectiveUserId, roleId ?? undefined);

    // Always fetch module permissions (portal_permissions) for any user
    // EXCEPT full admins — they should never be restricted by portal_permissions
    const isFullAdmin = roleId?.toLowerCase() === "admin" || permissions.isAdmin;
    if (!isFullAdmin) {
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
    }

    const hasModuleRestrictions = Object.keys(employeeModules).length > 0;

    if (isEmployee && hasModuleRestrictions) {
      // For employees: completely override role-based perms with module perms
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
    } else if (!isEmployee && hasModuleRestrictions) {
      // For non-employees (HOD, staff, etc.): restrict visible modules to only those
      // explicitly enabled in portal_permissions. Role-based perm level is kept for
      // allowed modules, but modules not in portal_permissions are set to "none".
      const moduleKeys = ["crm", "finance", "people", "projects", "sales", "analytics", "automation", "admin"];
      for (const mk of moduleKeys) {
        if (employeeModules[mk] !== true) {
          (permissions as any)[mk] = "none";
        }
      }
      // Also restrict dashboards to only allowed modules
      const allowedDashboards = permissions.dashboards.filter(
        (d) => employeeModules[d] === true || d === "admin" && employeeModules["admin"] === true
      );
      permissions = { ...permissions, dashboards: allowedDashboards };
      // Non-employees with module restrictions should not have full admin
      if (employeeModules["admin"] !== true) {
        permissions = { ...permissions, isAdmin: false, admin: "none" };
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
