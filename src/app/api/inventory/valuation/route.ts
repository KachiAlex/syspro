export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import { sql as SQL } from "@/lib/sql-client";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "inventory", "read");
  if (!gate.ok) return gate.response;
  const sql = SQL;
  let layers: any[] = [], cogsRows: any[] = [], method = "moving_average";
  try {
    const [t] = (await sql`select settings from tenants where slug = ${context.tenantSlug}`) as any[];
    method = t?.settings?.inventory?.valuationMethod === "fifo" ? "fifo" : "moving_average";
    layers = (await sql`
      select product_sku, warehouse_id, remaining_qty as quantity, unit_cost,
             created_at::text as received_at
      from inventory_stock_layers
      where tenant_slug = ${context.tenantSlug} and remaining_qty > 0
      order by product_sku, created_at limit 500
    `) as any[];
    cogsRows = (await sql`
      select product_sku, product_name, movement_type, quantity, unit_cost, cogs_amount, created_at::text
      from stock_movements
      where tenant_slug = ${context.tenantSlug} and cogs_amount is not null
      order by created_at desc limit 100
    `) as any[];
  } catch { /* tables may not exist */ }
  return NextResponse.json({ method, layers, cogs: cogsRows });
}
