import { randomUUID } from "crypto";
import { sql as SQL, db } from "../sql-client";

/**
 * Stock valuation — FIFO layers. Opt-in per tenant via
 * `settings.inventory.valuationMethod = "fifo"` (default: moving-average,
 * which is what unit_cost updates already provide). Positive movements
 * push a cost layer; issues consume oldest-first and stamp
 * `stock_movements.cogs_amount` so COGS reports read real layer cost,
 * not a stale average.
 */

export async function ensureValuationTables(sql: any = SQL) {
  await sql`
    create table if not exists inventory_stock_layers (
      id text primary key,
      tenant_slug text not null,
      product_sku text not null,
      warehouse_id text,
      received_qty numeric not null default 0,
      remaining_qty numeric not null default 0,
      unit_cost numeric not null default 0,
      reference_id text,
      created_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists isl_fifo_idx on inventory_stock_layers (tenant_slug, product_sku, warehouse_id, created_at) where remaining_qty > 0`;
  await sql`alter table if exists stock_movements add column if not exists cogs_amount numeric`;
}

const methodCache = new Map<string, { method: string; at: number }>();

/** Tenant's valuation method — cached 60s; defaults to moving_average. */
export async function getValuationMethod(tenantSlug: string): Promise<"fifo" | "moving_average"> {
  const hit = methodCache.get(tenantSlug);
  if (hit && Date.now() - hit.at < 60_000) return hit.method as any;
  let method = "moving_average";
  try {
    const { rows } = await db.query<any>(
      `select settings->'inventory'->>'valuationMethod' as m from tenants where slug = $1`,
      [tenantSlug]
    );
    if (rows[0]?.m === "fifo") method = "fifo";
  } catch { /* settings shape varies */ }
  methodCache.set(tenantSlug, { method, at: Date.now() });
  return method as any;
}

/** Record a received layer (positive movement). */
export async function fifoLayerIn(input: {
  tenantSlug: string;
  productSku: string;
  warehouseId?: string | null;
  quantity: number;
  unitCost: number;
  referenceId?: string;
}) {
  const sql = SQL;
  await ensureValuationTables(sql);
  await sql`
    insert into inventory_stock_layers
      (id, tenant_slug, product_sku, warehouse_id, received_qty, remaining_qty, unit_cost, reference_id)
    values (${`lyr_${randomUUID().slice(0, 12)}`}, ${input.tenantSlug}, ${input.productSku},
            ${input.warehouseId ?? null}, ${input.quantity}, ${input.quantity},
            ${input.unitCost}, ${input.referenceId ?? null})
  `;
}

/** Consume layers oldest-first; returns the COGS for the issued qty.
 *  Short stock consumes what exists — caller's oversell guard owns
 *  whether the movement should have been allowed. */
export async function fifoLayerOut(input: {
  tenantSlug: string;
  productSku: string;
  warehouseId?: string | null;
  quantity: number;
  movementId: string;
}): Promise<number> {
  const sql = SQL;
  await ensureValuationTables(sql);
  const layers = (await sql`
    select * from inventory_stock_layers
    where tenant_slug = ${input.tenantSlug} and product_sku = ${input.productSku}
      and remaining_qty > 0
      ${input.warehouseId ? sql`and warehouse_id = ${input.warehouseId}` : sql``}
    order by created_at, id
  `) as any[];

  let remaining = input.quantity;
  let cogs = 0;
  for (const layer of layers) {
    if (remaining <= 0) break;
    const take = Math.min(Number(layer.remaining_qty), remaining);
    cogs += take * Number(layer.unit_cost);
    remaining -= take;
    await sql`
      update inventory_stock_layers
      set remaining_qty = remaining_qty - ${take}
      where id = ${layer.id}
    `;
  }
  // Uncovered remainder prices at zero rather than guessing — the
  // oversell guard upstream decides if this state should exist.
  await sql`
    update stock_movements set cogs_amount = ${cogs} where id = ${input.movementId}
  `;
  return cogs;
}

/** FIFO valuation report — layers on hand per SKU/warehouse. */
export async function fifoValuation(tenantSlug: string) {
  const sql = SQL;
  await ensureValuationTables(sql);
  return (await sql`
    select product_sku, warehouse_id,
           sum(remaining_qty) as on_hand,
           sum(remaining_qty * unit_cost) as value
    from inventory_stock_layers
    where tenant_slug = ${tenantSlug} and remaining_qty > 0
    group by product_sku, warehouse_id
    order by product_sku
  `) as any[];
}
