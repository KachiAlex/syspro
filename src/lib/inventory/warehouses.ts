import { randomUUID } from "crypto";

import { db } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { getBranch } from "@/lib/finance/branches";

// ---------------------------------------------------------------------------
// Warehouses: stock-location master linked to branches, plus per-warehouse
// quantity/value balances derived from signed stock_movements rows.
// Canonical schema: db/migrations/20261103_inventory_warehouses.sql
// ---------------------------------------------------------------------------

export type Warehouse = {
  id: string;
  tenantSlug: string;
  code: string | null;
  name: string;
  parentWarehouseId: string | null;
  branchId: string | null;
  type: "warehouse" | "transit";
  isGroup: boolean;
  status: string;
  createdAt: string;
};

export function ensureWarehouseTables() {
  return ensureOnce("inventory/warehouses:ensure", async () => {
    await db.query(`
      create table if not exists inventory_warehouses (
        id text primary key,
        tenant_slug text not null,
        code text,
        name text not null,
        parent_warehouse_id text references inventory_warehouses(id) on delete set null,
        branch_id text references tenant_branches(id) on delete set null,
        type text not null default 'warehouse',
        is_group boolean not null default false,
        status text not null default 'active',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (tenant_slug, code)
      )
    `);
    await db.query(`alter table if exists stock_movements add column if not exists warehouse_id text`);
    await db.query(`
      create table if not exists inventory_stock_balances (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        product_sku text not null,
        warehouse_id text not null,
        quantity numeric not null default 0,
        value numeric not null default 0,
        updated_at timestamptz not null default now(),
        unique (tenant_slug, product_sku, warehouse_id)
      )
    `);
  });
}

function mapWarehouse(row: any): Warehouse {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    code: row.code ?? null,
    name: row.name,
    parentWarehouseId: row.parent_warehouse_id ?? null,
    branchId: row.branch_id ?? null,
    type: row.type ?? "warehouse",
    isGroup: Boolean(row.is_group),
    status: row.status ?? "active",
    createdAt: row.created_at,
  };
}

export async function listWarehouses(tenantSlug: string): Promise<Warehouse[]> {
  await ensureWarehouseTables();
  const rows = await db.query(
    `select * from inventory_warehouses where tenant_slug = $1 order by code, name`,
    [tenantSlug]
  );
  return rows.rows.map(mapWarehouse);
}

export async function getWarehouse(
  tenantSlug: string,
  idOrCode: string
): Promise<Warehouse | null> {
  await ensureWarehouseTables();
  const rows = await db.query(
    `select * from inventory_warehouses where tenant_slug = $1 and (id = $2 or code = $2) limit 1`,
    [tenantSlug, idOrCode]
  );
  return rows.rows[0] ? mapWarehouse(rows.rows[0]) : null;
}

export type WarehouseInput = {
  name: string;
  code?: string;
  parentWarehouseId?: string;
  branchId?: string | null;
  type?: "warehouse" | "transit";
  isGroup?: boolean;
  status?: string;
};

