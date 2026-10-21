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
