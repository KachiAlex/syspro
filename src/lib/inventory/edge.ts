import { db } from "@/lib/sql-client";

// Inventory edge features: packing slips, putaway rules, party item codes.

// ── Packing slips ──────────────────────────────────────────────────────────

async function nextSlipNumber(tenantSlug: string) {
  const r = (await db.query<any>(
    `select count(*) + 1 as n from packing_slips where tenant_slug = $1`,
    [tenantSlug]
  )).rows[0];
  return `PS-${String(r.n).padStart(5, "0")}`;
}

export async function listPackingSlips(tenantSlug: string, salesOrderId?: string) {
  const conds = ["tenant_slug = $1"];
  const params: any[] = [tenantSlug];
  if (salesOrderId) { params.push(salesOrderId); conds.push(`sales_order_id = $${params.length}`); }
  return (await db.query<any>(
    `select * from packing_slips where ${conds.join(" and ")}
     order by created_at desc`, params
  )).rows;
}

export async function createPackingSlip(input: {
  tenantSlug: string; salesOrderId?: string; deliveryReference?: string;
  fromCaseNo?: number; toCaseNo?: number;
  items?: { sku: string; name?: string; qty: number }[];
  grossWeight?: number; netWeight?: number; createdBy?: string;
}) {
  const num = await nextSlipNumber(input.tenantSlug);
  return (await db.query<any>(
    `insert into packing_slips (tenant_slug, slip_number, sales_order_id,
       delivery_reference, from_case_no, to_case_no, items, gross_weight,
       net_weight, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
    [input.tenantSlug, num, input.salesOrderId ?? null,
     input.deliveryReference ?? null, input.fromCaseNo ?? 1,
     input.toCaseNo ?? null, JSON.stringify(input.items ?? []),
     input.grossWeight ?? null, input.netWeight ?? null,
     input.createdBy ?? null]
  )).rows[0];
}

export async function setPackingSlipStatus(tenantSlug: string, id: string, status: "submitted" | "cancelled") {
  return (await db.query<any>(
    `update packing_slips set status = $3
     where id = $1 and tenant_slug = $2 and status = 'draft' returning *`,
    [id, tenantSlug, status]
  )).rows[0];
}

// ── Putaway rules ──────────────────────────────────────────────────────────

export async function listPutawayRules(tenantSlug: string, sku?: string) {
  const conds = ["r.tenant_slug = $1"];
  const params: any[] = [tenantSlug];
  if (sku) { params.push(sku); conds.push(`r.product_sku = $${params.length}`); }
  return (await db.query<any>(
    `select r.*, w.name as warehouse_name from putaway_rules r
     left join inventory_warehouses w on w.id::text = r.warehouse_id::text
     where ${conds.join(" and ")} order by r.product_sku, r.priority`, params
  )).rows;
}

export async function upsertPutawayRule(input: {
  tenantSlug: string; id?: string; productSku: string; warehouseId: string;
  bin?: string; capacity?: number; priority?: number; isActive?: boolean;
}) {
  if (input.id) {
    return (await db.query<any>(
      `update putaway_rules set product_sku=$1, warehouse_id=$2, bin=$3,
         capacity=$4, priority=$5, is_active=$6
       where id=$7 and tenant_slug=$8 returning *`,
      [input.productSku, input.warehouseId, input.bin ?? null,
       input.capacity ?? 0, input.priority ?? 1, input.isActive ?? true,
       input.id, input.tenantSlug]
    )).rows[0];
  }
  return (await db.query<any>(
    `insert into putaway_rules (tenant_slug, product_sku, warehouse_id, bin,
       capacity, priority)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [input.tenantSlug, input.productSku, input.warehouseId, input.bin ?? null,
     input.capacity ?? 0, input.priority ?? 1]
  )).rows[0];
}

/** Suggest the warehouse a received SKU should be put away to. */
export async function suggestPutaway(tenantSlug: string, sku: string, qty: number) {
  return (await db.query<any>(
    `select r.*, w.name as warehouse_name,
            coalesce(b.quantity, 0) as current_qty
     from putaway_rules r
     left join inventory_warehouses w on w.id::text = r.warehouse_id::text
     left join inventory_stock_balances b
       on b.product_sku = r.product_sku and b.warehouse_id::text = r.warehouse_id::text
     where r.tenant_slug = $1 and r.product_sku = $2 and r.is_active
       and (r.capacity = 0 or coalesce(b.quantity,0) + $3 <= r.capacity)
     order by r.priority asc limit 3`,
    [tenantSlug, sku, qty]
  )).rows;
}

// ── Party item codes ───────────────────────────────────────────────────────

export async function listPartyItemCodes(tenantSlug: string, sku?: string, partyType?: string) {
  const conds = ["tenant_slug = $1"];
  const params: any[] = [tenantSlug];
  if (sku) { params.push(sku); conds.push(`product_sku = $${params.length}`); }
  if (partyType) { params.push(partyType); conds.push(`party_type = $${params.length}`); }
  return (await db.query<any>(
    `select * from item_party_codes where ${conds.join(" and ")}
     order by product_sku`, params
  )).rows;
}

export async function upsertPartyItemCode(input: {
  tenantSlug: string; productSku: string; partyType: "customer" | "manufacturer" | "supplier";
  partyCode: string; partyId?: string; partyName?: string;
}) {
  return (await db.query<any>(
    `insert into item_party_codes (tenant_slug, product_sku, party_type,
       party_code, party_id, party_name)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (tenant_slug, product_sku, party_type, party_code)
     do update set party_id = excluded.party_id, party_name = excluded.party_name
     returning *`,
    [input.tenantSlug, input.productSku, input.partyType, input.partyCode,
     input.partyId ?? null, input.partyName ?? null]
  )).rows[0];
}

/** Resolve a customer's/manufacturer's code back to our SKU. */
export async function resolvePartyCode(tenantSlug: string, partyCode: string, partyType?: string) {
  return (await db.query<any>(
    `select * from item_party_codes where tenant_slug = $1 and party_code = $2
     ${partyType ? "and party_type = $3" : ""} limit 1`,
    partyType ? [tenantSlug, partyCode, partyType] : [tenantSlug, partyCode]
  )).rows[0] ?? null;
}
