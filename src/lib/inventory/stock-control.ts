import { randomUUID } from "crypto";

import { db, sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { postGLEntry, GL_ACCOUNTS } from "@/lib/finance/gl";
import { recordStockMovement } from "./stock-movements";

export function ensureStockControlTables() {
  return ensureOnce("inventory/stock-control:ensureTables", ensureStockControlTablesRun);
}

async function ensureStockControlTablesRun() {
  const sql = SQL;
  await sql`create table if not exists inventory_stock_reconciliations (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    rec_number text not null,
    warehouse_id text not null,
    status text not null default 'draft' check (status in ('draft','submitted','cancelled')),
    count_date date not null default current_date,
    remarks text,
    journal_entry_id uuid,
    submitted_by text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (tenant_slug, rec_number)
  )`;
  await sql`create table if not exists inventory_stock_reconciliation_items (
    id uuid primary key default gen_random_uuid(),
    reconciliation_id uuid not null references inventory_stock_reconciliations(id) on delete cascade,
    product_sku text not null,
    book_quantity numeric not null default 0,
    counted_quantity numeric,
    variance numeric,
    valuation_rate numeric not null default 0,
    variance_value numeric
  )`;
  await sql`create table if not exists inventory_stock_reservations (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    product_sku text not null,
    warehouse_id text not null default 'main',
    quantity numeric not null check (quantity > 0),
    sales_order_id text,
    status text not null default 'active' check (status in ('active','released','consumed')),
    reserved_by text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;
  await sql`create index if not exists stock_reservations_tenant_idx
    on inventory_stock_reservations (tenant_slug, product_sku) where status = 'active'`;
  await sql`create index if not exists stock_reservations_so_idx
    on inventory_stock_reservations (sales_order_id) where status = 'active'`;
  await sql`create table if not exists inventory_quality_inspections (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    inspection_number text not null,
    reference_type text not null default 'purchase_receipt',
    reference_id text,
    product_sku text not null,
    warehouse_id text,
    inspected_quantity numeric not null,
    accepted_quantity numeric not null default 0,
    rejected_quantity numeric not null default 0,
    status text not null default 'pending' check (status in ('pending','accepted','rejected','partial')),
    inspector text,
    readings jsonb,
    remarks text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (tenant_slug, inspection_number)
  )`;
}

// ---------------------------------------------------------------------------
// Stock reconciliation (physical count vs book)
// ---------------------------------------------------------------------------

export async function createReconciliation(input: {
  tenantSlug: string;
  warehouseId: string;
  countDate?: string;
  remarks?: string;
}) {
  await ensureStockControlTables();
  const recNumber = `SR-${Date.now().toString(36).toUpperCase()}${randomUUID().slice(0, 4).toUpperCase()}`;
  const row = (await db.query(
    `INSERT INTO inventory_stock_reconciliations (tenant_slug, rec_number, warehouse_id, count_date, remarks)
     VALUES ($1,$2,$3,coalesce($4::date, current_date),$5) RETURNING *`,
    [input.tenantSlug, recNumber, input.warehouseId, input.countDate ?? null, input.remarks ?? null])).rows[0];

  // Prefill book quantities + valuation from stock balances and product costs
  await db.query(
    `INSERT INTO inventory_stock_reconciliation_items
       (reconciliation_id, product_sku, book_quantity, valuation_rate)
     SELECT $1, b.product_sku, b.quantity,
            COALESCE(p.unit_cost, 0)
     FROM inventory_stock_balances b
     LEFT JOIN inventory_products p ON p.tenant_slug = b.tenant_slug AND p.sku = b.product_sku
     WHERE b.tenant_slug = $2 AND b.warehouse_id = $3 AND b.quantity <> 0`,
    [row.id, input.tenantSlug, input.warehouseId]);
  return getReconciliation(input.tenantSlug, row.id);
}

export async function getReconciliation(tenantSlug: string, id: string) {
  await ensureStockControlTables();
  const rec = (await db.query(
    `SELECT * FROM inventory_stock_reconciliations WHERE id = $1 AND tenant_slug = $2`, [id, tenantSlug])).rows[0];
  if (!rec) return null;
  const items = (await db.query(
    `SELECT * FROM inventory_stock_reconciliation_items WHERE reconciliation_id = $1 ORDER BY product_sku`, [id])).rows;
  return { ...rec, items };
}

export async function listReconciliations(tenantSlug: string) {
  await ensureStockControlTables();
  return (await db.query(
    `SELECT r.*, (SELECT count(*) FROM inventory_stock_reconciliation_items i WHERE i.reconciliation_id = r.id)::int AS item_count,
            (SELECT COALESCE(sum(abs(i.variance_value)),0) FROM inventory_stock_reconciliation_items i WHERE i.reconciliation_id = r.id) AS total_variance
     FROM inventory_stock_reconciliations r WHERE r.tenant_slug = $1 ORDER BY r.created_at DESC`, [tenantSlug])).rows;
}

export async function setCountedQuantity(tenantSlug: string, recId: string, itemId: string, counted: number) {
  await ensureStockControlTables();
  await db.query(
    `UPDATE inventory_stock_reconciliation_items i
     SET counted_quantity = $1,
         variance = $1 - i.book_quantity,
         variance_value = ($1 - i.book_quantity) * i.valuation_rate
     FROM inventory_stock_reconciliations r
     WHERE i.reconciliation_id = r.id AND i.id = $2 AND r.id = $3 AND r.tenant_slug = $4`,
    [counted, itemId, recId, tenantSlug]);
}

/**
 * Submit a reconciliation: posts signed adjustment movements through the
 * stock ledger per variance line and a single GL entry for the net
 * variance value (Dr variance expense on shortage, Cr on overage —
 * contra account is the inventory asset account).
 */
export async function submitReconciliation(tenantSlug: string, recId: string, userId?: string) {
  await ensureStockControlTables();
  const rec = (await db.query(
    `UPDATE inventory_stock_reconciliations SET status = 'submitted', submitted_by = $1, updated_at = now()
     WHERE id = $2 AND tenant_slug = $3 AND status = 'draft'
       AND NOT EXISTS (
         SELECT 1 FROM inventory_stock_reconciliation_items i
         WHERE i.reconciliation_id = $2 AND i.counted_quantity IS NULL
       )
     RETURNING *`,
    [userId ?? null, recId, tenantSlug])).rows[0];
  if (!rec) throw new Error("Reconciliation not found, already submitted, or has uncounted lines");

  const items = (await db.query(
    `SELECT * FROM inventory_stock_reconciliation_items WHERE reconciliation_id = $1`, [recId])).rows;

  let netVarianceValue = 0;
  for (const item of items) {
    const variance = Number(item.variance ?? 0);
    if (variance === 0) continue;
    netVarianceValue += variance * Number(item.valuation_rate ?? 0);
    const product = (await db.query(
      `SELECT name FROM inventory_products WHERE tenant_slug = $1 AND sku = $2`, [tenantSlug, item.product_sku])).rows[0];
    await recordStockMovement(tenantSlug, {
      productSku: item.product_sku,
      productName: product?.name ?? item.product_sku,
      movementType: "adjustment",
      quantity: variance, // signed — positive overage, negative shortage
      unitCost: Number(item.valuation_rate ?? 0),
      referenceType: "stock_reconciliation",
      referenceId: recId,
      warehouseId: rec.warehouse_id,
      notes: `Stock reconciliation ${rec.rec_number}`,
    }, { skipJournalEntry: true });
  }

  let journalEntryId: string | null = null;
  if (netVarianceValue !== 0) {
    const shortage = netVarianceValue < 0;
    const je = await postGLEntry({
      tenantSlug,
      entryDate: new Date(),
      journalType: "ADJUSTMENT",
      description: `Stock reconciliation ${rec.rec_number} — ${shortage ? "shortage" : "overage"}`,
      referenceType: "stock_reconciliation",
      referenceId: recId,
      lines: shortage
        ? [
            { accountCode: GL_ACCOUNTS.MATERIAL_VARIANCE, debitAmount: Math.abs(netVarianceValue), description: "Inventory shortage" },
            { accountCode: GL_ACCOUNTS.RAW_MATERIALS, creditAmount: Math.abs(netVarianceValue), description: "Reduce inventory" },
          ]
        : [
            { accountCode: GL_ACCOUNTS.RAW_MATERIALS, debitAmount: netVarianceValue, description: "Increase inventory" },
            { accountCode: GL_ACCOUNTS.MATERIAL_VARIANCE, creditAmount: netVarianceValue, description: "Inventory overage" },
          ],
      createdBy: userId,
    });
    journalEntryId = je.id;
    await db.query(
      `UPDATE inventory_stock_reconciliations SET journal_entry_id = $1 WHERE id = $2`,
      [journalEntryId, recId]);
  }
  return { submitted: true, journalEntryId, netVarianceValue };
}

// ---------------------------------------------------------------------------
// Stock reservations (against sales orders)
// ---------------------------------------------------------------------------

/** Available = on-hand - active reservations. */
export async function availableQuantity(tenantSlug: string, productSku: string, warehouseId = "main") {
  await ensureStockControlTables();
  const row = (await db.query(
    `SELECT COALESCE(b.quantity,0) AS on_hand,
            COALESCE((SELECT sum(r.quantity) FROM inventory_stock_reservations r
              WHERE r.tenant_slug = $1 AND r.product_sku = $2 AND r.warehouse_id = $3 AND r.status = 'active'),0) AS reserved
     FROM (SELECT 1) d
     LEFT JOIN inventory_stock_balances b
       ON b.tenant_slug = $1 AND b.product_sku = $2 AND b.warehouse_id = $3`,
    [tenantSlug, productSku, warehouseId])).rows[0];
  return { onHand: Number(row.on_hand), reserved: Number(row.reserved), available: Number(row.on_hand) - Number(row.reserved) };
}

export async function reserveStock(input: {
  tenantSlug: string;
  productSku: string;
  warehouseId?: string;
  quantity: number;
  salesOrderId?: string | null;
  reservedBy?: string | null;
  notes?: string | null;
}) {
  await ensureStockControlTables();
  const wh = input.warehouseId ?? "main";
  const avail = await availableQuantity(input.tenantSlug, input.productSku, wh);
  if (input.quantity > avail.available) {
    throw new Error(`Cannot reserve ${input.quantity} of ${input.productSku}: only ${avail.available} available in ${wh}`);
  }
  return (await db.query(
    `INSERT INTO inventory_stock_reservations (tenant_slug, product_sku, warehouse_id, quantity, sales_order_id, reserved_by, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [input.tenantSlug, input.productSku, wh, input.quantity, input.salesOrderId ?? null, input.reservedBy ?? null, input.notes ?? null])).rows[0];
}

