import { randomUUID } from "crypto";
import { sql as SQL, SqlClient } from "../sql-client";
import { getBomByProductSku, explodeBom } from "./bom";
import { createJournalEntry } from "../finance/accounting";
import { ensureOnce } from "@/lib/ensure-once";

export interface WorkOrder {
  id: string;
  tenantSlug: string;
  orderNumber: string;
  productSku: string;
  productName: string;
  bomId: string | null;
  quantity: number;
  unit: string;
  status: "planned" | "released" | "in_progress" | "completed" | "closed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  totalCost: number;
  unitCost: number;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrderOperation {
  id: string;
  workOrderId: string;
  sequence: number;
  name: string;
  workCenter: string | null;
  standardMinutes: number;
  actualMinutes: number | null;
  laborRate: number;
  overheadRate: number;
  status: "pending" | "in_progress" | "completed";
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrderMaterial {
  id: string;
  workOrderId: string;
  componentSku: string;
  componentName: string;
  requiredQuantity: number;
  consumedQuantity: number;
  unitCost: number;
  unit: string;
  status: "pending" | "consumed" | "short";
  createdAt: string;
  updatedAt: string;
}

export function ensureWorkOrderTables(...args: Parameters<typeof ensureWorkOrderTablesRun>) {
  return ensureOnce("manufacturing/work-orders:ensureWorkOrderTables", () => ensureWorkOrderTablesRun(...args));
}

async function ensureWorkOrderTablesRun(sql: SqlClient = SQL) {
  await sql`
    create table if not exists work_orders (
      id text primary key,
      tenant_slug text not null,
      order_number text not null,
      product_sku text not null,
      product_name text not null,
      bom_id text,
      quantity numeric not null,
      unit text not null default 'pcs',
      status text not null default 'planned' check (status in ('planned', 'released', 'in_progress', 'completed', 'closed', 'cancelled')),
      priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
      scheduled_start date,
      scheduled_end date,
      actual_start timestamptz,
      actual_end timestamptz,
      material_cost numeric not null default 0,
      labor_cost numeric not null default 0,
      overhead_cost numeric not null default 0,
      total_cost numeric not null default 0,
      unit_cost numeric not null default 0,
      notes text,
      created_by text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`
    create table if not exists work_order_operations (
      id text primary key,
      work_order_id text not null references work_orders (id) on delete cascade,
      sequence integer not null,
      name text not null,
      work_center text,
      standard_minutes numeric not null default 0,
      actual_minutes numeric,
      labor_rate numeric not null default 0,
      overhead_rate numeric not null default 0,
      status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
      completed_at timestamptz,
      completed_by text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`
    create table if not exists work_order_materials (
      id text primary key,
      work_order_id text not null references work_orders (id) on delete cascade,
      component_sku text not null,
      component_name text not null,
      required_quantity numeric not null,
      consumed_quantity numeric not null default 0,
      unit_cost numeric not null default 0,
      unit text not null default 'pcs',
      status text not null default 'pending' check (status in ('pending', 'consumed', 'short')),
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`create index if not exists work_orders_tenant_idx on work_orders (tenant_slug, status)`;
  await sql`create index if not exists work_orders_product_idx on work_orders (tenant_slug, product_sku)`;
  await sql`create index if not exists work_order_operations_wo_idx on work_order_operations (work_order_id)`;
  await sql`alter table work_order_operations add column if not exists started_at timestamptz`;
  await sql`create index if not exists work_order_materials_wo_idx on work_order_materials (work_order_id)`;
}

export async function createWorkOrder(data: {
  tenantSlug: string;
  productSku: string;
  productName: string;
  bomId?: string;
  quantity: number;
  unit?: string;
  priority?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  notes?: string;
  createdBy?: string;
  operations?: Array<{
    name: string;
    workCenter?: string;
    standardMinutes?: number;
    laborRate?: number;
    overheadRate?: number;
  }>;
}): Promise<WorkOrder> {
  const sql = SQL;
  await ensureWorkOrderTables(sql);

  const id = randomUUID();
  const now = new Date();
  const orderNumber = `WO-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${id.slice(0, 6).toUpperCase()}`;

  let bomId = data.bomId ?? null;
  if (!bomId) {
    const bom = await getBomByProductSku(data.productSku, data.tenantSlug);
    if (bom) bomId = bom.id;
  }

  const [row] = (await sql`
    insert into work_orders (
      id, tenant_slug, order_number, product_sku, product_name, bom_id,
      quantity, unit, status, priority,
      scheduled_start, scheduled_end,
      notes, created_by, created_at, updated_at
    )
    values (
      ${id}, ${data.tenantSlug}, ${orderNumber}, ${data.productSku}, ${data.productName}, ${bomId},
      ${data.quantity}, ${data.unit ?? "pcs"}, 'planned', ${data.priority ?? "medium"},
      ${data.scheduledStart ?? null}, ${data.scheduledEnd ?? null},
      ${data.notes ?? null}, ${data.createdBy ?? null}, ${now}, ${now}
    )
    returning *
  `) as any[];

  if (data.operations) {
    for (let i = 0; i < data.operations.length; i++) {
      const op = data.operations[i];
      const opId = randomUUID();
      await sql`
        insert into work_order_operations (
          id, work_order_id, sequence, name, work_center,
          standard_minutes, labor_rate, overhead_rate, status, created_at, updated_at
        )
        values (
          ${opId}, ${id}, ${i + 1}, ${op.name}, ${op.workCenter ?? null},
          ${op.standardMinutes ?? 0}, ${op.laborRate ?? 0}, ${op.overheadRate ?? 0}, 'pending', ${now}, ${now}
        )
      `;
    }
  }

  return normalizeWorkOrder(row);
}

export async function listWorkOrders(
  tenantSlug: string,
  status?: string,
  limit: number = 50
): Promise<WorkOrder[]> {
  const sql = SQL;
  await ensureWorkOrderTables(sql);

  const rows = status
    ? (await sql`select * from work_orders where tenant_slug = ${tenantSlug} and status = ${status} order by created_at desc limit ${limit}`)
    : (await sql`select * from work_orders where tenant_slug = ${tenantSlug} order by created_at desc limit ${limit}`);

  return (rows as any[]).map(normalizeWorkOrder);
}

export async function getWorkOrder(id: string, tenantSlug: string): Promise<WorkOrder | null> {
  const sql = SQL;
  await ensureWorkOrderTables(sql);

  const [row] = (await sql`
    select * from work_orders where id = ${id} and tenant_slug = ${tenantSlug}
  `) as any[];

  return row ? normalizeWorkOrder(row) : null;
}

export async function getWorkOrderDetail(id: string, tenantSlug: string) {
  const sql = SQL;
  await ensureWorkOrderTables(sql);

  const [wo] = (await sql`select * from work_orders where id = ${id} and tenant_slug = ${tenantSlug}`) as any[];
  if (!wo) return null;

  const operations = (await sql`select * from work_order_operations where work_order_id = ${id} order by sequence`) as any[];
  const materials = (await sql`select * from work_order_materials where work_order_id = ${id} order by created_at`) as any[];

  return {
    ...normalizeWorkOrder(wo),
    operations: operations.map(normalizeWorkOrderOperation),
    materials: materials.map(normalizeWorkOrderMaterial),
  };
}

export async function releaseWorkOrder(id: string, tenantSlug: string): Promise<WorkOrder | null> {
  const sql = SQL;
  await ensureWorkOrderTables(sql);

  const wo = await getWorkOrder(id, tenantSlug);
  if (!wo || wo.status !== "planned") return null;

  const bom = wo.bomId ? await getBomByProductSku(wo.productSku, tenantSlug) : null;

  if (bom) {
    const explosion = await explodeBom(wo.productSku, tenantSlug, wo.quantity);
    const now = new Date();

    // Idempotent on retry — a mid-release failure leaves the WO 'planned'
    // with partial material rows; clearing first prevents duplicates.
    await sql`delete from work_order_materials where work_order_id = ${id}`;

    for (const item of explosion) {
      if (item.componentType === "raw_material") {
        const matId = randomUUID();
        const unitCost = await getComponentUnitCost(item.componentSku, tenantSlug);
        await sql`
          insert into work_order_materials (
            id, work_order_id, component_sku, component_name,
            required_quantity, consumed_quantity, unit_cost, unit, status, created_at, updated_at
          )
          values (
            ${matId}, ${id}, ${item.componentSku}, ${item.componentName},
            ${item.quantity}, 0, ${unitCost}, ${item.unit}, 'pending', ${now}, ${now}
          )
        `;
      }
    }

    let totalMaterialCost = 0;
    const { recordStockMovement } = await import("../inventory/stock-movements");
    for (const item of explosion) {
      if (item.componentType !== "raw_material") continue;
      const unitCost = await getComponentUnitCost(item.componentSku, tenantSlug);
      totalMaterialCost += item.quantity * unitCost;

      // Route through the canonical stock ledger: writes a stock_movements
      // row, enforces the no-oversell guard (the old code silently clamped
      // at zero), updates warehouse balances and serial/lot tracking.
      await recordStockMovement(tenantSlug, {
        productSku: item.componentSku,
        productName: item.componentName,
        movementType: "work_order_issue",
        quantity: item.quantity,
        unitCost,
        referenceType: "work_order",
        referenceId: wo.orderNumber ?? id,
        notes: `Issued to work order ${wo.orderNumber ?? id}`,
      });
    }

    await sql`
      update work_orders
      set material_cost = ${totalMaterialCost}, updated_at = now()
      where id = ${id}
    `;
  }

  const [row] = (await sql`
    update work_orders
    set status = 'released', actual_start = now(), updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug} and status = 'planned'
    returning *
  `) as any[];

  if (row) {
    await postWipJournalEntry(id, tenantSlug, "release");
  }

  return row ? normalizeWorkOrder(row) : null;
}

export async function startWorkOrder(id: string, tenantSlug: string): Promise<WorkOrder | null> {
  const sql = SQL;
  await ensureWorkOrderTables(sql);

  const [row] = (await sql`
    update work_orders
    set status = 'in_progress', updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug} and status = 'released'
    returning *
  `) as any[];

  return row ? normalizeWorkOrder(row) : null;
}

export async function completeWorkOrder(
  id: string,
  tenantSlug: string,
  opts?: { serialNos?: string[]; lotNo?: string; expiryDate?: string }
): Promise<WorkOrder | null> {
  const sql = SQL;
  await ensureWorkOrderTables(sql);

  const wo = await getWorkOrder(id, tenantSlug);
  if (!wo || wo.status !== "in_progress") return null;

  const operations = (await sql`select * from work_order_operations where work_order_id = ${id}`) as any[];
  let laborCost = 0;
  let overheadCost = 0;

  for (const op of operations) {
    const actualMinutes = op.actual_minutes ?? op.standard_minutes;
    const hours = actualMinutes / 60;
    laborCost += hours * Number(op.labor_rate);
    overheadCost += hours * Number(op.overhead_rate);
  }

  const materials = (await sql`select * from work_order_materials where work_order_id = ${id}`) as any[];
  let materialCost = 0;
  for (const mat of materials) {
    materialCost += Number(mat.consumed_quantity) * Number(mat.unit_cost);
  }

  const totalCost = materialCost + laborCost + overheadCost;
  const unitCost = wo.quantity > 0 ? totalCost / wo.quantity : 0;

  const [row] = (await sql`
    update work_orders
    set status = 'completed',
        actual_end = now(),
        labor_cost = ${laborCost},
        overhead_cost = ${overheadCost},
        material_cost = ${materialCost},
        total_cost = ${totalCost},
        unit_cost = ${unitCost},
        updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug}
    returning *
  `) as any[];

  if (row) {
    await postWipJournalEntry(id, tenantSlug, "complete");

    const [existingProduct] = (await sql`
      select id, current_stock from inventory_products
      where tenant_slug = ${tenantSlug} and sku = ${wo.productSku}
      limit 1
    `) as any[];

    if (!existingProduct) {
      const newId = randomUUID();
      await sql`
        insert into inventory_products (id, tenant_slug, name, sku, category, current_stock, min_stock, unit_cost, sale_price, created_at)
        values (${newId}, ${tenantSlug}, ${wo.productName}, ${wo.productSku}, 'finished_goods', 0, 0, ${unitCost}, 0, now())
      `;
    }

    // Canonical stock ledger for the FG receipt — records the movement row,
    // increments current_stock and warehouse balance. The GL entry stays in
    // postWipJournalEntry (work_order_receipt JEs are source-handled).
    // Serial/batch-tracked FGs must arrive with their serials/lot so the
    // tracking ledger can mint them.
    const { recordStockMovement } = await import("../inventory/stock-movements");
    await recordStockMovement(tenantSlug, {
      productSku: wo.productSku,
      productName: wo.productName,
      movementType: "work_order_receipt",
      quantity: wo.quantity,
      unitCost,
      referenceType: "work_order",
      referenceId: wo.orderNumber ?? id,
      serialNos: opts?.serialNos,
      lotNo: opts?.lotNo,
      expiryDate: opts?.expiryDate,
      notes: `Completed work order ${wo.orderNumber ?? id}`,
    });

    try {
      const { emitEvent } = await import("@/lib/notify");
      void emitEvent({
        tenantSlug,
        eventType: "wo.completed",
        sourceModule: "manufacturing",
        sourceRecordId: id,
        dedupeKey: `wo:${id}:completed`,
        payload: {
          workOrderNo: (wo as any).workOrderNo ?? (wo as any).number ?? id,
          workOrderId: id,
          itemName: wo.productName,
          quantity: wo.quantity,
          unitCost,
        },
      });
    } catch (err) {
      console.error("Failed to emit wo.completed:", err);
    }
  }

  return row ? normalizeWorkOrder(row) : null;
}

export async function closeWorkOrder(id: string, tenantSlug: string): Promise<WorkOrder | null> {
  const sql = SQL;
  await ensureWorkOrderTables(sql);

  const wo = await getWorkOrder(id, tenantSlug);
  if (!wo || wo.status !== "completed") return null;

  let standardMaterialCost = 0;
  if (wo.bomId) {
    const bom = await getBomByProductSku(wo.productSku, tenantSlug);
    if (bom) {
      const explosion = await explodeBom(wo.productSku, tenantSlug, wo.quantity);
      for (const item of explosion) {
        if (item.componentType !== "raw_material") continue;
        const unitCost = await getComponentUnitCost(item.componentSku, tenantSlug);
        standardMaterialCost += item.quantity * unitCost;
      }
    }
  }

  const materialVariance = wo.materialCost - standardMaterialCost;
  const today = new Date().toISOString().split("T")[0];

  if (Math.abs(materialVariance) > 0.01) {
    try {
      await createJournalEntry({
        tenantSlug,
        entryDate: today,
        referenceType: "manual",
        referenceId: wo.orderNumber,
        description: `Material variance for work order ${wo.orderNumber}`,
        lines: [
          {
            accountCode: "1300",
            debitAmount: materialVariance > 0 ? materialVariance : 0,
            creditAmount: materialVariance < 0 ? Math.abs(materialVariance) : 0,
            description: `Material variance (${materialVariance > 0 ? "unfavorable" : "favorable"})`,
          },
          {
            accountCode: "6200",
            debitAmount: materialVariance < 0 ? Math.abs(materialVariance) : 0,
            creditAmount: materialVariance > 0 ? materialVariance : 0,
            description: `Material variance offset`,
          },
        ],
      });
    } catch (error) {
      console.error("Failed to post variance journal entry:", error);
    }
  }

  const [row] = (await sql`
    update work_orders
    set status = 'closed', updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug} and status = 'completed'
    returning *
  `) as any[];

  return row ? normalizeWorkOrder(row) : null;
}

export async function cancelWorkOrder(id: string, tenantSlug: string): Promise<WorkOrder | null> {
  const sql = SQL;
  await ensureWorkOrderTables(sql);

  const wo = await getWorkOrder(id, tenantSlug);
  if (!wo || (wo.status !== "planned" && wo.status !== "released")) return null;

  if (wo.status === "released") {
    const materials = (await sql`select * from work_order_materials where work_order_id = ${id}`) as any[];
    const { recordStockMovement } = await import("../inventory/stock-movements");
    let returnedValue = 0;
    for (const mat of materials) {
      const requiredQty = Number(mat.required_quantity);
      const unitCost = Number(mat.unit_cost);
      returnedValue += requiredQty * unitCost;
      await recordStockMovement(tenantSlug, {
        productSku: mat.component_sku,
        productName: mat.component_name ?? mat.component_sku,
        movementType: "adjustment",
        quantity: requiredQty,
        unitCost,
        referenceType: "work_order_cancel",
        referenceId: wo.orderNumber ?? id,
        notes: `Material returned on work order ${wo.orderNumber ?? id} cancellation`,
      }, { skipJournalEntry: true });
    }
    // Reverse the WIP release entry — adjustment JEs would hit 6100, but a
    // WO cancel returns value to raw materials, not an expense offset.
    if (returnedValue > 0.01) {
      await createJournalEntry({
        tenantSlug,
        entryDate: new Date().toISOString().split("T")[0],
        referenceType: "manual",
        referenceId: wo.orderNumber,
        description: `Work order ${wo.orderNumber} cancelled — materials returned to stock`,
        lines: [
          { accountCode: "1500", debitAmount: returnedValue, creditAmount: 0, description: "Materials returned from WIP" },
          { accountCode: "1300", debitAmount: 0, creditAmount: returnedValue, description: "WIP release reversed" },
        ],
      });
    }
  }

  const [row] = (await sql`
    update work_orders
    set status = 'cancelled', updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug} and status in ('planned', 'released')
    returning *
  `) as any[];

  return row ? normalizeWorkOrder(row) : null;
}

export async function updateOperation(
  operationId: string,
  workOrderId: string,
  tenantSlug: string,
  updates: {
    actualMinutes?: number;
    status?: string;
    completedBy?: string;
  }
): Promise<WorkOrderOperation | null> {
  const sql = SQL;
  await ensureWorkOrderTables(sql);

  const [row] = (await sql`
    update work_order_operations o
    set actual_minutes = coalesce(${updates.actualMinutes ?? null}::numeric, o.actual_minutes),
        status = coalesce(${updates.status ?? null}::text, o.status),
        started_at = case when ${updates.status ?? null} = 'in_progress' then coalesce(o.started_at, now()) else o.started_at end,
        completed_at = case when ${updates.status ?? null} = 'completed' then now() else o.completed_at end,
        completed_by = coalesce(${updates.completedBy ?? null}::text, o.completed_by),
        updated_at = now()
    from work_orders w
    where o.id = ${operationId} and o.work_order_id = ${workOrderId}
      and w.id = o.work_order_id and w.tenant_slug = ${tenantSlug}
    returning o.*
  `) as any[];

  return row ? normalizeWorkOrderOperation(row) : null;
}

export async function consumeMaterial(
  materialId: string,
  workOrderId: string,
  tenantSlug: string,
  consumedQuantity: number
): Promise<WorkOrderMaterial | null> {
  const sql = SQL;
  await ensureWorkOrderTables(sql);

  const wo = await getWorkOrder(workOrderId, tenantSlug);
  if (!wo || wo.status !== "in_progress") return null;

  const [row] = (await sql`
    update work_order_materials m
    set consumed_quantity = m.consumed_quantity + ${consumedQuantity},
        status = case when m.consumed_quantity + ${consumedQuantity} >= m.required_quantity then 'consumed' else 'pending' end,
        updated_at = now()
    from work_orders w
    where m.id = ${materialId} and m.work_order_id = ${workOrderId}
      and w.id = m.work_order_id and w.tenant_slug = ${tenantSlug}
    returning m.*
  `) as any[];

  return row ? normalizeWorkOrderMaterial(row) : null;
}

async function getComponentUnitCost(sku: string, tenantSlug: string): Promise<number> {
  const sql = SQL;
  try {
    const [row] = (await sql`
      select unit_cost from inventory_products
      where tenant_slug = ${tenantSlug} and sku = ${sku}
      limit 1
    `) as any[];
    return row ? Number(row.unit_cost) : 0;
  } catch {
    return 0;
  }
}

async function postWipJournalEntry(
  workOrderId: string,
  tenantSlug: string,
  type: "release" | "complete"
): Promise<void> {
  try {
    const sql = SQL;
    const [wo] = (await sql`select * from work_orders where id = ${workOrderId} and tenant_slug = ${tenantSlug}`) as any[];
    if (!wo) return;

    const today = new Date().toISOString().split("T")[0];

    if (type === "release") {
      const materialCost = Number(wo.material_cost);
      if (materialCost > 0) {
        await createJournalEntry({
          tenantSlug,
          entryDate: today,
          referenceType: "manual",
          referenceId: wo.order_number,
          description: `WIP materials for work order ${wo.order_number}`,
          lines: [
            { accountCode: "1300", debitAmount: materialCost, creditAmount: 0, description: "Raw materials to WIP" },
            { accountCode: "1500", debitAmount: 0, creditAmount: materialCost, description: "Raw materials consumed" },
          ],
        });
      }
    } else if (type === "complete") {
      // Absorb conversion costs into WIP before the completion entry — the
      // release JE only debited 1300 for materials, so crediting it for
      // total_cost without this would drive 1300 negative.
      const laborCost = Number(wo.labor_cost ?? 0);
      const overheadCost = Number(wo.overhead_cost ?? 0);
      if (laborCost > 0.01) {
        await createJournalEntry({
          tenantSlug,
          entryDate: today,
          referenceType: "manual",
          referenceId: wo.order_number,
          description: `Labor absorbed into WIP — work order ${wo.order_number}`,
          lines: [
            { accountCode: "1300", debitAmount: laborCost, creditAmount: 0, description: "Labor capitalized to WIP" },
            { accountCode: "6300", debitAmount: 0, creditAmount: laborCost, description: "Labor absorbed from wages expense" },
          ],
        });
      }
      if (overheadCost > 0.01) {
        await createJournalEntry({
          tenantSlug,
          entryDate: today,
          referenceType: "manual",
          referenceId: wo.order_number,
          description: `Overhead absorbed into WIP — work order ${wo.order_number}`,
          lines: [
            { accountCode: "1300", debitAmount: overheadCost, creditAmount: 0, description: "Overhead capitalized to WIP" },
            { accountCode: "6100", debitAmount: 0, creditAmount: overheadCost, description: "Overhead absorbed from general expense" },
          ],
        });
      }

      const totalCost = Number(wo.total_cost);
      if (totalCost > 0) {
        await createJournalEntry({
          tenantSlug,
          entryDate: today,
          referenceType: "manual",
          referenceId: wo.order_number,
          description: `Finished goods from work order ${wo.order_number}`,
          lines: [
            { accountCode: "1400", debitAmount: totalCost, creditAmount: 0, description: "WIP to finished goods" },
            { accountCode: "1300", debitAmount: 0, creditAmount: totalCost, description: "WIP completed" },
          ],
        });
      }
    }
  } catch (error) {
    console.error("Failed to post WIP journal entry:", error);
  }
}

function normalizeWorkOrder(row: any): WorkOrder {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    orderNumber: row.order_number,
    productSku: row.product_sku,
    productName: row.product_name,
    bomId: row.bom_id,
    quantity: Number(row.quantity),
    unit: row.unit,
    status: row.status,
    priority: row.priority,
    scheduledStart: row.scheduled_start,
    scheduledEnd: row.scheduled_end,
    actualStart: row.actual_start,
    actualEnd: row.actual_end,
    materialCost: Number(row.material_cost),
    laborCost: Number(row.labor_cost),
    overheadCost: Number(row.overhead_cost),
    totalCost: Number(row.total_cost),
    unitCost: Number(row.unit_cost),
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeWorkOrderOperation(row: any): WorkOrderOperation {
  return {
    id: row.id,
    workOrderId: row.work_order_id,
    sequence: row.sequence,
    name: row.name,
    workCenter: row.work_center,
    standardMinutes: Number(row.standard_minutes),
    actualMinutes: row.actual_minutes ? Number(row.actual_minutes) : null,
    laborRate: Number(row.labor_rate),
    overheadRate: Number(row.overhead_rate),
    status: row.status,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeWorkOrderMaterial(row: any): WorkOrderMaterial {
  return {
    id: row.id,
    workOrderId: row.work_order_id,
    componentSku: row.component_sku,
    componentName: row.component_name,
    requiredQuantity: Number(row.required_quantity),
    consumedQuantity: Number(row.consumed_quantity),
    unitCost: Number(row.unit_cost),
    unit: row.unit,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
