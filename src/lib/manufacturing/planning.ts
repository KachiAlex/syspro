import { randomUUID } from "crypto";

import { db, sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { createWorkOrder } from "./work-orders";
import { createMaterialRequest } from "@/lib/inventory/material-requests";
import { writeFinanceEvent } from "@/lib/finance/events";

export function ensurePlanningTables() {
  return ensureOnce("manufacturing/planning:ensureTables", ensurePlanningTablesRun);
}

async function ensurePlanningTablesRun() {
  const sql = SQL;
  await sql`create table if not exists manufacturing_workstations (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    name text not null,
    code text not null,
    workstation_type text,
    labor_rate numeric not null default 0,
    overhead_rate numeric not null default 0,
    electricity_rate numeric not null default 0,
    rent_rate numeric not null default 0,
    capacity_hours_per_day numeric not null default 8,
    working_hours jsonb,
    enabled boolean not null default true,
    created_at timestamptz not null default now(),
    unique (tenant_slug, code)
  )`;
  await sql`create table if not exists manufacturing_routings (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    name text not null,
    description text,
    enabled boolean not null default true,
    created_at timestamptz not null default now(),
    unique (tenant_slug, name)
  )`;
  await sql`create table if not exists manufacturing_routing_operations (
    id uuid primary key default gen_random_uuid(),
    routing_id uuid not null references manufacturing_routings(id) on delete cascade,
    sequence integer not null,
    name text not null,
    workstation_id uuid references manufacturing_workstations(id),
    standard_minutes numeric not null default 0
  )`;
  await sql`alter table if exists bom_headers add column if not exists routing_id uuid`;
  await sql`create table if not exists manufacturing_job_cards (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    job_card_number text not null,
    work_order_id text not null,
    operation_id text,
    operation_name text not null,
    workstation_id uuid,
    employee_id text,
    status text not null default 'open'
      check (status in ('open','in_progress','paused','completed','cancelled')),
    planned_quantity numeric not null default 0,
    completed_quantity numeric not null default 0,
    rejected_quantity numeric not null default 0,
    planned_minutes numeric not null default 0,
    actual_minutes numeric not null default 0,
    labor_cost numeric not null default 0,
    overhead_cost numeric not null default 0,
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (tenant_slug, job_card_number)
  )`;
  await sql`create index if not exists job_cards_wo_idx on manufacturing_job_cards (work_order_id)`;
  await sql`create table if not exists manufacturing_job_card_time_logs (
    id uuid primary key default gen_random_uuid(),
    job_card_id uuid not null references manufacturing_job_cards(id) on delete cascade,
    employee_id text,
    started_at timestamptz not null,
    ended_at timestamptz,
    minutes numeric,
    completed_quantity numeric not null default 0,
    notes text
  )`;
  await sql`create table if not exists manufacturing_sales_forecasts (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    product_sku text not null,
    forecast_date date not null,
    forecast_quantity numeric not null,
    consumed_quantity numeric not null default 0,
    notes text,
    created_at timestamptz not null default now()
  )`;
  await sql`create index if not exists sales_forecasts_tenant_idx
    on manufacturing_sales_forecasts (tenant_slug, product_sku, forecast_date)`;
  await sql`create table if not exists manufacturing_production_plans (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    plan_number text not null,
    plan_name text not null,
    status text not null default 'draft'
      check (status in ('draft','submitted','in_progress','completed','cancelled')),
    period_start date,
    period_end date,
    include_sales_orders boolean not null default true,
    include_forecasts boolean not null default true,
    generated_work_orders int not null default 0,
    generated_material_requests int not null default 0,
    created_by text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (tenant_slug, plan_number)
  )`;
  await sql`create table if not exists manufacturing_production_plan_items (
    id uuid primary key default gen_random_uuid(),
    plan_id uuid not null references manufacturing_production_plans(id) on delete cascade,
    product_sku text not null,
    product_name text,
    demanded_quantity numeric not null default 0,
    sales_order_quantity numeric not null default 0,
    forecast_quantity numeric not null default 0,
    on_hand_quantity numeric not null default 0,
    wip_quantity numeric not null default 0,
    planned_quantity numeric not null default 0,
    bom_id text,
    work_order_id text,
    material_request_id uuid
  )`;
}

function nextNumber(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${randomUUID().slice(0, 4).toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Workstations
// ---------------------------------------------------------------------------

export async function listWorkstations(tenantSlug: string) {
  await ensurePlanningTables();
  return (await db.query(
    `SELECT * FROM manufacturing_workstations WHERE tenant_slug = $1 ORDER BY code`, [tenantSlug])).rows;
}

export async function upsertWorkstation(input: {
  tenantSlug: string;
  name: string;
  code: string;
  workstationType?: string;
  laborRate?: number;
  overheadRate?: number;
  capacityHoursPerDay?: number;
  workingHours?: Record<string, string[]>;
  enabled?: boolean;
}) {
  await ensurePlanningTables();
  return (await db.query(
    `INSERT INTO manufacturing_workstations
       (tenant_slug, name, code, workstation_type, labor_rate, overhead_rate, capacity_hours_per_day, working_hours, enabled)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (tenant_slug, code) DO UPDATE SET
       name = excluded.name, workstation_type = excluded.workstation_type,
       labor_rate = excluded.labor_rate, overhead_rate = excluded.overhead_rate,
       capacity_hours_per_day = excluded.capacity_hours_per_day,
       working_hours = excluded.working_hours, enabled = excluded.enabled
     RETURNING *`,
    [input.tenantSlug, input.name, input.code, input.workstationType ?? null,
     input.laborRate ?? 0, input.overheadRate ?? 0, input.capacityHoursPerDay ?? 8,
     input.workingHours ? JSON.stringify(input.workingHours) : null, input.enabled ?? true])).rows[0];
}

// ---------------------------------------------------------------------------
// Routings
// ---------------------------------------------------------------------------

export async function listRoutings(tenantSlug: string) {
  await ensurePlanningTables();
  const routings = (await db.query(
    `SELECT * FROM manufacturing_routings WHERE tenant_slug = $1 AND enabled ORDER BY name`, [tenantSlug])).rows;
  if (!routings.length) return [];
  const ops = (await db.query(
    `SELECT o.*, w.name AS workstation_name FROM manufacturing_routing_operations o
     LEFT JOIN manufacturing_workstations w ON w.id = o.workstation_id
     WHERE o.routing_id = ANY($1::uuid[]) ORDER BY o.routing_id, o.sequence`,
    [routings.map((r: any) => r.id)])).rows;
  return routings.map((r: any) => ({ ...r, operations: ops.filter((o: any) => o.routing_id === r.id) }));
}

export async function upsertRouting(input: {
  tenantSlug: string;
  name: string;
  description?: string | null;
  operations: { name: string; workstationId?: string | null; standardMinutes?: number }[];
}) {
  await ensurePlanningTables();
  const row = (await db.query(
    `INSERT INTO manufacturing_routings (tenant_slug, name, description)
     VALUES ($1,$2,$3)
     ON CONFLICT (tenant_slug, name) DO UPDATE SET description = excluded.description
     RETURNING *`,
    [input.tenantSlug, input.name, input.description ?? null])).rows[0];
  await db.query(`DELETE FROM manufacturing_routing_operations WHERE routing_id = $1`, [row.id]);
  for (const [idx, op] of input.operations.entries()) {
    await db.query(
      `INSERT INTO manufacturing_routing_operations (routing_id, sequence, name, workstation_id, standard_minutes)
       VALUES ($1,$2,$3,$4,$5)`,
      [row.id, idx + 1, op.name, op.workstationId ?? null, op.standardMinutes ?? 0]);
  }
  return row;
}

// ---------------------------------------------------------------------------
// Job cards
// ---------------------------------------------------------------------------

/** Create job cards from a work order's operations (one per operation). */
export async function createJobCardsForWorkOrder(tenantSlug: string, workOrderId: string) {
  await ensurePlanningTables();
  const ops = (await db.query(
    `SELECT * FROM work_order_operations WHERE work_order_id = $1 ORDER BY sequence`, [workOrderId])).rows;
  const wo = (await db.query(
    `SELECT * FROM work_orders WHERE id = $1 AND tenant_slug = $2`, [workOrderId, tenantSlug])).rows[0];
  if (!wo) throw new Error("Work order not found");

  const cards = [];
  for (const op of ops) {
    const existing = (await db.query(
      `SELECT id FROM manufacturing_job_cards WHERE tenant_slug = $1 AND operation_id = $2`,
      [tenantSlug, op.id])).rows[0];
    if (existing) { cards.push(existing); continue; }
    const ws = op.work_center
      ? (await db.query(
          `SELECT id FROM manufacturing_workstations WHERE tenant_slug = $1 AND code = $2`,
          [tenantSlug, op.work_center])).rows[0]
      : null;
    const row = (await db.query(
      `INSERT INTO manufacturing_job_cards
         (tenant_slug, job_card_number, work_order_id, operation_id, operation_name,
          workstation_id, planned_quantity, planned_minutes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [tenantSlug, nextNumber("JC"), workOrderId, op.id, op.name,
       ws?.id ?? null, wo.quantity ?? 0, op.standard_minutes ?? 0])).rows[0];
    cards.push(row);
  }
  return cards;
}

export async function listJobCards(tenantSlug: string, workOrderId?: string) {
  await ensurePlanningTables();
  const cards = workOrderId
    ? (await db.query(`SELECT * FROM manufacturing_job_cards WHERE tenant_slug = $1 AND work_order_id = $2 ORDER BY created_at`, [tenantSlug, workOrderId])).rows
    : (await db.query(`SELECT * FROM manufacturing_job_cards WHERE tenant_slug = $1 ORDER BY created_at DESC`, [tenantSlug])).rows;
  return cards;
}

export async function getJobCard(tenantSlug: string, id: string) {
  await ensurePlanningTables();
  const card = (await db.query(
    `SELECT * FROM manufacturing_job_cards WHERE id = $1 AND tenant_slug = $2`, [id, tenantSlug])).rows[0];
  if (!card) return null;
  const logs = (await db.query(
    `SELECT * FROM manufacturing_job_card_time_logs WHERE job_card_id = $1 ORDER BY started_at`, [id])).rows;
  return { ...card, timeLogs: logs };
}

/** Log time against a job card; roll up minutes + completed qty + cost. */
export async function logJobCardTime(input: {
  tenantSlug: string;
  jobCardId: string;
  employeeId?: string | null;
  startedAt: string;
  endedAt?: string | null;
  minutes?: number;
  completedQuantity?: number;
  notes?: string | null;
}) {
  await ensurePlanningTables();
  const card = (await db.query(
    `SELECT jc.*, w.labor_rate, w.overhead_rate
     FROM manufacturing_job_cards jc
     LEFT JOIN manufacturing_workstations w ON w.id = jc.workstation_id
     WHERE jc.id = $1 AND jc.tenant_slug = $2`,
    [input.jobCardId, input.tenantSlug])).rows[0];
  if (!card) throw new Error("Job card not found");
  if (["completed", "cancelled"].includes(card.status)) throw new Error(`Job card is ${card.status}`);

  const minutes = input.minutes ?? (input.endedAt
    ? Math.max(0, (new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime()) / 60000)
    : 0);

  await db.query(
    `INSERT INTO manufacturing_job_card_time_logs (job_card_id, employee_id, started_at, ended_at, minutes, completed_quantity, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [input.jobCardId, input.employeeId ?? null, input.startedAt, input.endedAt ?? null,
     minutes, input.completedQuantity ?? 0, input.notes ?? null]);

  const laborCost = (Number(card.labor_rate ?? 0) / 60) * minutes;
  const overheadCost = (Number(card.overhead_rate ?? 0) / 60) * minutes;
  await db.query(
    `UPDATE manufacturing_job_cards
     SET actual_minutes = actual_minutes + $1,
         completed_quantity = completed_quantity + $2,
         labor_cost = labor_cost + $3,
         overhead_cost = overhead_cost + $4,
         status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
         started_at = coalesce(started_at, now()),
         updated_at = now()
     WHERE id = $5`,
    [minutes, input.completedQuantity ?? 0, laborCost, overheadCost, input.jobCardId]);
  return getJobCard(input.tenantSlug, input.jobCardId);
}

export async function completeJobCard(tenantSlug: string, jobCardId: string) {
  await ensurePlanningTables();
  const row = (await db.query(
    `UPDATE manufacturing_job_cards
     SET status = 'completed', completed_at = now(), updated_at = now()
     WHERE id = $1 AND tenant_slug = $2 AND status IN ('open','in_progress','paused')
     RETURNING *`,
    [jobCardId, tenantSlug])).rows[0];
  if (!row) throw new Error("Job card not found or already closed");
  return row;
}

// ---------------------------------------------------------------------------
// Sales forecasts
// ---------------------------------------------------------------------------

export async function listForecasts(tenantSlug: string, from?: string, to?: string) {
  await ensurePlanningTables();
  return (await db.query(
    `SELECT * FROM manufacturing_sales_forecasts WHERE tenant_slug = $1
       AND ($2::date IS NULL OR forecast_date >= $2::date)
       AND ($3::date IS NULL OR forecast_date <= $3::date)
     ORDER BY forecast_date, product_sku`,
    [tenantSlug, from ?? null, to ?? null])).rows;
}

export async function upsertForecast(input: {
  tenantSlug: string;
  productSku: string;
  forecastDate: string;
  quantity: number;
  notes?: string | null;
}) {
  await ensurePlanningTables();
  return (await db.query(
    `INSERT INTO manufacturing_sales_forecasts (tenant_slug, product_sku, forecast_date, forecast_quantity, notes)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [input.tenantSlug, input.productSku, input.forecastDate, input.quantity, input.notes ?? null])).rows[0];
}

// ---------------------------------------------------------------------------
// Production plans
// ---------------------------------------------------------------------------

/**
 * Build a production plan: aggregates open sales-order demand and forecast
 * demand per manufactured SKU, nets against on-hand + WIP, and computes
 * planned quantities. Sales-order items are matched to SKUs via product_id
 * or SKU fields on the order's JSON items.
 */
export async function createProductionPlan(input: {
  tenantSlug: string;
  planName: string;
  periodStart?: string;
  periodEnd?: string;
  includeSalesOrders?: boolean;
  includeForecasts?: boolean;
  createdBy?: string;
}) {
  await ensurePlanningTables();
  const row = (await db.query(
    `INSERT INTO manufacturing_production_plans
       (tenant_slug, plan_number, plan_name, period_start, period_end, include_sales_orders, include_forecasts, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [input.tenantSlug, nextNumber("PP"), input.planName,
     input.periodStart ?? null, input.periodEnd ?? null,
     input.includeSalesOrders ?? true, input.includeForecasts ?? true,
     input.createdBy ?? null])).rows[0];

  // Demand aggregation: SO items (JSON) + forecasts, keyed by SKU
  const demand = new Map<string, { soQty: number; fcQty: number; name?: string }>();

  if (input.includeSalesOrders !== false) {
    const orders = (await db.query(
      `SELECT i.sku, sum(i.quantity) AS qty, min(i.product_name) AS name
       FROM sales_order_items i
       JOIN sales_orders so ON so.id = i.order_id AND so.tenant_slug = i.tenant_slug
       WHERE i.tenant_slug = $1 AND so.status NOT IN ('Completed','Delivered','Fulfilled','Cancelled')
       GROUP BY i.sku`,
      [input.tenantSlug])).rows;
    for (const o of orders) {
      if (!o.sku) continue;
      const d = demand.get(o.sku) ?? { soQty: 0, fcQty: 0 };
      d.soQty += Number(o.qty);
      d.name = d.name ?? o.name;
      demand.set(o.sku, d);
    }
  }

  if (input.includeForecasts !== false) {
    const forecasts = (await db.query(
      `SELECT product_sku, sum(forecast_quantity - consumed_quantity) AS qty
       FROM manufacturing_sales_forecasts
       WHERE tenant_slug = $1
         AND ($2::date IS NULL OR forecast_date >= $2::date)
         AND ($3::date IS NULL OR forecast_date <= $3::date)
       GROUP BY product_sku`,
      [input.tenantSlug, input.periodStart ?? null, input.periodEnd ?? null])).rows;
    for (const f of forecasts) {
      const d = demand.get(f.product_sku) ?? { soQty: 0, fcQty: 0 };
      d.fcQty += Number(f.qty);
      demand.set(f.product_sku, d);
    }
  }

  // Net each demanded SKU against on-hand + WIP, resolve BOM
  for (const [sku, d] of demand) {
    const product = (await db.query(
      `SELECT name, current_stock FROM inventory_products WHERE tenant_slug = $1 AND sku = $2`,
      [input.tenantSlug, sku])).rows[0];
    const wip = (await db.query(
      `SELECT COALESCE(sum(quantity),0) AS qty FROM work_orders
       WHERE tenant_slug = $1 AND product_sku = $2 AND status IN ('released','in_progress')`,
      [input.tenantSlug, sku])).rows[0];
    const bom = (await db.query(
      `SELECT id FROM bom_headers WHERE tenant_slug = $1 AND product_sku = $2 AND status = 'active' LIMIT 1`,
      [input.tenantSlug, sku])).rows[0] ?? null;

    const demanded = d.soQty + d.fcQty;
    const onHand = Number(product?.current_stock ?? 0);
    const wipQty = Number(wip?.qty ?? 0);
    const planned = Math.max(0, demanded - onHand - wipQty);

    await db.query(
      `INSERT INTO manufacturing_production_plan_items
         (plan_id, product_sku, product_name, demanded_quantity, sales_order_quantity,
          forecast_quantity, on_hand_quantity, wip_quantity, planned_quantity, bom_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [row.id, sku, d.name ?? product?.name ?? sku, demanded, d.soQty, d.fcQty, onHand, wipQty, planned, bom?.id ?? null]);
  }
  return getProductionPlan(input.tenantSlug, row.id);
}

export async function getProductionPlan(tenantSlug: string, id: string) {
  await ensurePlanningTables();
  const plan = (await db.query(
    `SELECT * FROM manufacturing_production_plans WHERE id = $1 AND tenant_slug = $2`, [id, tenantSlug])).rows[0];
  if (!plan) return null;
  const items = (await db.query(
    `SELECT * FROM manufacturing_production_plan_items WHERE plan_id = $1 ORDER BY product_sku`, [id])).rows;
  return { ...plan, items };
}

export async function listProductionPlans(tenantSlug: string) {
  await ensurePlanningTables();
  return (await db.query(
    `SELECT p.*, (SELECT count(*) FROM manufacturing_production_plan_items i WHERE i.plan_id = p.id)::int AS item_count
     FROM manufacturing_production_plans p WHERE p.tenant_slug = $1 ORDER BY p.created_at DESC`, [tenantSlug])).rows;
}

/**
 * Execute a production plan: create work orders for manufactured items
 * (planned_quantity > 0 with a BOM) and material requests for raw-material
 * shortages exploded from those BOMs.
 */
export async function executeProductionPlan(tenantSlug: string, planId: string, userId?: string) {
  await ensurePlanningTables();
  const plan = (await db.query(
    `UPDATE manufacturing_production_plans SET status = 'in_progress', updated_at = now()
     WHERE id = $1 AND tenant_slug = $2 AND status IN ('draft','submitted') RETURNING *`,
    [planId, tenantSlug])).rows[0];
  if (!plan) throw new Error("Plan not found or already executed");

  const items = (await db.query(
    `SELECT * FROM manufacturing_production_plan_items WHERE plan_id = $1 AND planned_quantity > 0`, [planId])).rows;

  let woCount = 0;
  const componentDemand = new Map<string, number>();

  for (const item of items) {
    // Resolve BOM for routing + component explosion
    const bom = item.bom_id
      ? (await db.query(`SELECT * FROM bom_headers WHERE id = $1`, [item.bom_id])).rows[0]
      : null;
    const wo = await createWorkOrder({
      tenantSlug,
      productSku: item.product_sku,
      productName: item.product_name ?? item.product_sku,
      bomId: item.bom_id ?? undefined,
      quantity: Number(item.planned_quantity),
      notes: `Production plan ${plan.plan_number}`,
      createdBy: userId,
    });
    await db.query(
      `UPDATE manufacturing_production_plan_items SET work_order_id = $1 WHERE id = $2`,
      [wo.id, item.id]);
    woCount++;

    if (bom) {
      const components = (await db.query(
        `SELECT * FROM bom_lines WHERE bom_id = $1`, [bom.id])).rows;
      for (const c of components) {
        const need = Number(c.quantity ?? c.qty ?? 0) * Number(item.planned_quantity) / Math.max(1, Number(bom.quantity ?? bom.output_quantity ?? 1));
        componentDemand.set(c.component_sku ?? c.sku, (componentDemand.get(c.component_sku ?? c.sku) ?? 0) + need);
      }
    }
  }

  // Material requests for component shortages
  let mrCount = 0;
  for (const [sku, need] of componentDemand) {
    const product = (await db.query(
      `SELECT name, current_stock FROM inventory_products WHERE tenant_slug = $1 AND sku = $2`,
      [tenantSlug, sku])).rows[0];
    const shortage = need - Number(product?.current_stock ?? 0);
    if (shortage <= 0) continue;
    const mr = await createMaterialRequest({
      tenantSlug,
      requestType: "purchase",
      requestedBy: userId ?? "production-plan",
      notes: `Production plan ${plan.plan_number} — component shortage`,
      items: [{ productId: sku, productName: product?.name ?? sku, quantity: shortage }],
    });
    await db.query(`UPDATE material_requests SET status = 'open' WHERE id = $1`, [(mr as any).id]);
    mrCount++;
  }

  await db.query(
    `UPDATE manufacturing_production_plans
     SET generated_work_orders = $1, generated_material_requests = $2, updated_at = now()
     WHERE id = $3`,
    [woCount, mrCount, planId]);

  writeFinanceEvent({
    tenantSlug,
    eventType: "journal_posted",
    sourceModule: "manufacturing",
    sourceRecordId: planId,
    userId,
    metadata: { planNumber: plan.plan_number, workOrders: woCount, materialRequests: mrCount },
  }).catch(() => {});

  return { workOrdersCreated: woCount, materialRequestsCreated: mrCount };
}
