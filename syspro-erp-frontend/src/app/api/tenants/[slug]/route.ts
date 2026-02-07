import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { ensureTenantTable, mapTenantRow, TenantRow } from "../route";

const actionSchema = z.object({
  action: z.enum(["suspend", "activate"]),
});

type RouteContext = { params: Promise<{ slug: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
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

    const sql = getSql();
    await ensureTenantTable(sql);

    const status = parsed.data.action === "suspend" ? "Suspended" : "Live";

    const rows = (await sql(
      `
        update tenants
        set status = $1, "updatedAt" = now()
        where slug = $2
        returning name, slug, region, status, ledger_delta, seats
      `,
      [status, slug]
    )) as TenantRow[];

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
  const { slug } = await context.params;

  if (!slug) {
    return NextResponse.json({ error: "Tenant slug is required" }, { status: 400 });
  }

  try {
    const sql = getSql();
    await ensureTenantTable(sql);

    const rows = (await sql(
      `
        delete from tenants
        where slug = $1
        returning name, slug, region, status, ledger_delta, seats
      `,
      [slug]
    )) as TenantRow[];

    if (rows.length === 0) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Tenant deleted" }, { status: 200 });
  } catch (error) {
    console.error(`Tenant deletion failed for ${slug}`, error);
    return NextResponse.json({ error: "Unable to delete tenant" }, { status: 500 });
  }
}
