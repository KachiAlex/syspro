import { sql as SQL } from "../sql-client";
import { ensureOnce } from "@/lib/ensure-once";

export type TrackingMode = "none" | "serial" | "batch";

export interface SerialRecord {
  id: string;
  sku: string;
  serialNo: string;
  warehouseId: string | null;
  status: "in_stock" | "issued" | "scrapped" | "returned";
  receivedMovementId: string | null;
  issuedMovementId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LotStockRecord {
  id: string;
  sku: string;
  lotNo: string;
  warehouseId: string;
  qtyOnHand: number;
  expiryDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MovementTracking {
  lotNo?: string | null;
  serialNos?: string[];
  expiryDate?: string | null;
}

export function ensureLotTrackingTables(...args: Parameters<typeof ensureLotTrackingTablesRun>) {
  return ensureOnce("inventory/lot-tracking:ensureLotTrackingTables", () => ensureLotTrackingTablesRun(...args));
}

async function ensureLotTrackingTablesRun(sql = SQL) {
  await sql`
    create table if not exists inventory_serials (
      id text primary key,
      tenant_slug text not null,
      sku text not null,
      serial_no text not null,
      warehouse_id text,
      status text not null default 'in_stock',
      received_movement_id text,
      issued_movement_id text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (tenant_slug, sku, serial_no)
    )
  `;
  await sql`
    create table if not exists inventory_lot_stock (
      id text primary key,
      tenant_slug text not null,
      sku text not null,
      lot_no text not null,
      warehouse_id text not null,
      qty_on_hand numeric(14,4) not null default 0,
      expiry_date date,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (tenant_slug, sku, lot_no, warehouse_id)
    )
  `;
  await sql`alter table if exists stock_movements add column if not exists lot_no text`;
  await sql`alter table if exists stock_movements add column if not exists serial_nos jsonb`;
}

export async function getProductTracking(tenantSlug: string, sku: string): Promise<TrackingMode> {
  const sql = SQL;
  const rows = (await sql`
    select tracking from inventory_products where tenant_slug = ${tenantSlug} and sku = ${sku} limit 1
  `) as any[];
  const t = rows[0]?.tracking;
  return t === "serial" || t === "batch" ? t : "none";
}

export async function setProductTracking(
  tenantSlug: string,
  sku: string,
  tracking: TrackingMode
): Promise<void> {
  const sql = SQL;
  await ensureLotTrackingTables(sql);
  const existing = (await sql`
    select id from inventory_products where tenant_slug = ${tenantSlug} and sku = ${sku} limit 1
  `) as any[];
  if (!existing[0]) throw new Error(`Product ${sku} not found`);
  if (tracking !== "serial") {
    const held = (await sql`
      select count(*)::int as n from inventory_serials
      where tenant_slug = ${tenantSlug} and sku = ${sku} and status = 'in_stock'
    `) as any[];
    if (held[0]?.n > 0) {
      throw new Error(`Cannot change tracking: ${held[0].n} serial(s) still in stock for ${sku}`);
    }
  }
  await sql`
    update inventory_products set tracking = ${tracking}
    where tenant_slug = ${tenantSlug} and sku = ${sku}
  `;
}

// ---------------------------------------------------------------------------
// Validation — pure checks, run BEFORE the movement row is inserted
// ---------------------------------------------------------------------------

export async function validateMovementTracking(
  tenantSlug: string,
  movement: {
    productSku: string;
    movementType: string;
    quantity: number;
    warehouseId?: string;
  },
  tracking: MovementTracking
): Promise<void> {
  const sql = SQL;
  await ensureLotTrackingTables(sql);
  const mode = await getProductTracking(tenantSlug, movement.productSku);
  const qty = Math.abs(movement.quantity);
  const negative =
    movement.quantity < 0 ||
    ["sale", "work_order_issue"].includes(movement.movementType) ||
    (movement.movementType === "adjustment" && movement.quantity < 0);
  const transfer = movement.movementType === "transfer";

  if (mode === "serial") {
    const serials = tracking.serialNos ?? [];
    if (serials.length !== qty) {
      throw new Error(
        `Serial-tracked item ${movement.productSku}: ${qty} unit(s) require exactly ${qty} serial number(s), got ${serials.length}`
      );
    }
    if (new Set(serials).size !== serials.length) {
      throw new Error(`Duplicate serial numbers supplied for ${movement.productSku}`);
    }
    if (transfer) {
      // Availability is asserted up-front by transferStock; the serials stay
      // in_stock at the source until relocateSerials runs after both legs.
    } else if (negative) {
      await assertSerialsAvailable(
        tenantSlug,
        movement.productSku,
        serials,
        movement.warehouseId ?? null
      );
    } else {
      // receipt side: reject serials already in stock anywhere
      const existing = (await sql`
        select serial_no, status from inventory_serials
        where tenant_slug = ${tenantSlug} and sku = ${movement.productSku}
          and serial_no = any(${serials})
      `) as any[];
      const inStock = existing.filter((r) => r.status === "in_stock");
      if (inStock.length > 0) {
        throw new Error(
          `Serial number(s) already in stock: ${inStock.map((r) => r.serial_no).join(", ")}`
        );
      }
    }
  } else if (mode === "batch") {
    if (!tracking.lotNo) {
      throw new Error(`Batch-tracked item ${movement.productSku} requires a lot/batch number`);
    }
    if (negative && movement.warehouseId) {
      const rows = (await sql`
        select qty_on_hand from inventory_lot_stock
        where tenant_slug = ${tenantSlug} and sku = ${movement.productSku}
          and lot_no = ${tracking.lotNo} and warehouse_id = ${movement.warehouseId}
      `) as any[];
      const onHand = Number(rows[0]?.qty_on_hand ?? 0);
      if (onHand < qty) {
        throw new Error(
          `Insufficient stock in lot ${tracking.lotNo}: ${onHand} available, ${qty} requested`
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Commit — state mutations, run AFTER the movement row is inserted
// ---------------------------------------------------------------------------

export async function commitMovementTracking(
  tenantSlug: string,
  movementId: string,
  movement: {
    productSku: string;
    movementType: string;
    quantity: number;
    warehouseId?: string;
  },
  tracking: MovementTracking
): Promise<void> {
  const sql = SQL;
  const mode = await getProductTracking(tenantSlug, movement.productSku);
  const qty = Math.abs(movement.quantity);
  const serials = tracking.serialNos ?? [];
  const now = new Date().toISOString();
  const warehouseId = movement.warehouseId ?? null;
  const negative =
    movement.quantity < 0 ||
    ["sale", "work_order_issue"].includes(movement.movementType) ||
    (movement.movementType === "adjustment" && movement.quantity < 0);
  const transfer = movement.movementType === "transfer";

  if (mode === "serial" && serials.length > 0) {
    if (transfer) {
      // Serial relocation between warehouses is handled atomically by
      // relocateSerials() in transferStock — the movement rows only carry
      // serial_nos for the audit trail.
      return;
    }
    if (negative) {
      for (const serialNo of serials) {
        await sql`
          update inventory_serials
          set status = 'issued', issued_movement_id = ${movementId}, updated_at = ${now}
          where tenant_slug = ${tenantSlug} and sku = ${movement.productSku}
            and serial_no = ${serialNo} and status = 'in_stock'
        `;
      }
    } else {
      for (const serialNo of serials) {
        await sql`
          insert into inventory_serials (
            id, tenant_slug, sku, serial_no, warehouse_id, status, received_movement_id, created_at, updated_at
          ) values (
            ${`sr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`},
            ${tenantSlug}, ${movement.productSku}, ${serialNo}, ${warehouseId},
            'in_stock', ${movementId}, ${now}, ${now}
          )
          on conflict (tenant_slug, sku, serial_no)
          do update set
            status = 'in_stock',
            warehouse_id = ${warehouseId},
            received_movement_id = ${movementId},
            issued_movement_id = null,
            updated_at = ${now}
        `;
      }
    }
  } else if (mode === "batch" && tracking.lotNo && warehouseId) {
    const signed = transfer
      ? movement.quantity
      : negative
        ? -qty
        : qty;
    await sql`
      insert into inventory_lot_stock (
        id, tenant_slug, sku, lot_no, warehouse_id, qty_on_hand, expiry_date, created_at, updated_at
      ) values (
        ${`lt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`},
        ${tenantSlug}, ${movement.productSku}, ${tracking.lotNo}, ${warehouseId},
        ${signed}, ${tracking.expiryDate ?? null}, ${now}, ${now}
      )
      on conflict (tenant_slug, sku, lot_no, warehouse_id)
      do update set
        qty_on_hand = inventory_lot_stock.qty_on_hand + ${signed},
        expiry_date = coalesce(${tracking.expiryDate ?? null}, inventory_lot_stock.expiry_date),
        updated_at = ${now}
    `;
  }
}

export async function assertSerialsAvailable(
  tenantSlug: string,
  sku: string,
  serialNos: string[],
  warehouseId: string | null
): Promise<void> {
  const sql = SQL;
  const rows = (await sql`
    select serial_no, status, warehouse_id from inventory_serials
    where tenant_slug = ${tenantSlug} and sku = ${sku}
      and serial_no = any(${serialNos})
  `) as any[];
  const bySerial = new Map(rows.map((r) => [r.serial_no, r]));
  const missing = serialNos.filter((s) => !bySerial.has(s));
  if (missing.length > 0) {
    throw new Error(`Unknown serial number(s) for ${sku}: ${missing.join(", ")}`);
  }
  const unavailable = serialNos.filter((s) => {
    const r = bySerial.get(s)!;
    if (r.status !== "in_stock") return true;
    if (warehouseId && r.warehouse_id && r.warehouse_id !== warehouseId) return true;
    return false;
  });
  if (unavailable.length > 0) {
    throw new Error(
      `Serial number(s) not available at this warehouse: ${unavailable.join(", ")}`
    );
  }
}

export async function relocateSerials(
  tenantSlug: string,
  sku: string,
  serialNos: string[],
  toWarehouseId: string
): Promise<void> {
  const sql = SQL;
  const now = new Date().toISOString();
  await sql`
    update inventory_serials
    set warehouse_id = ${toWarehouseId}, updated_at = ${now}
    where tenant_slug = ${tenantSlug} and sku = ${sku}
      and serial_no = any(${serialNos}) and status = 'in_stock'
  `;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listSerials(
  tenantSlug: string,
  opts: { sku?: string; status?: string; warehouseId?: string; limit?: number } = {}
): Promise<SerialRecord[]> {
  const sql = SQL;
  await ensureLotTrackingTables(sql);
  const limit = Math.min(opts.limit ?? 200, 1000);
  const rows = (await sql`
    select * from inventory_serials
    where tenant_slug = ${tenantSlug}
      and (${opts.sku ?? null}::text is null or sku = ${opts.sku ?? null})
      and (${opts.status ?? null}::text is null or status = ${opts.status ?? null})
      and (${opts.warehouseId ?? null}::text is null or warehouse_id = ${opts.warehouseId ?? null})
    order by updated_at desc limit ${limit}
  `) as any[];
  return rows.map(normalizeSerial);
}

export async function traceSerial(
  tenantSlug: string,
  sku: string,
  serialNo: string
): Promise<{ serial: SerialRecord | null; movements: any[] }> {
  const sql = SQL;
  await ensureLotTrackingTables(sql);
  const serial = (await sql`
    select * from inventory_serials
    where tenant_slug = ${tenantSlug} and sku = ${sku} and serial_no = ${serialNo}
  `) as any[];
  const movements = (await sql`
    select id, movement_type, quantity, warehouse_id, reference_type, reference_id, created_at
    from stock_movements
    where tenant_slug = ${tenantSlug} and product_sku = ${sku}
      and serial_nos @> ${JSON.stringify([serialNo])}::jsonb
    order by created_at asc
  `) as any[];
  return { serial: serial[0] ? normalizeSerial(serial[0]) : null, movements };
}

export async function lotStock(
  tenantSlug: string,
  opts: { sku?: string; warehouseId?: string } = {}
): Promise<LotStockRecord[]> {
  const sql = SQL;
  await ensureLotTrackingTables(sql);
  const rows = (await sql`
    select * from inventory_lot_stock
    where tenant_slug = ${tenantSlug}
      and (${opts.sku ?? null}::text is null or sku = ${opts.sku ?? null})
      and (${opts.warehouseId ?? null}::text is null or warehouse_id = ${opts.warehouseId ?? null})
      and qty_on_hand <> 0
    order by expiry_date asc nulls last, sku, lot_no
  `) as any[];
  return rows.map(normalizeLot);
}

export async function expiringLots(
  tenantSlug: string,
  withinDays = 30
): Promise<LotStockRecord[]> {
  const sql = SQL;
  await ensureLotTrackingTables(sql);
  const rows = (await sql`
    select * from inventory_lot_stock
    where tenant_slug = ${tenantSlug}
      and qty_on_hand > 0
      and expiry_date is not null
      and expiry_date <= current_date + ${withinDays}::int
    order by expiry_date asc
  `) as any[];
  return rows.map(normalizeLot);
}

function normalizeSerial(r: any): SerialRecord {
  return {
    id: r.id,
    sku: r.sku,
    serialNo: r.serial_no,
    warehouseId: r.warehouse_id,
    status: r.status,
    receivedMovementId: r.received_movement_id,
    issuedMovementId: r.issued_movement_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function normalizeLot(r: any): LotStockRecord {
  return {
    id: r.id,
    sku: r.sku,
    lotNo: r.lot_no,
    warehouseId: r.warehouse_id,
    qtyOnHand: Number(r.qty_on_hand),
    expiryDate: r.expiry_date
      ? r.expiry_date instanceof Date
        ? `${r.expiry_date.getFullYear()}-${String(r.expiry_date.getMonth() + 1).padStart(2, "0")}-${String(r.expiry_date.getDate()).padStart(2, "0")}`
        : String(r.expiry_date).slice(0, 10)
      : null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
