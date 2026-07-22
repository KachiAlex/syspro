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
  // roleId from query params/cookies is only a dev fallback.
  // In production, roleId is always extracted from the signed session below.
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
  let sessionEmail: string | undefined;
  if (sysSession) {
    const session = verifySession(sysSession);
    if (session) {
      effectiveUserId = session.id;
      sessionEmail = session.email;
      // Use roleId from the signed session as initial value
      roleId = session.roleId || undefined;
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

  // For tenant admin users, verify the actual role from the database.
  // The session defaults NULL roles to "admin", but the user might be a
  // HOD or other non-admin role. We need the real DB role to prevent
  // accidentally granting admin access.
  if (!isEmployee && sessionEmail) {
    try {
      const adminRows = await sql`
        SELECT role FROM tenant_admins
        WHERE lower(email) = lower(${sessionEmail}) AND tenant_slug = ${tenantSlug}
        LIMIT 1
      `;
      const adminRow = (adminRows as any[])[0];
      if (adminRow) {
        // Use the actual DB role. If it's NULL, don't default to "admin" —
        // use "viewer" as a safe default. The portal_permissions will
        // determine what modules the user can access.
        roleId = adminRow.role || "viewer";
      }
    } catch {
      // If the lookup fails, keep the session's roleId
    }
  }

  try {
    // Fetch role-based permissions
    let permissions = await getTenantUserPermissions(tenantSlug, effectiveUserId, roleId ?? undefined);

    // Always fetch module permissions (portal_permissions) for any user.
    // Even if roleId is "admin", we still check — a HOD user may have been
    // created in tenant_admins with a NULL role (which defaults to "admin"
    // at login time) but have portal_permissions set in admin_employees.
    // Only skip if we're certain this is a true admin with no portal_permissions.
    const cacheKey = `empmods:${tenantSlug}:${effectiveUserId}:${sessionEmail || ''}`;
    employeeModules = await cached(cacheKey, 30_000, async () => {
      try {
        // First try by ID (works for employees whose session ID matches admin_employees.id)
        // Don't require is_portal_active — the user is already authenticated via session.
        // portal_permissions should be respected regardless of portal login status.
        let empRows = await sql`
          SELECT portal_permissions FROM admin_employees
          WHERE id = ${effectiveUserId} AND tenant_slug = ${tenantSlug}
          LIMIT 1
        `;
        let emp = (empRows as any[])[0];

        // If not found by ID, try by email (handles tenant_admins users whose
        // admin_employees record has a different ID)
        if (!emp && sessionEmail) {
          empRows = await sql`
            SELECT portal_permissions FROM admin_employees
            WHERE lower(email) = lower(${sessionEmail}) AND tenant_slug = ${tenantSlug}
            LIMIT 1
          `;
          emp = (empRows as any[])[0];
        }

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

    // If no portal_permissions found, this user has no module restrictions.
    // Full admins with no portal_permissions get unrestricted access.
    const isFullAdmin = roleId?.toLowerCase() === "admin" || permissions.isAdmin;

    const hasModuleRestrictions = Object.keys(employeeModules).length > 0;

    // If user has portal_permissions set, apply restrictions regardless of roleId.
    // This handles HOD users who may be in tenant_admins with role defaulting to
    // "admin" but have module activations in admin_employees.
    if (hasModuleRestrictions && isFullAdmin && !isEmployee) {
      // Override: treat as non-admin with module restrictions
      const moduleKeys = ["crm", "finance", "people", "projects", "sales", "analytics", "automation", "admin"];
      for (const mk of moduleKeys) {
        if (employeeModules[mk] !== true) {
          (permissions as any)[mk] = "none";
        }
      }
      const allowedDashboards = permissions.dashboards.filter(
        (d) => employeeModules[d] === true
      );
      permissions = { ...permissions, dashboards: allowedDashboards, isAdmin: false, admin: "none" };
    } else if (isEmployee && hasModuleRestrictions) {
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
        sales: level("sales"),
        analytics: level("analytics"),
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
      roleId: roleId || undefined,
      employeeModules,
      _debug: {
        effectiveUserId,
        sessionEmail,
        roleId,
        isFullAdmin,
        hasModuleRestrictions,
        employeeModulesRaw: employeeModules,
      },
    });
  } catch (error) {
    console.error("Failed to fetch combined permissions:", error);
    return NextResponse.json({ error: "Failed to fetch permissions" }, { status: 500 });
  }
}
