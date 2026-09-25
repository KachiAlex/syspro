/**
 * Roles API — real persistence on admin_roles.
 *
 * GET  /api/tenant/roles?tenantSlug=... — list roles (seeds system presets
 *        for the tenant on first call)
 * POST /api/tenant/roles — create a custom role { name, description?,
 *        permissions: string[] }
 *
 * Permission keys follow the format consumed by getTenantUserPermissions():
 *   "all"                    — full admin access
 *   "<module>.read|.write"   — governed module level
 *   "dashboard:<name>"       — dashboard visibility
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql } from "@/lib/sql-client";
import { setupTenantAdminSchema } from "@/lib/tenant-admin/schema";
import { requireModuleAccess } from "@/lib/api-auth";

const GOVERNED_MODULES = [
  "crm", "finance", "people", "billing", "automation",
  "projects", "admin", "sales", "analytics",
];
const DASHBOARDS = [
  "admin", "automation", "finance", "people", "crm",
  "projects", "reports", "billing", "sales", "analytics",
];

function moduleKeys(levels: Record<string, string>): string[] {
  const keys: string[] = [];
  for (const m of GOVERNED_MODULES) {
    const lvl = levels[m];
    if (lvl === "admin") keys.push(`${m}.write`, `${m}.read`);
    else if (lvl === "write" || lvl === "read") keys.push(`${m}.${lvl}`);
  }
  for (const d of DASHBOARDS) {
    const lvl = levels[d];
    if (lvl && lvl !== "none") keys.push(`dashboard:${d}`);
  }
  return keys;
}

// System presets mirrored from getDefaultRolePermissions() — seeded per tenant
// so they can be assigned through admin_user_roles like any other role.
function presetRoles(tenantSlug: string) {
  return [
    { id: `sys-${tenantSlug}-admin`, name: "Administrator", scope: "tenant", permissions: ["all"], description: "Full system access", is_system: true },
    {
      id: `sys-${tenantSlug}-manager`, name: "Manager", scope: "tenant",
      permissions: moduleKeys({ crm: "write", finance: "read", people: "write", projects: "write", billing: "read", automation: "read", admin: "read", sales: "read", analytics: "read", reports: "read" }),
      description: "Write access to most modules", is_system: true,
    },
    {
      id: `sys-${tenantSlug}-editor`, name: "Editor", scope: "tenant",
      permissions: moduleKeys({ crm: "write", finance: "read", people: "read", projects: "write", billing: "read", automation: "read", sales: "read", analytics: "read", reports: "read" }),
      description: "Write access with restrictions", is_system: true,
    },
    {
      id: `sys-${tenantSlug}-viewer`, name: "Viewer", scope: "tenant",
      permissions: moduleKeys({ crm: "read", finance: "read", people: "read", projects: "read", billing: "read", sales: "read", analytics: "read", reports: "read" }),
      description: "Read-only access", is_system: true,
    },
  ];
}

async function seedPresets(tenantSlug: string) {
  for (const r of presetRoles(tenantSlug)) {
    await sql`
      insert into admin_roles (id, tenant_slug, name, scope, permissions, description, is_system)
      values (${r.id}, ${tenantSlug}, ${r.name}, ${r.scope}, ${r.permissions}::text[], ${r.description}, ${r.is_system})
      on conflict (id) do nothing
    `;
  }
}

function validPermissionKeys(keys: unknown): keys is string[] {
  if (!Array.isArray(keys)) return false;
  return keys.every((k) => {
    if (typeof k !== "string" || !k) return false;
    if (k === "all") return true;
    if (k.startsWith("dashboard:")) return DASHBOARDS.includes(k.slice(10));
    const [mod, lvl] = k.split(".");
    return GOVERNED_MODULES.includes(mod) && (lvl === "read" || lvl === "write");
  });
}

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "admin", "read");
  if (!_scope.ok) return _scope.response;

  const tenantSlug =
    request.nextUrl.searchParams.get("tenantSlug") || _scope.user.tenantSlug;
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  try {
    await setupTenantAdminSchema(sql);
    await seedPresets(tenantSlug);
    const rows = await sql`
      select id, name, scope, permissions, description, is_system, created_at
      from admin_roles where tenant_slug = ${tenantSlug}
      order by is_system desc, created_at asc
    `;
    return NextResponse.json({ roles: rows });
  } catch (error) {
    console.error("Failed to list roles:", error);
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "admin", "write");
  if (!_scope.ok) return _scope.response;

  try {
    const body = await request.json();
    const tenantSlug = body.tenantSlug || _scope.user.tenantSlug;
    const { name, description, permissions } = body;

    if (!tenantSlug || !name || typeof name !== "string") {
      return NextResponse.json(
        { error: "name and tenantSlug are required" },
        { status: 400 }
      );
    }
    if (!validPermissionKeys(permissions)) {
      return NextResponse.json(
        { error: `permissions must be keys like "all", "finance.read", "finance.write", "dashboard:finance"` },
        { status: 400 }
      );
    }

    await setupTenantAdminSchema(sql);
    const id = randomUUID();
    const [row] = await sql`
      insert into admin_roles (id, tenant_slug, name, scope, permissions, description, is_system, created_by)
      values (${id}, ${tenantSlug}, ${name.trim()}, 'tenant', ${permissions}::text[], ${description || null}, false, ${_scope.user.id})
      returning id, name, scope, permissions, description, is_system, created_at
    ` as any[];
    return NextResponse.json({ role: row }, { status: 201 });
  } catch (error) {
    console.error("Failed to create role:", error);
    return NextResponse.json({ error: "Failed to create role" }, { status: 500 });
  }
}