export async function createWarehouse(
  tenantSlug: string,
  input: WarehouseInput
): Promise<Warehouse> {
  await ensureWarehouseTables();
  const id = `wh-${randomUUID().slice(0, 8)}`;
  const code = input.code ?? id.slice(3).toUpperCase();

  let branchId: string | null = null;
  if (input.branchId) {
    const branch = await getBranch(tenantSlug, input.branchId);
    if (!branch) throw new Error(`Unknown branch "${input.branchId}"`);
    branchId = branch.id;
  }
  if (input.parentWarehouseId) {
    const parent = await getWarehouse(tenantSlug, input.parentWarehouseId);
    if (!parent) throw new Error(`Parent warehouse ${input.parentWarehouseId} not found`);
    if (!parent.isGroup) throw new Error("Parent warehouse must be a group warehouse");
    input.parentWarehouseId = parent.id;
  }

  const rows = await db.query(
    `insert into inventory_warehouses (id, tenant_slug, code, name, parent_warehouse_id, branch_id, type, is_group, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
    [
      id, tenantSlug, code, input.name, input.parentWarehouseId ?? null,
      branchId, input.isGroup ? "group" : input.type ?? "warehouse",
      input.isGroup ?? false, input.status ?? "active",
    ]
  );
  return mapWarehouse(rows.rows[0]);
}

export async function updateWarehouse(
  tenantSlug: string,
  id: string,
  updates: Partial<WarehouseInput>
): Promise<Warehouse | null> {
  await ensureWarehouseTables();
  let branchId: string | null | undefined;
  if (updates.branchId !== undefined) {
    if (updates.branchId === null || updates.branchId === "") {
      branchId = null;
    } else {
      const branch = await getBranch(tenantSlug, updates.branchId);
      if (!branch) throw new Error(`Unknown branch "${updates.branchId}"`);
      branchId = branch.id;
    }
  }
  const rows = await db.query(
    `update inventory_warehouses set
       name = coalesce($3, name),
       code = coalesce($4, code),
       parent_warehouse_id = coalesce($5, parent_warehouse_id),
       branch_id = case when $6::boolean then $7 else branch_id end,
       type = coalesce($8, type),
       is_group = coalesce($9, is_group),
       status = coalesce($10, status),
       updated_at = now()
     where id = $1 and tenant_slug = $2
     returning *`,
    [
      id, tenantSlug, updates.name ?? null, updates.code ?? null,
      updates.parentWarehouseId ?? null,
      updates.branchId !== undefined, branchId ?? null,
      updates.type ?? null, updates.isGroup ?? null, updates.status ?? null,
    ]
  );
  return rows.rows[0] ? mapWarehouse(rows.rows[0]) : null;
}

export async function deleteWarehouse(
  tenantSlug: string,
  id: string
): Promise<{ deleted: boolean; deactivated: boolean }> {
  await ensureWarehouseTables();
  const refs = await db.query(
    `select
       (select count(*) from stock_movements where tenant_slug = $2 and warehouse_id = $1) +
       (select count(*) from inventory_stock_balances where tenant_slug = $2 and warehouse_id = $1) +
       (select count(*) from inventory_warehouses where tenant_slug = $2 and parent_warehouse_id = $1) as ref_count`,
    [id, tenantSlug]
  );
  if (Number(refs.rows[0]?.ref_count ?? 0) > 0) {
    await db.query(
      `update inventory_warehouses set status = 'inactive', updated_at = now()
       where id = $1 and tenant_slug = $2`,
      [id, tenantSlug]
    );
    return { deleted: false, deactivated: true };
  }
  await db.query(`delete from inventory_warehouses where id = $1 and tenant_slug = $2`, [id, tenantSlug]);
  return { deleted: true, deactivated: false };
}

/** The tenant's default warehouse, created lazily on first use. */
export async function getOrCreateDefaultWarehouse(tenantSlug: string): Promise<Warehouse> {
  const existing = await getWarehouse(tenantSlug, "MAIN");
  if (existing) return existing;
  return createWarehouse(tenantSlug, { name: "Main Store", code: "MAIN" });
}

/**
 * Adjust a per-warehouse stock balance. `quantity` is signed: positive adds
 * stock, negative removes. Kept in step with stock_movements inserts.
 */
export async function adjustStockBalance(
  tenantSlug: string,
  productSku: string,
  warehouseId: string,
  quantity: number,
  unitCost: number
): Promise<void> {
  await ensureWarehouseTables();
  await db.query(
    `insert into inventory_stock_balances (tenant_slug, product_sku, warehouse_id, quantity, value, updated_at)
     values ($1, $2, $3, $4, $5, now())
     on conflict (tenant_slug, product_sku, warehouse_id)
     do update set quantity = inventory_stock_balances.quantity + $4,
                   value = inventory_stock_balances.value + $5,
                   updated_at = now()`,
    [tenantSlug, productSku, warehouseId, quantity, quantity * unitCost]
  );
}

export type StockBalance = {
  productSku: string;
  warehouseId: string;
  warehouseCode: string | null;
  warehouseName: string;
  branchId: string | null;
  quantity: number;
  value: number;
};

/** Per-warehouse stock position — the warehouse stock report. */
export async function stockByWarehouse(
  tenantSlug: string,
  warehouseId?: string
): Promise<StockBalance[]> {
  await ensureWarehouseTables();
  const params: any[] = [tenantSlug];
  let where = `b.tenant_slug = $1`;
  if (warehouseId) {
    params.push(warehouseId);
    where += ` and b.warehouse_id = $${params.length}`;
  }
  const rows = await db.query(
    `select b.product_sku, b.warehouse_id, w.code as warehouse_code, w.name as warehouse_name,
            w.branch_id, b.quantity, b.value
     from inventory_stock_balances b
     join inventory_warehouses w on w.id = b.warehouse_id
     where ${where} and b.quantity <> 0
     order by w.code, b.product_sku`,
    params
  );
  return rows.rows.map((r: any) => ({
    productSku: r.product_sku,
    warehouseId: r.warehouse_id,
    warehouseCode: r.warehouse_code,
    warehouseName: r.warehouse_name,
    branchId: r.branch_id,
    quantity: Number(r.quantity),
    value: Number(r.value),
  }));
}

/**
 * Move stock between warehouses. Writes two signed 'transfer' movements
 * (negative at source, positive at destination) — net-zero globally, so no
 * GL entry and no inventory_products.current_stock change.
 */
export async function transferStock(input: {
  tenantSlug: string;
  productSku: string;
  productName?: string;
  quantity: number;
  unitCost?: number;
  fromWarehouseId: string;
  toWarehouseId: string;
  referenceId?: string;
  lotNo?: string;
  serialNos?: string[];
  notes?: string;
}): Promise<{ outMovementId: string; inMovementId: string }> {
  await ensureWarehouseTables();
  if (input.quantity <= 0) throw new Error("Transfer quantity must be positive");
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new Error("Source and destination warehouses must differ");
  }

  const from = await getWarehouse(input.tenantSlug, input.fromWarehouseId);
  const to = await getWarehouse(input.tenantSlug, input.toWarehouseId);
  if (!from || !to) throw new Error("Source or destination warehouse not found");
  if (from.isGroup || to.isGroup) throw new Error("Cannot transfer to/from a group warehouse");

  // Guard against negative stock at source
  const balance = await db.query(
    `select quantity from inventory_stock_balances
     where tenant_slug = $1 and product_sku = $2 and warehouse_id = $3`,
    [input.tenantSlug, input.productSku, from.id]
  );
  const available = Number(balance.rows[0]?.quantity ?? 0);
  if (available < input.quantity) {
    throw new Error(
      `Insufficient stock at ${from.name}: ${available} available, ${input.quantity} requested`
    );
  }

  const { recordStockMovement } = await import("./stock-movements");
  const ref = input.referenceId ?? `TRF-${Date.now()}`;

  // Serial-tracked items: validate availability at the source before any
  // movement is recorded, then relocate serials after both legs complete.
  if (input.serialNos?.length) {
    const { assertSerialsAvailable } = await import("./lot-tracking");
    await assertSerialsAvailable(
      input.tenantSlug,
      input.productSku,
      input.serialNos,
      from.id
    );
  }

  const out = await recordStockMovement(input.tenantSlug, {
    productSku: input.productSku,
    productName: input.productName ?? input.productSku,
    movementType: "transfer",
    quantity: -Math.abs(input.quantity),
    unitCost: input.unitCost ?? 0,
    referenceType: "stock_transfer",
    referenceId: ref,
    warehouseId: from.id,
    branchId: from.branchId ?? undefined,
    lotNo: input.lotNo,
    serialNos: input.serialNos,
    notes: `Transfer to ${to.name}${input.notes ? ` — ${input.notes}` : ""}`,
  }, { skipJournalEntry: true });

  const inM = await recordStockMovement(input.tenantSlug, {
    productSku: input.productSku,
    productName: input.productName ?? input.productSku,
    movementType: "transfer",
    quantity: Math.abs(input.quantity),
    unitCost: input.unitCost ?? 0,
    referenceType: "stock_transfer",
    referenceId: ref,
    warehouseId: to.id,
    branchId: to.branchId ?? undefined,
    lotNo: input.lotNo,
    serialNos: input.serialNos,
    notes: `Transfer from ${from.name}${input.notes ? ` — ${input.notes}` : ""}`,
  }, { skipJournalEntry: true });

  if (input.serialNos?.length) {
    const { relocateSerials } = await import("./lot-tracking");
    await relocateSerials(input.tenantSlug, input.productSku, input.serialNos, to.id);
  }

  return { outMovementId: out.id, inMovementId: inM.id };
}