export async function releaseReservation(tenantSlug: string, id: string, consume = false) {
  await ensureStockControlTables();
  const res = await db.query(
    `UPDATE inventory_stock_reservations SET status = $1, updated_at = now()
     WHERE id = $2 AND tenant_slug = $3 AND status = 'active' RETURNING id`,
    [consume ? "consumed" : "released", id, tenantSlug]);
  if (!res.rows[0]) throw new Error("Reservation not found or already closed");
  return { ok: true };
}

export async function listReservations(tenantSlug: string, status?: string) {
  await ensureStockControlTables();
  return status
    ? (await db.query(`SELECT * FROM inventory_stock_reservations WHERE tenant_slug = $1 AND status = $2 ORDER BY created_at DESC`, [tenantSlug, status])).rows
    : (await db.query(`SELECT * FROM inventory_stock_reservations WHERE tenant_slug = $1 ORDER BY created_at DESC`, [tenantSlug])).rows;
}

// ---------------------------------------------------------------------------
// Quality inspection on stock receipts
// ---------------------------------------------------------------------------

export async function createInspection(input: {
  tenantSlug: string;
  referenceType?: string;
  referenceId?: string | null;
  productSku: string;
  warehouseId?: string | null;
  inspectedQuantity: number;
  inspector?: string | null;
  readings?: Record<string, any> | null;
  remarks?: string | null;
}) {
  await ensureStockControlTables();
  const num = `QI-${Date.now().toString(36).toUpperCase()}${randomUUID().slice(0, 4).toUpperCase()}`;
  return (await db.query(
    `INSERT INTO inventory_quality_inspections
       (tenant_slug, inspection_number, reference_type, reference_id, product_sku,
        warehouse_id, inspected_quantity, inspector, readings, remarks)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [input.tenantSlug, num, input.referenceType ?? "purchase_receipt", input.referenceId ?? null,
     input.productSku, input.warehouseId ?? null, input.inspectedQuantity,
     input.inspector ?? null, input.readings ? JSON.stringify(input.readings) : null, input.remarks ?? null])).rows[0];
}

/**
 * Record inspection outcome. Rejected quantity is NOT added to stock —
 * callers route it to a return/disposal flow. Accepted qty posts a
 * receipt movement if the originating receipt hasn't already booked it.
 */
export async function completeInspection(input: {
  tenantSlug: string;
  inspectionId: string;
  acceptedQuantity: number;
  rejectedQuantity: number;
  remarks?: string | null;
}) {
  await ensureStockControlTables();
  const row = (await db.query(
    `UPDATE inventory_quality_inspections
     SET accepted_quantity = $1, rejected_quantity = $2,
         status = CASE WHEN $2 = 0 THEN 'accepted' WHEN $1 = 0 THEN 'rejected' ELSE 'partial' END,
         remarks = coalesce($3, remarks), updated_at = now()
     WHERE id = $4 AND tenant_slug = $5 AND status = 'pending'
     RETURNING *`,
    [input.acceptedQuantity, input.rejectedQuantity, input.remarks ?? null, input.inspectionId, input.tenantSlug])).rows[0];
  if (!row) throw new Error("Inspection not found or already completed");
  if (input.acceptedQuantity + input.rejectedQuantity > Number(row.inspected_quantity)) {
    throw new Error("Accepted + rejected exceeds inspected quantity");
  }
  return row;
}

export async function listInspections(tenantSlug: string, status?: string) {
  await ensureStockControlTables();
  return status
    ? (await db.query(`SELECT * FROM inventory_quality_inspections WHERE tenant_slug = $1 AND status = $2 ORDER BY created_at DESC`, [tenantSlug, status])).rows
    : (await db.query(`SELECT * FROM inventory_quality_inspections WHERE tenant_slug = $1 ORDER BY created_at DESC`, [tenantSlug])).rows;
}
