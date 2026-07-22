/**
 * Tenant-scoped user permissions
 * GET /api/tenant/user/permissions?tenantSlug=...&userId=...
 */

import { NextRequest, NextResponse } from "next/server";
import { getTenantUserPermissions } from "@/lib/tenant-admin/permissions";
import { verifySession } from "@/lib/session";
import { sql } from "@/lib/sql-client";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tenantSlug = searchParams.get("tenantSlug");
  const userId =
    searchParams.get("userId") ||
    request.headers.get("x-user-id") ||
    request.headers.get("x-dev-user-id") ||
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
    return NextResponse.json(
      { error: "tenantSlug is required" },
      { status: 400 }
    );
  }

  if (!userId) {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 }
    );
  }

  try {
    let permissions = await getTenantUserPermissions(tenantSlug, userId, roleId ?? undefined);

    // If role-based permissions grant nothing, check if user is an employee
    // with module-based permissions (portal_permissions)
    if (!permissions.isAdmin && permissions.dashboards.length === 0) {
      const empCookie = request.cookies.get("employee_session")?.value;
      if (empCookie) {
        const empSession = verifySession(empCookie);
        if (empSession && empSession.id === userId) {
          try {
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
              // Map module permissions to the TenantUserPermissions format
              const level = (key: string) => modulePerms[key] === true ? "write" : "none";
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
          } catch (empErr) {
            console.error("Employee module permission lookup failed:", empErr);
          }
        }
      }
    }

    return NextResponse.json(permissions);
  } catch (error) {
    console.error("Failed to fetch tenant user permissions:", error);
    return NextResponse.json(
      { error: "Failed to fetch permissions" },
      { status: 500 }
    );
  }
}
