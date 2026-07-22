import { NextRequest, NextResponse } from "next/server";
import { sql as SQL } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";

const BUSINESS_MODULES = [
  "self_service",
  "crm",
  "finance",
  "people",
  "projects",
  "sales",
  "analytics",
  "automation",
  "admin",
] as const;

const ALWAYS_ON = new Set(["self_service"]);

export function getDefaultPermissions(role: string): Record<string, boolean> {
  const r = (role || "staff").toLowerCase();
  const base: Record<string, boolean> = {};
  for (const mod of BUSINESS_MODULES) {
    base[mod] = ALWAYS_ON.has(mod);
  }

  const isHOD = r === "hod" || r === "head_of_department";
  const isHR = r === "hr" || r === "hr_admin" || r === "hr_manager";
  const isAdmin = r === "admin" || r === "administrator";

  if (isHOD) {
    base.projects = true;
    base.analytics = true;
  }
  if (isHR) {
    base.people = true;
    base.finance = true;
    base.analytics = true;
  }
  if (isAdmin) {
    for (const mod of BUSINESS_MODULES) {
      base[mod] = true;
    }
  }
  return base;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  try {
    await ensureHrTables(SQL);
    const rows = await SQL`
      SELECT role, is_portal_active, portal_permissions
      FROM admin_employees
      WHERE id = ${id} AND tenant_slug = ${tenantSlug}
      LIMIT 1
    `;
    const emp = (rows as any[])[0];
    if (!emp) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    let permissions: Record<string, boolean>;
    if (emp.portal_permissions && typeof emp.portal_permissions === "object") {
      permissions = { ...getDefaultPermissions(emp.role), ...emp.portal_permissions };
    } else {
      permissions = getDefaultPermissions(emp.role);
    }

    return NextResponse.json({
      permissions,
      isPortalActive: emp.is_portal_active ?? false,
      defaults: getDefaultPermissions(emp.role),
    });
  } catch (error: any) {
    console.error("portal-permissions GET error:", error?.message);
    return NextResponse.json({ error: "Failed to load permissions" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || !body.tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  const tenantSlug = body.tenantSlug as string;
  const permissions = body.permissions as Record<string, boolean> | undefined;
  const resetToDefaults = body.resetToDefaults === true;

  try {
    await ensureHrTables(SQL);

    let finalPermissions: Record<string, boolean> | null = null;

    if (resetToDefaults) {
      const rows = await SQL`
        SELECT role FROM admin_employees
        WHERE id = ${id} AND tenant_slug = ${tenantSlug}
        LIMIT 1
      `;
      const emp = (rows as any[])[0];
      if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
      finalPermissions = getDefaultPermissions(emp.role);
    } else if (permissions) {
      // Validate: only known modules, always-on modules stay true
      const cleaned: Record<string, boolean> = {};
      for (const mod of BUSINESS_MODULES) {
        if (ALWAYS_ON.has(mod)) {
          cleaned[mod] = true;
        } else {
          cleaned[mod] = permissions[mod] === true;
        }
      }
      finalPermissions = cleaned;
    }

    if (!finalPermissions) {
      return NextResponse.json({ error: "No permissions provided" }, { status: 400 });
    }

    await SQL`
      UPDATE admin_employees
      SET portal_permissions = ${JSON.stringify(finalPermissions)}::jsonb,
          updated_at = now()
      WHERE id = ${id} AND tenant_slug = ${tenantSlug}
    `;

    return NextResponse.json({ success: true, permissions: finalPermissions });
  } catch (error: any) {
    console.error("portal-permissions PATCH error:", error?.message);
    return NextResponse.json({ error: "Failed to update permissions" }, { status: 500 });
  }
}
