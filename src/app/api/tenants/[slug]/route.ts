export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, sql as SQL, SqlClient } from "@/lib/sql-client";
import { ensureTenantTable } from "@/lib/tenant/tenant-table";
import { mapTenantRow, TenantRow } from "../route";
import { requireSuperAdmin } from "@/lib/api-auth";

const actionSchema = z.object({
  action: z.enum(["suspend", "activate"]),
});

type RouteContext = { params: Promise<{ slug: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
    const _auth = await requireSuperAdmin(request);
    if (!_auth.ok) return _auth.response;

  const { slug } = await context.params;

  if (!slug) {
    return NextResponse.json({ error: "Tenant slug is required" }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = actionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }


    const sql = SQL;
    await ensureTenantTable(sql);

    const isActive = parsed.data.action === "activate";
    const status = isActive ? "active" : "suspended";

    const rows = (await db.query(
      `
        update tenants
        set status = $1, "isActive" = $2, "updatedAt" = now()
        where slug = $3 and "deletedAt" is null
        returning name, slug, region, status, ledger_delta, seats, admin_email, "isActive" as is_active, "schemaName" as schema_name
      `,
      [status, isActive, slug]
    )).rows as any[];

    if (rows.length === 0) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    return NextResponse.json({ tenantSummary: mapTenantRow(rows[0]) });
  } catch (error) {
    console.error(`Tenant status update failed for ${slug}`, error);
    return NextResponse.json({ error: "Unable to update tenant" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
    const _auth = await requireSuperAdmin(_request);
    if (!_auth.ok) return _auth.response;

  const { slug } = await context.params;

  if (!slug) {
    return NextResponse.json({ error: "Tenant slug is required" }, { status: 400 });
  }

  try {
    const sql = SQL;
    await ensureTenantTable(sql);

    // Soft-delete: mark deletedAt and set isActive = false so tenants are not removed permanently by accident
    const rows = (await db.query(
      `
        update tenants
        set "deletedAt" = now(), "isActive" = false, status = 'deleted', "updatedAt" = now()
        where slug = $1 and "deletedAt" is null
        returning name, slug, region, status, ledger_delta, seats
      `,
      [slug]
    )).rows as any[];

    if (rows.length === 0) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Tenant soft-deleted" }, { status: 200 });
  } catch (error) {
    console.error(`Tenant deletion failed for ${slug}`, error);
    return NextResponse.json({ error: "Unable to delete tenant" }, { status: 500 });
  }
}
