/**
 * API route to fetch all users in a tenant
 * GET /api/tenant/users?tenantSlug=...
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql } from "@/lib/sql-client";
import { requireDashboardPermission } from "@/lib/tenant-admin/permissions";
import { extractAuthContext } from "@/lib/auth-helper";
import { ensureTenantTable } from "@/lib/tenant/tenant-table";

import { requireModuleAccess } from "@/lib/api-auth";
export async function GET(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "admin", "read");
    if (!_scope.ok) return _scope.response;

  const auth = extractAuthContext(request);
  const tenantSlug = auth.tenantSlug;

  if (!tenantSlug) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    await requireDashboardPermission(request, "admin");
    await ensureTenantTable(sql);

    // Real user principals: tenant_admins (ERP admin users) + admin_employees
    // (portal staff). The legacy users/roles tables are not the live model.
    // roleId prefers an explicit admin_user_roles assignment, then the
    // principal's own role column.
    const rows = await sql`
      select p.id, p.email, p.name, p.status, p.base_role, p.contract_type, p.source, p.created_at,
             a.role_id as assigned_role_id, r.name as assigned_role_name
      from (
        select id::text as id, email, name, 'active' as status, coalesce(role, 'admin') as base_role,
               'admin' as contract_type, 'admin' as source, created_at
        from tenant_admins where tenant_slug = ${tenantSlug}
        union all
        select id::text as id, email, name, status, coalesce(role, 'staff') as base_role,
               coalesce(employment_type, 'full-time') as contract_type, 'employee' as source, created_at
        from admin_employees where tenant_slug = ${tenantSlug}
      ) p
      left join admin_user_roles a
        on a.user_id = p.id and a.tenant_slug = ${tenantSlug}
        and (a.expires_at is null or a.expires_at > now())
      left join admin_roles r on r.id = a.role_id
      order by p.created_at desc
    `;

    const users = Array.isArray(rows) ? rows.map((row: any) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      roleId: row.assigned_role_name || row.assigned_role_id || row.base_role || "viewer",
      baseRole: row.base_role,
      status: row.status,
      contractType: row.contract_type,
      source: row.source,
      isActive: row.status === "active",
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    })) : [];

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Failed to fetch tenant users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "admin", "write");
    if (!_scope.ok) return _scope.response;

  const auth = extractAuthContext(request);
  const tenantSlug = auth.tenantSlug;

  if (!tenantSlug) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    await requireDashboardPermission(request, "admin");
    await ensureTenantTable(sql);
    const body = await request.json();

    // CSV import: { users: [{ email, name?, contractType? }] }
    const entries: any[] = Array.isArray(body?.users)
      ? body.users
      : [body];

    // Enforce the tenant's seat limit before creating users.
    const validEntries = entries.filter(
      (entry) => typeof entry?.email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(entry.email.trim())
    );
    const [seatRow] = await sql`
      select t.seats,
             (select count(*) from tenant_admins where tenant_slug = ${tenantSlug}) +
             (select count(*) from admin_employees where tenant_slug = ${tenantSlug}) as current_users
      from tenants t
      where t.slug = ${tenantSlug} and t."deletedAt" is null
      limit 1
    `;
    const seats = Number(seatRow?.seats ?? 0);
    const currentUsers = Number(seatRow?.current_users ?? 0);
    if (seats > 0 && currentUsers + validEntries.length > seats) {
      return NextResponse.json(
        { error: `Seat limit reached. This workspace allows ${seats} user${seats === 1 ? "" : "s"}.` },
        { status: 403 }
      );
    }

    const created: any[] = [];
    for (const entry of entries) {
      const email = typeof entry?.email === "string" ? entry.email.trim() : "";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) continue;
      const name = entry?.name || email.split("@")[0];
      const userId = randomUUID();
      const [row] = await sql`
        INSERT INTO admin_employees
          (id, tenant_slug, name, email, status, role, employment_type, is_portal_active, created_at, updated_at)
        VALUES
          (${userId}, ${tenantSlug}, ${name}, ${email}, 'invited', 'staff',
           ${entry?.contractType || "full-time"}, false, now(), now())
        ON CONFLICT (id) DO NOTHING
        RETURNING id, email, name, status
      `;
      if (row) created.push(row);
    }

    if (created.length === 0) {
      return NextResponse.json(
        { error: "No valid email addresses supplied" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, users: created, user: created[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
