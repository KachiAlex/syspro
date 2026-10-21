import { randomUUID } from "crypto";

import { db, sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { createPurchaseOrder } from "@/lib/finance/purchase-orders";
import { createWorkOrder } from "@/lib/manufacturing/work-orders";
import { writeFinanceEvent } from "@/lib/finance/events";

export function ensureMaterialRequestTables() {
  return ensureOnce("inventory/mr:ensureTables", ensureMaterialRequestTablesRun);
}

async function ensureMaterialRequestTablesRun() {
  const sql = SQL;
  await sql`create table if not exists material_requests (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    mr_number text not null,
    request_type text not null
      check (request_type in ('purchase','manufacture','transfer')),
    status text not null default 'draft'
      check (status in ('draft','open','partially_ordered','ordered','cancelled')),
    requested_by text,
    required_by date,
    notes text,
    metadata jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;
  await sql`create unique index if not exists material_requests_tenant_number_uq
    on material_requests (tenant_slug, mr_number)`;
  await sql`create table if not exists material_request_items (
    id uuid primary key default gen_random_uuid(),
    material_request_id uuid not null references material_requests(id) on delete cascade,
    product_id text not null,
    product_name text,
    description text,
    quantity numeric not null,
    ordered_quantity numeric not null default 0,
    uom text,
    warehouse_id text
  )`;
  await sql`create index if not exists material_request_items_mr_idx
    on material_request_items (material_request_id)`;
  await sql`create table if not exists inventory_reorder_rules (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    product_sku text not null,
    warehouse_id text not null default 'main',
    reorder_level numeric not null,
    reorder_quantity numeric not null,
    request_type text not null default 'purchase'
      check (request_type in ('purchase','manufacture','transfer')),
    enabled boolean not null default true,
    last_triggered_at timestamptz,
    created_at timestamptz not null default now(),
    unique (tenant_slug, product_sku, warehouse_id)
  )`;
  await sql`create index if not exists inventory_reorder_rules_tenant_idx
    on inventory_reorder_rules (tenant_slug) where enabled`;
  await sql`alter table if exists purchase_orders add column if not exists material_request_id uuid`;
  await sql`alter table if exists manufacturing_work_orders add column if not exists material_request_id uuid`;
}

function nextNumber() {
  return `MR-${Date.now().toString(36).toUpperCase()}${randomUUID().slice(0, 4).toUpperCase()}`;
}

export async function listMaterialRequests(tenantSlug: string, status?: string) {
  await ensureMaterialRequestTables();
  const rows = status
    ? (await db.query(
        `SELECT m.*, (SELECT count(*) FROM material_request_items i WHERE i.material_request_id = m.id)::int AS item_count
         FROM material_requests m WHERE m.tenant_slug = $1 AND m.status = $2 ORDER BY m.created_at DESC`,
        [tenantSlug, status]
      )).rows
    : (await db.query(
        `SELECT m.*, (SELECT count(*) FROM material_request_items i WHERE i.material_request_id = m.id)::int AS item_count
         FROM material_requests m WHERE m.tenant_slug = $1 ORDER BY m.created_at DESC`,
        [tenantSlug]
      )).rows;
  return rows.map(mapMr);
}

export async function getMaterialRequest(tenantSlug: string, id: string) {
  await ensureMaterialRequestTables();
  const row = (
    await db.query(`SELECT * FROM material_requests WHERE id = $1 AND tenant_slug = $2`, [id, tenantSlug])
  ).rows[0];
  if (!row) return null;
  const items = (
    await db.query(`SELECT * FROM material_request_items WHERE material_request_id = $1 ORDER BY id`, [id])
  ).rows;
  return { ...mapMr(row), items };
}

export async function createMaterialRequest(input: {
  tenantSlug: string;
  requestType: "purchase" | "manufacture" | "transfer";
  requestedBy?: string | null;
  requiredBy?: string | null;
  notes?: string | null;
  items: { productId: string; productName?: string; description?: string; quantity: number; uom?: string; warehouseId?: string }[];
}) {
  await ensureMaterialRequestTables();
  if (!input.items?.length) throw new Error("At least one item is required");
  const row = (
    await db.query(
      `INSERT INTO material_requests (tenant_slug, mr_number, request_type, requested_by, required_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [input.tenantSlug, nextNumber(), input.requestType, input.requestedBy ?? null, input.requiredBy ?? null, input.notes ?? null]
    )
  ).rows[0];
  for (const item of input.items) {
    await db.query(
      `INSERT INTO material_request_items
         (material_request_id, product_id, product_name, description, quantity, uom, warehouse_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [row.id, item.productId, item.productName ?? null, item.description ?? null, item.quantity, item.uom ?? null, item.warehouseId ?? null]
    );
  }
  return getMaterialRequest(input.tenantSlug, row.id);
}

export async function updateMrStatus(tenantSlug: string, id: string, status: "open" | "cancelled") {
  await ensureMaterialRequestTables();
  const res = await db.query(
    `UPDATE material_requests SET status = $1, updated_at = now()
     WHERE id = $2 AND tenant_slug = $3 AND status IN ('draft','open') RETURNING id`,
    [status, id, tenantSlug]
  );
  if (!res.rows[0]) throw new Error("Material request not found or already closed");
  return { ok: true };
}

/**
 * Convert an open MR into a purchase order (request_type=purchase) or a
 * manufacturing work order (request_type=manufacture). Tracks
 * ordered_quantity per item and rolls the MR to partially_ordered/ordered.
 */
export async function convertMaterialRequest(input: {
  tenantSlug: string;
  mrId: string;
  supplierId?: string | null;
  itemIds?: string[]; // subset to convert; default all unconverted
  userId?: string;
}) {
  await ensureMaterialRequestTables();
  const mr = await getMaterialRequest(input.tenantSlug, input.mrId);
  if (!mr) throw new Error("Material request not found");
  if (!["open", "partially_ordered", "draft"].includes(mr.status)) {
    throw new Error(`Cannot convert a ${mr.status} material request`);
  }

  const pending = mr.items.filter((i: any) =>
    Number(i.quantity) > Number(i.ordered_quantity) &&
    (!input.itemIds?.length || input.itemIds.includes(i.id))
  );
  if (!pending.length) throw new Error("No pending items to convert");

  let createdRef: { id: string; number: string } | null = null;

  if (mr.requestType === "purchase") {
    const today = new Date().toISOString().split("T")[0];
    const po = await createPurchaseOrder({
      tenantSlug: input.tenantSlug,
      supplierId: input.supplierId ?? null,
      orderNumber: `PO-${Date.now().toString().slice(-6)}`,
      issuedDate: today,
      dueDate: mr.requiredBy ?? today,
      currency: "NGN",
      items: pending.map((i: any) => ({
        description: i.description ?? i.product_name ?? i.product_id,
        quantity: Number(i.quantity) - Number(i.ordered_quantity),
        unitPrice: 0,
      })),
    });
    await db.query(`UPDATE purchase_orders SET material_request_id = $1 WHERE id = $2`, [mr.id, po.id]);
    createdRef = { id: po.id, number: po.orderNumber };
  } else if (mr.requestType === "manufacture") {
    const first = pending[0];
    const wo = await createWorkOrder({
      tenantSlug: input.tenantSlug,
      productSku: first.product_id,
      productName: first.product_name ?? first.description ?? first.product_id,
      quantity: Number(first.quantity) - Number(first.ordered_quantity),
      notes: `Material request ${mr.mrNumber}`,
      createdBy: input.userId,
    });
    await db.query(
      `UPDATE manufacturing_work_orders SET material_request_id = $1 WHERE id = $2 AND tenant_slug = $3`,
      [mr.id, wo.id, input.tenantSlug]
    );
    createdRef = { id: wo.id, number: (wo as any).orderNumber ?? wo.id };
  }

  for (const item of mr.requestType === "manufacture" ? [pending[0]] : pending) {
    await db.query(
      `UPDATE material_request_items SET ordered_quantity = quantity WHERE id = $1`,
      [item.id]
    );
  }

  const remaining = (
    await db.query(
      `SELECT count(*)::int AS n FROM material_request_items
       WHERE material_request_id = $1 AND quantity > ordered_quantity`,
      [mr.id]
    )
  ).rows[0].n;
  await db.query(
    `UPDATE material_requests SET status = $1, updated_at = now() WHERE id = $2`,
    [remaining > 0 ? "partially_ordered" : "ordered", mr.id]
  );

  writeFinanceEvent({
    tenantSlug: input.tenantSlug,
    eventType: "material_request_converted",
    sourceModule: "inventory",
    sourceRecordId: mr.id,
    userId: input.userId,
    metadata: { mrNumber: mr.mrNumber, requestType: mr.requestType, created: createdRef },
  }).catch(() => {});

  return { created: createdRef, status: remaining > 0 ? "partially_ordered" : "ordered" };
}

// ---------------------------------------------------------------------------
// Reorder rules
// ---------------------------------------------------------------------------

export async function listReorderRules(tenantSlug: string) {
  await ensureMaterialRequestTables();
  const rows = (
    await db.query(
      `SELECT r.*, b.quantity AS current_quantity
       FROM inventory_reorder_rules r
       LEFT JOIN inventory_stock_balances b
         ON b.tenant_slug = r.tenant_slug AND b.product_sku = r.product_sku AND b.warehouse_id = r.warehouse_id
       WHERE r.tenant_slug = $1 ORDER BY r.product_sku`,
      [tenantSlug]
    )
  ).rows;
  return rows.map((r: any) => ({
    id: r.id,
    productSku: r.product_sku,
    warehouseId: r.warehouse_id,
    reorderLevel: Number(r.reorder_level),
    reorderQuantity: Number(r.reorder_quantity),
    requestType: r.request_type,
    enabled: r.enabled,
    currentQuantity: r.current_quantity != null ? Number(r.current_quantity) : 0,
    belowLevel: (r.current_quantity != null ? Number(r.current_quantity) : 0) < Number(r.reorder_level),
    lastTriggeredAt: r.last_triggered_at,
  }));
}

export async function upsertReorderRule(input: {
  tenantSlug: string;
  productSku: string;
  warehouseId: string;
  reorderLevel: number;
  reorderQuantity: number;
  requestType?: "purchase" | "manufacture" | "transfer";
  enabled?: boolean;
}) {
  await ensureMaterialRequestTables();
  const row = (
    await db.query(
      `INSERT INTO inventory_reorder_rules
         (tenant_slug, product_sku, warehouse_id, reorder_level, reorder_quantity, request_type, enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (tenant_slug, product_sku, warehouse_id)
       DO UPDATE SET reorder_level = excluded.reorder_level,
                     reorder_quantity = excluded.reorder_quantity,
                     request_type = excluded.request_type,
                     enabled = excluded.enabled
       RETURNING *`,
      [
        input.tenantSlug,
        input.productSku,
        input.warehouseId,
        input.reorderLevel,
        input.reorderQuantity,
        input.requestType ?? "purchase",
        input.enabled ?? true,
      ]
    )
  ).rows[0];
  return row;
}

export async function deleteReorderRule(tenantSlug: string, id: string) {
  await ensureMaterialRequestTables();
  await db.query(`DELETE FROM inventory_reorder_rules WHERE id = $1 AND tenant_slug = $2`, [id, tenantSlug]);
}

/**
 * Scan enabled reorder rules against stock balances. For each SKU below its
 * reorder level, create an open material request (deduped: skips if an open
 * MR already covers the SKU). Returns the MRs created.
 */
export async function runReorderScan(tenantSlug: string) {
  await ensureMaterialRequestTables();
  const rules = (
    await db.query(
      `SELECT r.*, COALESCE(b.quantity, 0) AS current_quantity
       FROM inventory_reorder_rules r
       LEFT JOIN inventory_stock_balances b
         ON b.tenant_slug = r.tenant_slug AND b.product_sku = r.product_sku AND b.warehouse_id = r.warehouse_id
       WHERE r.tenant_slug = $1 AND r.enabled
         AND COALESCE(b.quantity, 0) < r.reorder_level`,
      [tenantSlug]
    )
  ).rows;

  const created: string[] = [];
  for (const rule of rules) {
    const existing = (
      await db.query(
        `SELECT m.id FROM material_requests m
         JOIN material_request_items i ON i.material_request_id = m.id
         WHERE m.tenant_slug = $1 AND m.status IN ('open','partially_ordered')
           AND i.product_id = $2
         LIMIT 1`,
        [tenantSlug, rule.product_sku]
      )
    ).rows[0];
    if (existing) continue;

    const mr = await createMaterialRequest({
      tenantSlug,
      requestType: rule.request_type,
      requestedBy: "reorder-engine",
      notes: `Auto-created: ${rule.product_sku} below reorder level (${Number(rule.current_quantity)} < ${Number(rule.reorder_level)})`,
      items: [{
        productId: rule.product_sku,
        quantity: Number(rule.reorder_quantity),
        warehouseId: rule.warehouse_id,
      }],
    });
    await db.query(`UPDATE material_requests SET status = 'open' WHERE id = $1`, [(mr as any).id]);
    await db.query(
      `UPDATE inventory_reorder_rules SET last_triggered_at = now() WHERE id = $1`,
      [rule.id]
    );
    created.push((mr as any).mrNumber);
  }
  return { triggered: created.length, materialRequests: created };
}

function mapMr(row: any) {
  return {
    id: row.id,
    mrNumber: row.mr_number,
    requestType: row.request_type,
    status: row.status,
    requestedBy: row.requested_by,
    requiredBy: row.required_by,
    notes: row.notes,
    itemCount: row.item_count != null ? Number(row.item_count) : undefined,
    createdAt: row.created_at,
  };
}
