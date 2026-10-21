import { db } from "@/lib/sql-client";

// Manufacturing edge features: plant floors, downtime tracking,
// sub-operations, master production schedules, BOM update tool.

// ── Plant floors ───────────────────────────────────────────────────────────

export async function listPlantFloors(tenantSlug: string) {
  return (await db.query<any>(
    `select * from plant_floors where tenant_slug = $1 order by name`, [tenantSlug]
  )).rows;
}

export async function createPlantFloor(input: {
  tenantSlug: string; name: string; code?: string; warehouseId?: string;
}) {
  return (await db.query<any>(
    `insert into plant_floors (tenant_slug, name, code, warehouse_id)
     values ($1,$2,$3,$4) returning *`,
    [input.tenantSlug, input.name, input.code ?? null, input.warehouseId ?? null]
  )).rows[0];
}

// ── Downtime entries ───────────────────────────────────────────────────────

export async function listDowntime(tenantSlug: string, workstationId?: string, workOrderId?: string) {
  const conds = ["tenant_slug = $1"];
  const params: any[] = [tenantSlug];
  if (workstationId) { params.push(workstationId); conds.push(`workstation_id = $${params.length}`); }
  if (workOrderId) { params.push(workOrderId); conds.push(`work_order_id = $${params.length}`); }
  return (await db.query<any>(
    `select d.*, w.name as workstation_name from downtime_entries d
     left join manufacturing_workstations w on w.id = d.workstation_id
     where ${conds.join(" and ")} order by from_ts desc`, params
  )).rows;
}

export async function recordDowntime(input: {
  tenantSlug: string; workstationId?: string; workOrderId?: string;
  plantFloorId?: string; fromTs: string; toTs?: string;
  reason: string; category?: string; operator?: string;
}) {
  return (await db.query<any>(
    `insert into downtime_entries (tenant_slug, workstation_id, work_order_id,
       plant_floor_id, from_ts, to_ts, reason, category, operator)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
    [input.tenantSlug, input.workstationId ?? null, input.workOrderId ?? null,
     input.plantFloorId ?? null, input.fromTs, input.toTs ?? null,
     input.reason, input.category ?? "other", input.operator ?? null]
  )).rows[0];
}

export async function endDowntime(tenantSlug: string, id: string) {
  return (await db.query<any>(
    `update downtime_entries set to_ts = now()
     where id = $1 and tenant_slug = $2 and to_ts is null returning *`,
    [id, tenantSlug]
  )).rows[0];
}

/** Downtime rollup per workstation for OEE-style reporting. */
export async function downtimeSummary(tenantSlug: string, fromDate?: string, toDate?: string) {
  return (await db.query<any>(
    `select workstation_id, w.name as workstation_name, category,
            count(*) as entries,
            sum(extract(epoch from (coalesce(to_ts, now()) - from_ts))/3600.0) as hours
     from downtime_entries d
     left join manufacturing_workstations w on w.id = d.workstation_id
     where d.tenant_slug = $1
       ${fromDate ? "and d.from_ts >= $2" : ""}
       ${toDate ? `and d.from_ts <= $${fromDate ? 3 : 2}` : ""}
     group by workstation_id, w.name, category order by hours desc`,
    [tenantSlug, ...(fromDate ? [fromDate] : []), ...(toDate ? [toDate] : [])]
  )).rows;
}

// ── Sub-operations ─────────────────────────────────────────────────────────

export async function listSubOperations(tenantSlug: string, workOrderId?: string, operationId?: string) {
  const conds = ["tenant_slug = $1"];
  const params: any[] = [tenantSlug];
  if (workOrderId) { params.push(workOrderId); conds.push(`work_order_id = $${params.length}`); }
  if (operationId) { params.push(operationId); conds.push(`operation_id = $${params.length}`); }
  return (await db.query<any>(
    `select * from mfg_sub_operations where ${conds.join(" and ")}
     order by created_at`, params
  )).rows;
}

export async function createSubOperation(input: {
  tenantSlug: string; workOrderId: string; operationId: string;
  name: string; workstationId?: string; plannedMinutes?: number;
}) {
  return (await db.query<any>(
    `insert into mfg_sub_operations (tenant_slug, work_order_id, operation_id,
       name, workstation_id, planned_minutes)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [input.tenantSlug, input.workOrderId, input.operationId, input.name,
     input.workstationId ?? null, input.plannedMinutes ?? null]
  )).rows[0];
}

export async function completeSubOperation(tenantSlug: string, id: string, actualMinutes?: number) {
  return (await db.query<any>(
    `update mfg_sub_operations set status='completed',
       actual_minutes = coalesce($3, actual_minutes)
     where id = $1 and tenant_slug = $2 returning *`,
    [id, tenantSlug, actualMinutes ?? null]
  )).rows[0];
}

