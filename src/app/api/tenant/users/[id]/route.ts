export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { requireModuleAccess } from "@/lib/api-auth";
import { ensureTenantTable } from "@/lib/tenant/tenant-table";

type Params = { params: Promise<{ id: string }> };

function resolveSource(request: NextRequest, body?: any): "employee" | "admin" | null {
  const q = new URL(request.url).searchParams.get("source");
  const s = (body?.source || q || "").toLowerCase();
  if (s === "admin") return "admin";
  if (s === "employee") return "employee";
  return null;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const _scope = await requireModuleAccess(request, "admin", "write");
  if (!_scope.ok) return _scope.response;
  const tenantSlug = _scope.user.tenantSlug;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = typeof body?.status === "string" ? body.status : "inactive";
  const source = resolveSource(request, body);

  try {
    await ensureTenantTable(sql);
    let updated: any[] = [];
    if (source !== "admin") {
      updated = await sql`
        UPDATE admin_employees SET status = ${status}, updated_at = now()
        WHERE id = ${id} AND tenant_slug = ${tenantSlug}
        RETURNING id
      `;
    }
    if (!updated.length && source !== "employee") {
      // tenant_admins has no status column; treat PATCH as unsupported for admins
      return NextResponse.json(
        { error: "Tenant admin accounts cannot be deactivated here" },
        { status: 400 }
      );
    }
    if (!updated.length) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const _scope = await requireModuleAccess(request, "admin", "write");
  if (!_scope.ok) return _scope.response;
  const tenantSlug = _scope.user.tenantSlug;
  const { id } = await params;
  const source = resolveSource(request);

  try {
    await ensureTenantTable(sql);
    let deleted: any[] = [];
    if (source !== "admin") {
      deleted = await sql`
        DELETE FROM admin_employees WHERE id = ${id} AND tenant_slug = ${tenantSlug}
        RETURNING id
      `;
    }
    if (!deleted.length && source !== "employee") {
      deleted = await sql`
        DELETE FROM tenant_admins WHERE id::text = ${id} AND tenant_slug = ${tenantSlug}
        RETURNING id
      `;
    }
    if (!deleted.length) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    // Remove any role assignments for the deleted principal
    await sql`DELETE FROM admin_user_roles WHERE user_id = ${id} AND tenant_slug = ${tenantSlug}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete user:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
