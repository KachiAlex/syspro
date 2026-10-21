import { db } from "@/lib/sql-client";

// Project edge features: task types, activity types + per-employee cost rates,
// project updates, installation notes.

// ── Task types ─────────────────────────────────────────────────────────────

export async function listTaskTypes(tenantSlug: string) {
  return (await db.query<any>(
    `select * from task_types where tenant_slug = $1 order by name`, [tenantSlug]
  )).rows;
}

export async function createTaskType(input: {
  tenantSlug: string; name: string; description?: string; color?: string;
}) {
  return (await db.query<any>(
    `insert into task_types (tenant_slug, name, description, color)
     values ($1,$2,$3,$4) on conflict do nothing returning *`,
    [input.tenantSlug, input.name, input.description ?? null, input.color ?? null]
  )).rows[0];
}

// ── Activity types + cost rates ────────────────────────────────────────────

export async function listActivityTypes(tenantSlug: string) {
  return (await db.query<any>(
    `select a.*, coalesce(json_agg(c.*) filter (where c.id is not null), '[]') as costs
     from activity_types a
     left join activity_costs c on c.activity_type_id = a.id and c.tenant_slug = a.tenant_slug
     where a.tenant_slug = $1 group by a.id order by a.name`,
    [tenantSlug]
  )).rows;
}

export async function createActivityType(input: {
  tenantSlug: string; name: string; defaultRate?: number;
}) {
  return (await db.query<any>(
    `insert into activity_types (tenant_slug, name, default_rate)
     values ($1,$2,$3) on conflict do nothing returning *`,
    [input.tenantSlug, input.name, input.defaultRate ?? null]
  )).rows[0];
}

export async function setActivityCost(input: {
  tenantSlug: string; activityTypeId: string; employeeId?: string;
  billingRate: number; costRate?: number; currency?: string;
}) {
  return (await db.query<any>(
    `insert into activity_costs (tenant_slug, activity_type_id, employee_id,
       billing_rate, cost_rate, currency)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [input.tenantSlug, input.activityTypeId, input.employeeId ?? null,
     input.billingRate, input.costRate ?? 0, input.currency ?? "NGN"]
  )).rows[0];
}

// ── Project updates (status reports sent to stakeholders) ──────────────────

export async function listProjectUpdates(tenantSlug: string, projectId: string) {
  return (await db.query<any>(
    `select * from project_updates where tenant_slug = $1 and project_id = $2
     order by update_date desc`,
    [tenantSlug, projectId]
  )).rows;
}

export async function createProjectUpdate(input: {
  tenantSlug: string; projectId: string; summary: string; status?: string;
  blockers?: string; percentComplete?: number; sentTo?: string; createdBy?: string;
}) {
  return (await db.query<any>(
    `insert into project_updates (tenant_slug, project_id, summary, status,
       blockers, percent_complete, sent_to, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [input.tenantSlug, input.projectId, input.summary, input.status ?? null,
     input.blockers ?? null, input.percentComplete ?? null,
     input.sentTo ?? null, input.createdBy ?? null]
  )).rows[0];
}

// ── Installation notes ─────────────────────────────────────────────────────

async function nextNoteNumber(tenantSlug: string) {
  const r = (await db.query<any>(
    `select count(*) + 1 as n from installation_notes where tenant_slug = $1`,
    [tenantSlug]
  )).rows[0];
  return `IN-${String(r.n).padStart(5, "0")}`;
}

export async function listInstallationNotes(tenantSlug: string, customerId?: string) {
  const conds = ["tenant_slug = $1"];
  const params: any[] = [tenantSlug];
  if (customerId) { params.push(customerId); conds.push(`customer_id = $${params.length}`); }
  return (await db.query<any>(
    `select * from installation_notes where ${conds.join(" and ")}
     order by created_at desc`, params
  )).rows;
}

export async function createInstallationNote(input: {
  tenantSlug: string; customerId?: string; customerName: string;
  invoiceId?: string; salesOrderId?: string; installationDate?: string;
  items?: { sku: string; name?: string; qty?: number; serial?: string }[];
  remarks?: string; createdBy?: string;
}) {
  const num = await nextNoteNumber(input.tenantSlug);
  return (await db.query<any>(
    `insert into installation_notes (tenant_slug, note_number, customer_id,
       customer_name, invoice_id, sales_order_id, installation_date, items,
       remarks, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
    [input.tenantSlug, num, input.customerId ?? null, input.customerName,
     input.invoiceId ?? null, input.salesOrderId ?? null,
     input.installationDate ?? null, JSON.stringify(input.items ?? []),
     input.remarks ?? null, input.createdBy ?? null]
  )).rows[0];
}

export async function updateInstallationStatus(tenantSlug: string, id: string, status: "submitted" | "cancelled") {
  return (await db.query<any>(
    `update installation_notes set status = $3
     where id = $1 and tenant_slug = $2 and status = 'draft' returning *`,
    [id, tenantSlug, status]
  )).rows[0];
}
