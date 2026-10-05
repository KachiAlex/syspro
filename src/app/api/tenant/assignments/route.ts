/**
 * Role assignments API.
 *
 * GET    /api/tenant/assignments?tenantSlug=... — list current assignments
 *         joined to roles, including expired/delegation metadata.
 * DELETE /api/tenant/assignments — body { userId, roleId, tenantSlug }
 *         removes a specific assignment.
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { setupTenantAdminSchema } from "@/lib/tenant-admin/schema";
import { ensureTenantTable } from "@/lib/tenant/tenant-table";
import { requireModuleAccess } from "@/lib/api-auth";
import { invalidateTenantPermissions } from "@/lib/tenant-admin/permissions";

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
    await ensureTenantTable(sql);
    const rows = await sql`
      select a.id, a.user_id, a.role_id, a.scope, a.expires_at, a.justification,
             a.created_at, r.name as role_name,
             coalesce(e.email, ta.email) as user_email,
             coalesce(e.name, ta.name) as user_name
      from admin_user_roles a
      join admin_roles r on r.id = a.role_id
      left join admin_employees e on e.id = a.user_id and e.tenant_slug = a.tenant_slug
      left join tenant_admins ta on ta.id::text = a.user_id and ta.tenant_slug = a.tenant_slug
      where a.tenant_slug = ${tenantSlug}
      order by a.created_at desc
    `;

    const now = new Date();
    const assignments = (Array.isArray(rows) ? rows : []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email,
      userName: row.user_name,
      roleId: row.role_id,
      roleName: row.role_name,
      scope: row.scope,
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
      expired: row.expires_at ? new Date(row.expires_at) < now : false,
      isDelegation: !!row.expires_at,
      justification: row.justification,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    }));

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error("Failed to list assignments:", error);
    return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "admin", "write");
  if (!_scope.ok) return _scope.response;

  try {
    const body = await request.json();
    const { userId, roleId } = body;
    const tenantSlug = body.tenantSlug || _scope.user.tenantSlug;

    if (!userId || !roleId || !tenantSlug) {
      return NextResponse.json(
        { error: "userId, roleId and tenantSlug are required" },
        { status: 400 }
      );
    }

    await setupTenantAdminSchema(sql);
    await ensureTenantTable(sql);
    const rows = await sql`
      delete from admin_user_roles
      where tenant_slug = ${tenantSlug} and user_id = ${userId} and role_id = ${roleId}
      returning id
    `;
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    invalidateTenantPermissions(tenantSlug, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to remove assignment:", error);
    return NextResponse.json({ error: "Failed to remove assignment" }, { status: 500 });
  }
}