// ── Master production schedule ─────────────────────────────────────────────

export async function listMps(tenantSlug: string) {
  return (await db.query<any>(
    `select * from master_production_schedules where tenant_slug = $1
     order by created_at desc`, [tenantSlug]
  )).rows;
}

export async function getMps(tenantSlug: string, id: string) {
  const mps = (await db.query<any>(
    `select * from master_production_schedules where id = $1 and tenant_slug = $2`,
    [id, tenantSlug]
  )).rows[0];
  if (!mps) return null;
  const items = (await db.query<any>(
    `select * from mps_items where mps_id = $1 order by product_sku`, [id]
  )).rows;
  return { ...mps, items };
}

/**
 * Build an MPS: demand = sales forecasts + open SO lines in the window,
 * netted against on-hand stock; planned_qty = max(0, demand - on_hand).
 */
export async function buildMps(input: {
  tenantSlug: string; name: string; periodFrom: string; periodTo: string;
  createdBy?: string;
}) {
  const mps = (await db.query<any>(
    `insert into master_production_schedules (tenant_slug, name, period_from,
       period_to, created_by)
     values ($1,$2,$3,$4,$5) returning *`,
    [input.tenantSlug, input.name, input.periodFrom, input.periodTo,
     input.createdBy ?? null]
  )).rows[0];

  const forecast = (await db.query<any>(
    `select product_sku, sum(forecast_quantity) as qty
     from manufacturing_sales_forecasts
     where tenant_slug = $1 and forecast_date between $2 and $3
     group by product_sku`,
    [input.tenantSlug, input.periodFrom, input.periodTo]
  )).rows;

  // sales_order_items is a trigger-maintained normalized view of the
  // sales_orders.items JSON — aggregate per-SKU in SQL.
  const soRows = (await db.query<any>(
    `select i.sku, sum(i.quantity) as qty
     from sales_order_items i
     join sales_orders so on so.id = i.order_id and so.tenant_slug = i.tenant_slug
     where i.tenant_slug = $1 and so.status not in ('Cancelled','Fulfilled','Closed')
       and coalesce(so.due_date::date, so.created_at::date) between $2 and $3
     group by i.sku`,
    [input.tenantSlug, input.periodFrom, input.periodTo]
  )).rows;
  const orderQty: Record<string, number> = {};
  for (const r of soRows) {
    if (r.sku) orderQty[r.sku] = Number(r.qty);
  }

  const skus = new Set([...forecast.map((f: any) => f.product_sku), ...Object.keys(orderQty)]);
  for (const sku of skus) {
    const fQty = Number(forecast.find((f: any) => f.product_sku === sku)?.qty ?? 0);
    const oQty = orderQty[sku] ?? 0;
    const onHand = (await db.query<any>(
      `select coalesce(sum(quantity), 0) as q from inventory_stock_balances
       where tenant_slug = $1 and product_sku = $2`,
      [input.tenantSlug, sku]
    )).rows[0]?.q ?? 0;
    const planned = Math.max(0, Math.max(fQty, oQty) - Number(onHand));
    await db.query(
      `insert into mps_items (tenant_slug, mps_id, product_sku, forecast_qty,
         order_qty, on_hand, planned_qty)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [input.tenantSlug, mps.id, sku, fQty, oQty, Number(onHand), planned]
    );
  }
  return getMps(input.tenantSlug, mps.id);
}

export async function setMpsStatus(tenantSlug: string, id: string, status: "confirmed" | "closed") {
  return (await db.query<any>(
    `update master_production_schedules set status = $3
     where id = $1 and tenant_slug = $2 and status = 'draft' returning *`,
    [id, tenantSlug, status]
  )).rows[0];
}

// ── BOM update tool ────────────────────────────────────────────────────────
// Replace a component item across all active BOMs, or recompute BOM costs.

export async function replaceBomComponent(input: {
  tenantSlug: string; oldSku: string; newSku: string;
}) {
  const res = await db.query<any>(
    `update bom_lines set component_sku = $3
     from bom_headers h
     where bom_lines.bom_id = h.id and h.tenant_slug = $1
       and h.status = 'active' and bom_lines.component_sku = $2`,
    [input.tenantSlug, input.oldSku, input.newSku]
  );
  return { updatedLines: res.rowCount };
}

export async function recomputeBomCosts(tenantSlug: string) {
  const res = await db.query<any>(
    `update bom_headers h set material_cost = sub.total, updated_at = now()
     from (
       select l.bom_id, sum(l.quantity * coalesce(p.unit_cost, 0)) as total
       from bom_lines l
       left join inventory_products p
         on p.sku = l.component_sku and p.tenant_slug = $1
       group by l.bom_id
     ) sub
     where h.id = sub.bom_id and h.tenant_slug = $1`,
    [tenantSlug]
  );
  return { updatedBoms: res.rowCount };
}
