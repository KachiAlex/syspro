/**
 * DELETE /api/tenant/roles/[id]?tenantSlug=... — delete a custom role.
 * System roles (is_system) cannot be deleted. Assignments cascade-delete.
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { requireModuleAccess } from "@/lib/api-auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _scope = await requireModuleAccess(request, "admin", "write");
  if (!_scope.ok) return _scope.response;

  const { id } = await params;
  const tenantSlug =
    request.nextUrl.searchParams.get("tenantSlug") || _scope.user.tenantSlug;
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  try {
    const rows = await sql`
      delete from admin_roles
      where id = ${id} and tenant_slug = ${tenantSlug} and is_system = false
      returning id
    `;
    if (!Array.isArray(rows) || rows.length === 0) {
      const [existing] = await sql`
        select is_system from admin_roles where id = ${id} and tenant_slug = ${tenantSlug} limit 1
      ` as any[];
      if (existing?.is_system) {
        return NextResponse.json({ error: "System roles cannot be deleted" }, { status: 409 });
      }
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete role:", error);
    return NextResponse.json({ error: "Failed to delete role" }, { status: 500 });
  }
}
