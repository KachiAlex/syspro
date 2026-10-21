import { randomUUID } from "crypto";

import { sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { createWorkOrder } from "./work-orders";

// ---------------------------------------------------------------------------
// Batch production runs: split a planned quantity into N batches, each its
// own work order with an auto-generated lot number for traceability.
// ---------------------------------------------------------------------------

export function ensureBatchTables(...args: Parameters<typeof ensureRun>) {
  return ensureOnce("manufacturing/batches:ensureTables", () => ensureRun(...args));
}

async function ensureRun(sql = SQL) {
  await sql`
    create table if not exists production_runs (
      id text primary key,
      tenant_slug text not null,
      run_number text not null,
      product_sku text not null,
      product_name text not null,
      total_quantity numeric not null,
      batch_size numeric not null,
      status text not null default 'open'
        check (status in ('open', 'in_progress', 'completed', 'cancelled')),
      notes text,
      created_by text,
      created_at timestamptz default now(),
      unique (tenant_slug, run_number)
    )
  `;
  await sql`alter table if exists work_orders add column if not exists production_run_id text`;
  await sql`alter table if exists work_orders add column if not exists lot_no text`;
  await sql`create index if not exists work_orders_run_idx on work_orders (tenant_slug, production_run_id)`;
}

async function nextRunNumber(tenantSlug: string): Promise<string> {
  const rows = (await SQL`
    select count(*)::int n from production_runs where tenant_slug = ${tenantSlug}
  `) as any[];
  return `RUN-${String((rows[0]?.n ?? 0) + 1).padStart(5, "0")}`;
}

/**
 * Splits totalQuantity into batches of batchSize and creates one work order
 * per batch, each stamped with its production run and a generated lot number
 * (LOT-<run>-NN) that flows into stock receipt + traceability.
 */
export async function createBatchRun(data: {
  tenantSlug: string;
  productSku: string;
  productName: string;
  totalQuantity: number;
  batchSize: number;
  bomId?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  priority?: string;
  notes?: string;
  createdBy?: string;
}) {
  await ensureBatchTables();
  if (data.totalQuantity <= 0) throw new Error("Total quantity must be positive");
  if (data.batchSize <= 0) throw new Error("Batch size must be positive");

  const runId = `run_${randomUUID().slice(0, 10)}`;
  const runNumber = await nextRunNumber(data.tenantSlug);

  const batches: Array<{ qty: number; lotNo: string }> = [];
  let remaining = data.totalQuantity;
  let n = 0;
  while (remaining > 0.0001) {
    n += 1;
    const qty = Math.min(data.batchSize, remaining);
    batches.push({ qty, lotNo: `LOT-${runNumber}-${String(n).padStart(2, "0")}` });
    remaining -= qty;
  }

  await SQL`
    insert into production_runs (
      id, tenant_slug, run_number, product_sku, product_name,
      total_quantity, batch_size, status, notes, created_by
    ) values (
      ${runId}, ${data.tenantSlug}, ${runNumber}, ${data.productSku}, ${data.productName},
      ${data.totalQuantity}, ${data.batchSize}, 'open', ${data.notes ?? null}, ${data.createdBy ?? null}
    )
  `;

  const workOrders = [];
  for (const b of batches) {
    const wo = await createWorkOrder({
      tenantSlug: data.tenantSlug,
      productSku: data.productSku,
      productName: `${data.productName} — batch ${b.lotNo}`,
      bomId: data.bomId,
      quantity: b.qty,
      priority: data.priority,
      scheduledStart: data.scheduledStart,
      scheduledEnd: data.scheduledEnd,
      notes: `${data.notes ?? ""} Run ${runNumber} lot ${b.lotNo}`.trim(),
      createdBy: data.createdBy,
    });
    await SQL`
      update work_orders set production_run_id = ${runId}, lot_no = ${b.lotNo}
      where id = ${wo.id} and tenant_slug = ${data.tenantSlug}
    `;
    workOrders.push({ ...wo, productionRunId: runId, lotNo: b.lotNo });
  }

  return { runId, runNumber, batchCount: batches.length, workOrders };
}

export async function listBatchRuns(tenantSlug: string) {
  await ensureBatchTables();
  const runs = (await SQL`
    select * from production_runs where tenant_slug = ${tenantSlug}
    order by created_at desc
  `) as any[];
  // Roll up child work-order statuses onto each run.
  for (const r of runs) {
    const list = (await SQL`
      select id, order_number, quantity, status, lot_no
      from work_orders where tenant_slug = ${tenantSlug} and production_run_id = ${r.id}
      order by lot_no
    `) as any[];
    r.workOrders = list.map((w: any) => ({
      id: w.id, orderNumber: w.order_number,
      quantity: Number(w.quantity), status: w.status, lotNo: w.lot_no,
    }));
    if (list.length) {
      const statuses = list.map((w: any) => w.status);
      r.status = statuses.every((s: string) => s === "closed" || s === "completed") ? "completed"
        : statuses.some((s: string) => s === "in_progress" || s === "released") ? "in_progress"
        : statuses.every((s: string) => s === "cancelled") ? "cancelled" : "open";
    }
  }
  return runs;
}

export async function cancelBatchRun(tenantSlug: string, runId: string) {
  await ensureBatchTables();
  const { cancelWorkOrder } = await import("./work-orders");
  const wos = (await SQL`
    select id, status from work_orders
    where tenant_slug = ${tenantSlug} and production_run_id = ${runId}
  `) as any[];
  for (const w of wos) {
    if (w.status === "planned" || w.status === "released") {
      await cancelWorkOrder(w.id, tenantSlug).catch(() => {});
    }
  }
  await SQL`
    update production_runs set status = 'cancelled'
    where id = ${runId} and tenant_slug = ${tenantSlug}
  `;
}
