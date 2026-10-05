import { NextRequest, NextResponse } from "next/server";
import { getTenantUserPermissions } from "@/lib/tenant-admin/permissions";
import { verifySession } from "@/lib/session";
import { sql } from "@/lib/sql-client";
import { ensureTenantTable } from "@/lib/tenant/tenant-table";

export const dynamic = "force-dynamic";

const EMPTY_PERMISSIONS = {
  people: "none",
  admin: "none",
  integrations: "none",
  billing: "none",
  automation: "none",
  crm: "none",
  finance: "none",
  projects: "none",
  sales: "none",
  analytics: "none",
  manufacturing: "none",
};

/**
 * GET /api/user/permissions
 * Session-resolving variant of /api/tenant/user/permissions — derives
 * tenant/user identity from the signed cookies instead of query params.
 */
export async function GET(request: NextRequest) {
  const sysSession = request.cookies.get("pisairtel_session")?.value;
  const session = sysSession ? verifySession(sysSession) : null;
  const empSession = !session
    ? (() => {
        const c = request.cookies.get("employee_session")?.value;
        return c ? verifySession(c) : null;
      })()
    : null;

  const userId = session?.id || empSession?.id;
  const tenantSlug =
    session?.tenantSlug ||
    empSession?.tenantSlug ||
    request.cookies.get("tenantSlug")?.value;

  if (!userId || !tenantSlug) {
    return NextResponse.json(
      { ...EMPTY_PERMISSIONS, error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    await ensureTenantTable(sql);
    let permissions = await getTenantUserPermissions(tenantSlug, userId, session?.roleId || undefined);

    if (!permissions.isAdmin && permissions.dashboards.length === 0 && empSession) {
      try {
        const empRows = await sql`
          SELECT portal_permissions FROM admin_employees
          WHERE id = ${userId} AND tenant_slug = ${tenantSlug} AND is_portal_active = true
          LIMIT 1
        `;
        const emp = (empRows as any[])[0];
        if (emp?.portal_permissions) {
          const modulePerms =
            typeof emp.portal_permissions === "string"
              ? JSON.parse(emp.portal_permissions)
              : emp.portal_permissions;
          const level = (key: string) => (modulePerms[key] === true ? "write" : "none");
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
        }
      } catch (empErr) {
        console.error("Employee module permission lookup failed:", empErr);
      }
    }

    return NextResponse.json({
      ...permissions,
      userId,
      roleId: session?.roleId || undefined,
      tenantSlug,
    });
  } catch (error) {
    console.error("Failed to fetch user permissions:", error);
    return NextResponse.json(
      { ...EMPTY_PERMISSIONS, error: "Failed to fetch permissions" },
      { status: 500 }
    );
  }
}
