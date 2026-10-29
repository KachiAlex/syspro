/**
 * Tenant-scoped user permissions
 * GET /api/tenant/user/permissions?tenantSlug=...&userId=...
 *
 * Requires a verified session. Callers may query their own permissions;
 * querying another user requires tenant-admin privileges on that tenant.
 */

import { NextRequest, NextResponse } from "next/server";
import { getTenantUserPermissions } from "@/lib/tenant-admin/permissions";
import { verifySession } from "@/lib/session";
import { sql } from "@/lib/sql-client";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tenantSlug = searchParams.get("tenantSlug");

  if (!tenantSlug) {
    return NextResponse.json(
      { error: "tenantSlug is required" },
      { status: 400 }
    );
  }

  // Authenticate: signed tenant-admin session or employee session.
  const sysSession = request.cookies.get("pisairtel_session")?.value;
  const empCookie = request.cookies.get("employee_session")?.value;
  const session = (sysSession && verifySession(sysSession)) ||
    (empCookie && verifySession(empCookie)) || null;

  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The session must belong to the requested tenant (or be tenant-agnostic
  // superadmin tooling — tenantSlug absent on some legacy sessions, so we
  // only hard-reject on an explicit mismatch).
  if (session.tenantSlug && session.tenantSlug !== tenantSlug) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requestedUserId = searchParams.get("userId") || session.id;
  const roleId = searchParams.get("roleId") || session.roleId || undefined;

  // Cross-user queries require the caller to be a tenant admin.
  if (requestedUserId !== session.id) {
    const callerPerms = await getTenantUserPermissions(
      tenantSlug, session.id, session.roleId ?? undefined
    ).catch(() => null);
    if (!callerPerms?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    let permissions = await getTenantUserPermissions(tenantSlug, requestedUserId, roleId ?? undefined);

    // If role-based permissions grant nothing, check if user is an employee
    // with module-based permissions (portal_permissions) — self-query only.
    if (!permissions.isAdmin && permissions.dashboards.length === 0 && requestedUserId === session.id) {
      if (empCookie) {
        const empSession = verifySession(empCookie);
        if (empSession && empSession.id === requestedUserId) {
          try {
            const empRows = await sql`
              SELECT portal_permissions FROM admin_employees
              WHERE id = ${requestedUserId} AND tenant_slug = ${tenantSlug} AND is_portal_active = true
              LIMIT 1
            `;
            const emp = (empRows as any[])[0];
            if (emp && emp.portal_permissions) {
              const modulePerms = typeof emp.portal_permissions === 'string'
                ? JSON.parse(emp.portal_permissions)
                : emp.portal_permissions;
              // Map module permissions to the TenantUserPermissions format
              const level = (key: string) => { const v = modulePerms[key]; return v === true || v === "write" ? "write" : v === "read" ? "read" : v === "admin" ? "admin" : "none"; };
              permissions = {
                people: level("people"),
                admin: level("admin"),
                integrations: level("integrations"),
                billing: "none",
                automation: level("automation"),
                crm: level("crm"),
                finance: level("finance"),
                projects: level("projects"),
                sales: level("sales"),
                analytics: level("analytics"),
                inventory: level("inventory"),
                manufacturing: level("manufacturing"),
                pos: level("pos"),
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
