import { randomUUID } from "crypto";

import { sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { recordStockMovement } from "../inventory/stock-movements";
import { postGLEntry, GL_ACCOUNTS } from "../finance/gl";

// ---------------------------------------------------------------------------
// Subcontracting: send raw materials to a subcontractor (stock + WIP value
// leaves), receive finished goods back (FG in at materials + fee cost; the
// fee accrues to AP). Standard send-out / receive-back flow.
// ---------------------------------------------------------------------------

export function ensureSubcontractTables(...args: Parameters<typeof ensureRun>) {
  return ensureOnce("manufacturing/subcontracting:ensureTables", () => ensureRun(...args));
}

async function ensureRun(sql = SQL) {
  await sql`
    create table if not exists subcontract_orders (
      id text primary key,
      tenant_slug text not null,
      order_number text not null,
      subcontractor text not null,
      product_sku text not null,
      product_name text not null,
      quantity numeric not null,
      fee_per_unit numeric not null default 0,
      status text not null default 'open'
        check (status in ('open', 'materials_issued', 'completed', 'cancelled')),
      expected_date date,
      received_qty numeric not null default 0,
      notes text,
      created_by text,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      unique (tenant_slug, order_number)
    )
  `;
  await sql`
    create table if not exists subcontract_materials (
      id text primary key,
      subcontract_order_id text not null references subcontract_orders (id) on delete cascade,
      tenant_slug text not null,
      component_sku text not null,
      component_name text,
      quantity numeric not null,
      unit_cost numeric not null default 0,
      issued_at timestamptz
    )
  `;
  await sql`create index if not exists subcontract_orders_tenant_idx on subcontract_orders (tenant_slug, status)`;
}

async function nextOrderNumber(tenantSlug: string): Promise<string> {
  const rows = (await SQL`
    select count(*)::int n from subcontract_orders where tenant_slug = ${tenantSlug}
  `) as any[];
  return `SCO-${String((rows[0]?.n ?? 0) + 1).padStart(5, "0")}`;
}

export async function createSubcontractOrder(data: {
  tenantSlug: string;
  subcontractor: string;
  productSku: string;
  productName: string;
  quantity: number;
  feePerUnit?: number;
  expectedDate?: string;
  notes?: string;
  createdBy?: string;
  materials: Array<{ sku: string; name?: string; quantity: number; unitCost?: number }>;
  warehouseId?: string;
}) {
  await ensureSubcontractTables();
  if (data.quantity <= 0) throw new Error("Quantity must be positive");
  if (!data.materials.length) throw new Error("Materials to issue are required");

  const id = `sco_${randomUUID().slice(0, 10)}`;
  const orderNumber = await nextOrderNumber(data.tenantSlug);
  await SQL`
    insert into subcontract_orders (
      id, tenant_slug, order_number, subcontractor, product_sku, product_name,
      quantity, fee_per_unit, status, expected_date, notes, created_by
    ) values (
      ${id}, ${data.tenantSlug}, ${orderNumber}, ${data.subcontractor},
      ${data.productSku}, ${data.productName}, ${data.quantity},
      ${data.feePerUnit ?? 0}, 'open', ${data.expectedDate ?? null},
      ${data.notes ?? null}, ${data.createdBy ?? null}
    )
  `;
  for (const m of data.materials) {
    // Look up cost from the product record when not given.
    let unitCost = m.unitCost;
    if (unitCost == null) {
      const p = (await SQL`
        select unit_cost::float c from inventory_products
        where tenant_slug = ${data.tenantSlug} and sku = ${m.sku}
      `) as any[];
      unitCost = p[0]?.c ?? 0;
    }
    await SQL`
      insert into subcontract_materials (
        id, subcontract_order_id, tenant_slug, component_sku, component_name, quantity, unit_cost
      ) values (
        ${`scm_${randomUUID().slice(0, 10)}`}, ${id}, ${data.tenantSlug},
        ${m.sku}, ${m.name ?? null}, ${m.quantity}, ${unitCost}
      )
    `;
  }
  return { id, orderNumber };
}

/** Issues all order materials to the subcontractor: stock out + WIP value. */
export async function issueSubcontractMaterials(
  tenantSlug: string, orderId: string, opts: { warehouseId?: string } = {}
) {
  await ensureSubcontractTables();
  const rows = (await SQL`
    select * from subcontract_orders where id = ${orderId} and tenant_slug = ${tenantSlug}
  `) as any[];
  const order = rows[0];
  if (!order) throw new Error("Subcontract order not found");
  if (order.status !== "open") throw new Error(`Order is ${order.status}`);

  const materials = (await SQL`
    select * from subcontract_materials where subcontract_order_id = ${orderId}
  `) as any[];
  let materialsCost = 0;
  for (const m of materials) {
    await recordStockMovement(tenantSlug, {
      productSku: m.component_sku,
      productName: m.component_name ?? m.component_sku,
      movementType: "work_order_issue",
      quantity: Number(m.quantity),
      unitCost: Number(m.unit_cost),
      referenceType: "subcontract_order",
      referenceId: order.order_number,
      warehouseId: opts.warehouseId,
      notes: `Issued to subcontractor ${order.subcontractor}`,
    });
    materialsCost += Number(m.quantity) * Number(m.unit_cost);
    await SQL`
      update subcontract_materials set issued_at = now() where id = ${m.id}
    `;
  }
  // work_order_issue movements skip their own JE (work-orders post WIP
  // separately), so the subcontract WIP entry lands here: Dr WIP / Cr raw.
  if (materialsCost > 0) {
    await postGLEntry({
      tenantSlug,
      entryDate: new Date().toISOString().split("T")[0],
      journalType: "SYSTEM",
      referenceType: "subcontract_order",
      referenceId: orderId,
      description: `Materials issued to subcontractor ${order.subcontractor} — ${order.order_number}`,
      lines: [
        { accountCode: GL_ACCOUNTS.WIP_INVENTORY, debitAmount: Math.round(materialsCost * 100) / 100, description: "WIP — materials sent out" },
        { accountCode: GL_ACCOUNTS.RAW_MATERIALS, creditAmount: Math.round(materialsCost * 100) / 100, description: "Raw materials issued" },
      ],
    });
  }
  await SQL`
    update subcontract_orders set status = 'materials_issued', updated_at = now()
    where id = ${orderId} and tenant_slug = ${tenantSlug}
  `;
  return { issued: materials.length };
}

/**
 * Receives finished goods: FG in at (materials cost + fee), WIP relieved by
 * materials cost, fee accrued to AP for the subcontractor.
 */
export async function receiveSubcontractGoods(data: {
  tenantSlug: string;
  orderId: string;
  receivedQty?: number;
  warehouseId?: string;
  userId?: string;
}) {
  await ensureSubcontractTables();
  const rows = (await SQL`
    select * from subcontract_orders where id = ${data.orderId} and tenant_slug = ${data.tenantSlug}
  `) as any[];
  const order = rows[0];
  if (!order) throw new Error("Subcontract order not found");
  if (order.status !== "materials_issued") throw new Error(`Order is ${order.status}`);

  const qty = data.receivedQty ?? Number(order.quantity);
  const materials = (await SQL`
    select * from subcontract_materials where subcontract_order_id = ${data.orderId}
  `) as any[];
  const materialsCost = materials.reduce((s, m) => s + Number(m.quantity) * Number(m.unit_cost), 0);
  const fee = Math.round(qty * Number(order.fee_per_unit) * 100) / 100;
  const fgValue = Math.round((materialsCost + fee) * 100) / 100;

  // Finished goods in — no automatic JE from the movement; we post a single
  // consolidated entry below so the fee lands on AP, not WIP.
  await recordStockMovement(data.tenantSlug, {
    productSku: order.product_sku,
    productName: order.product_name,
    movementType: "work_order_receipt",
    quantity: qty,
    unitCost: qty > 0 ? fgValue / qty : 0,
    referenceType: "subcontract_order",
    referenceId: order.order_number,
    warehouseId: data.warehouseId,
    notes: `Received from subcontractor ${order.subcontractor}`,
  });

  await postGLEntry({
    tenantSlug: data.tenantSlug,
    entryDate: new Date().toISOString().split("T")[0],
    journalType: "SYSTEM",
    referenceType: "subcontract_order",
    referenceId: data.orderId,
    description: `Subcontract receipt ${order.order_number} — ${order.subcontractor}`,
    createdBy: data.userId,
    lines: [
      { accountCode: GL_ACCOUNTS.FINISHED_GOODS, debitAmount: fgValue, description: "Finished goods received" },
      { accountCode: GL_ACCOUNTS.WIP_INVENTORY, creditAmount: materialsCost, description: "WIP — materials consumed" },
      ...(fee > 0 ? [{ accountCode: GL_ACCOUNTS.ACCOUNTS_PAYABLE, creditAmount: fee, description: "Subcontract fee" }] : []),
    ],
  });

  await SQL`
    update subcontract_orders
    set status = 'completed', received_qty = received_qty + ${qty}, updated_at = now()
    where id = ${data.orderId} and tenant_slug = ${data.tenantSlug}
  `;
  return { receivedQty: qty, materialsCost, fee, finishedGoodsValue: fgValue };
}

export async function listSubcontractOrders(tenantSlug: string, status?: string) {
  await ensureSubcontractTables();
  return (await SQL`
    select o.*,
      (select json_agg(m.*) from subcontract_materials m where m.subcontract_order_id = o.id) as materials
    from subcontract_orders o
    where o.tenant_slug = ${tenantSlug}
      ${status ? SQL`and o.status = ${status}` : SQL``}
    order by o.created_at desc
  `) as any[];
}

export async function cancelSubcontractOrder(tenantSlug: string, orderId: string) {
  await ensureSubcontractTables();
  const res = await SQL`
    update subcontract_orders set status = 'cancelled', updated_at = now()
    where id = ${orderId} and tenant_slug = ${tenantSlug} and status = 'open'
    returning id
  ` as any[];
  if (!res.length) throw new Error("Only open orders can be cancelled");
}

// ---------------------------------------------------------------------------
// Supplied-materials ledger: issue -> consume -> return
// ---------------------------------------------------------------------------

async function ensureMovementLedger() {
  await ensureSubcontractTables();
  await SQL`
    create table if not exists subcontract_material_movements (
      id uuid primary key default gen_random_uuid(),
      subcontract_material_id text not null,
      tenant_slug text not null,
      movement_type text not null check (movement_type in ('issue','consume','return')),
      quantity numeric not null check (quantity > 0),
      notes text,
      created_at timestamptz not null default now()
    )
  `;
  await SQL`alter table if exists subcontract_materials add column if not exists consumed_quantity numeric not null default 0`;
  await SQL`alter table if exists subcontract_materials add column if not exists returned_quantity numeric not null default 0`;
}

/**
 * Record consumption of issued materials against a subcontract order (what
 * the subcontractor reports as used), or return of unused materials.
 */
export async function recordMaterialMovement(
  tenantSlug: string,
  materialId: string,
  movementType: "consume" | "return",
  quantity: number,
  notes?: string
) {
  await ensureMovementLedger();
  const m = ((await SQL`
    select sm.*, so.order_number from subcontract_materials sm
    join subcontract_orders so on so.id = sm.subcontract_order_id
    where sm.id = ${materialId} and sm.tenant_slug = ${tenantSlug}
  `) as any[])[0];
  if (!m) throw new Error("Subcontract material line not found");

  const issued = Number(m.quantity);
  const consumed = Number(m.consumed_quantity ?? 0);
  const returned = Number(m.returned_quantity ?? 0);
  const outstanding = issued - consumed - returned;
  if (quantity > outstanding) {
    throw new Error(`Cannot ${movementType} ${quantity}: only ${outstanding} outstanding at subcontractor`);
  }

  await SQL`
    insert into subcontract_material_movements
      (subcontract_material_id, tenant_slug, movement_type, quantity, notes)
    values (${materialId}, ${tenantSlug}, ${movementType}, ${quantity}, ${notes ?? null})
  `;

  if (movementType === "consume") {
    await SQL`update subcontract_materials set consumed_quantity = consumed_quantity + ${quantity} where id = ${materialId}`;
  } else {
    await SQL`update subcontract_materials set returned_quantity = returned_quantity + ${quantity} where id = ${materialId}`;
    // Return goes back into stock via the ledger
    await recordStockMovement(tenantSlug, {
      productSku: m.component_sku,
      productName: m.component_name ?? m.component_sku,
      movementType: "return",
      quantity,
      unitCost: Number(m.unit_cost),
      referenceType: "subcontract_return",
      referenceId: m.order_number,
      notes: `Returned from subcontractor — ${m.order_number}`,
    });
    await postGLEntry({
      tenantSlug,
      entryDate: new Date().toISOString().split("T")[0],
      journalType: "SYSTEM",
      referenceType: "subcontract_return",
      referenceId: m.order_number,
      description: `Subcontractor material return — ${m.component_sku} ×${quantity}`,
      lines: [
        { accountCode: GL_ACCOUNTS.RAW_MATERIALS, debitAmount: quantity * Number(m.unit_cost), description: "Materials returned" },
        { accountCode: GL_ACCOUNTS.WIP_INVENTORY, creditAmount: quantity * Number(m.unit_cost), description: "Reverse WIP issue" },
      ],
    });
  }
  return { recorded: true, outstanding: outstanding - quantity };
}

/** Per-order view of the supplied-materials ledger position. */
export async function getMaterialLedger(tenantSlug: string, orderId: string) {
  await ensureMovementLedger();
  const materials = (await SQL`
    select * from subcontract_materials where subcontract_order_id = ${orderId} and tenant_slug = ${tenantSlug}
  `) as any[];
  const ids = materials.map((m: any) => m.id);
  const movements = ids.length
    ? ((await SQL`
        select * from subcontract_material_movements where tenant_slug = ${tenantSlug}
          and subcontract_material_id = ANY(${ids})
        order by created_at
      `) as any[])
    : [];
  return materials.map((m: any) => ({
    ...m,
    outstanding: Number(m.quantity) - Number(m.consumed_quantity ?? 0) - Number(m.returned_quantity ?? 0),
    movements: movements.filter((mv: any) => mv.subcontract_material_id === m.id),
  }));
}
