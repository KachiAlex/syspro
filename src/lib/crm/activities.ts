import { randomUUID } from "crypto";
import { sql as SQL } from "@/lib/sql-client";
import { logActivity } from "@/lib/crm/db";

export const ACTIVITY_TYPES = ["call", "email", "meeting", "task", "note"] as const;
export const ACTIVITY_STATUSES = ["pending", "completed", "cancelled"] as const;
export const ACTIVITY_RELATED_TYPES = ["lead", "contact", "deal", "customer"] as const;

export type CrmActivityRow = {
  id: string;
  tenantSlug: string;
  type: string;
  title: string;
  description?: string;
  relatedTo: string;
  relatedId: string;
  relatedName: string;
  assignedTo?: string;
  dueDate?: string;
  completedAt?: string;
  status: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
};

let ensured = false;
async function ensureActivitiesTable() {
  if (ensured) return;
  await SQL`
    create table if not exists crm_activities (
      id text primary key,
      tenant_slug text not null,
      type text not null,
      title text not null,
      description text,
      related_to text,
      related_id text,
      related_name text,
      assigned_to text,
      due_date timestamptz,
      completed_at timestamptz,
      status text default 'pending',
      created_by text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await SQL`create index if not exists crm_activities_tenant_idx on crm_activities (tenant_slug)`;
  await SQL`create index if not exists crm_activities_related_idx on crm_activities (tenant_slug, related_to, related_id)`;
  ensured = true;
}

function normalize(row: any): CrmActivityRow {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    type: row.type,
    title: row.title,
    description: row.description ?? undefined,
    relatedTo: row.related_to ?? "",
    relatedId: row.related_id ?? "",
    relatedName: row.related_name ?? "",
    assignedTo: row.assigned_to ?? undefined,
    dueDate: row.due_date ?? undefined,
    completedAt: row.completed_at ?? undefined,
    status: row.status ?? "pending",
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listCrmActivities(params: {
  tenantSlug: string;
  type?: string;
  status?: string;
  relatedTo?: string;
  relatedId?: string;
  search?: string;
  ownerIds?: string[];
  limit?: number;
}): Promise<CrmActivityRow[]> {
  await ensureActivitiesTable();
  const limit = Math.min(params.limit ?? 100, 200);
  const rows = (await SQL`
    select * from crm_activities
    where tenant_slug = ${params.tenantSlug}
      ${params.type ? SQL`and type = ${params.type}` : SQL``}
      ${params.status ? SQL`and status = ${params.status}` : SQL``}
      ${params.relatedTo ? SQL`and related_to = ${params.relatedTo}` : SQL``}
      ${params.relatedId ? SQL`and related_id = ${params.relatedId}` : SQL``}
      ${params.search ? SQL`and (title ilike ${"%" + params.search + "%"} or description ilike ${"%" + params.search + "%"})` : SQL``}
      ${params.ownerIds ? SQL`and (assigned_to = any(${params.ownerIds}) or created_by = any(${params.ownerIds}))` : SQL``}
    order by created_at desc
    limit ${limit}
  `) as any[];
  return rows.map(normalize);
}

export async function getCrmActivity(id: string, tenantSlug: string): Promise<CrmActivityRow | null> {
  await ensureActivitiesTable();
  const rows = (await SQL`
    select * from crm_activities where id = ${id} and tenant_slug = ${tenantSlug} limit 1
  `) as any[];
  return rows[0] ? normalize(rows[0]) : null;
}

export async function insertCrmActivity(params: {
  tenantSlug: string;
  type: string;
  title: string;
  description?: string;
  relatedTo?: string;
  relatedId?: string;
  relatedName?: string;
  assignedTo?: string;
  dueDate?: string;
  status?: string;
  createdBy?: string;
}): Promise<CrmActivityRow> {
  await ensureActivitiesTable();
  const id = `act_${randomUUID()}`;
  const rows = (await SQL`
    insert into crm_activities (
      id, tenant_slug, type, title, description, related_to, related_id,
      related_name, assigned_to, due_date, status, created_by
    ) values (
      ${id}, ${params.tenantSlug}, ${params.type}, ${params.title},
      ${params.description ?? null}, ${params.relatedTo ?? null},
      ${params.relatedId ?? null}, ${params.relatedName ?? null},
      ${params.assignedTo ?? null},
      ${params.dueDate ? new Date(params.dueDate).toISOString() : null},
      ${params.status ?? "pending"}, ${params.createdBy ?? null}
    )
    returning *
  `) as any[];

  if (params.relatedTo && params.relatedId) {
    await logActivity({
      tenantSlug: params.tenantSlug,
      entityType: params.relatedTo as "lead" | "contact" | "customer" | "deal",
      entityId: params.relatedId,
      action: "activity_created",
      description: `Activity "${params.title}" created`,
      metadata: { activityId: id, type: params.type },
    }).catch(() => {});
  }

  return normalize(rows[0]);
}

export async function updateCrmActivity(
  id: string,
  tenantSlug: string,
  updates: {
    type?: string;
    title?: string;
    description?: string;
    relatedTo?: string;
    relatedId?: string;
    relatedName?: string;
    assignedTo?: string;
    dueDate?: string | null;
    status?: string;
  }
): Promise<CrmActivityRow | null> {
  await ensureActivitiesTable();
  // Completed timestamp follows status transitions.
  const completedAtFragment =
    updates.status === "completed"
      ? SQL`completed_at = now()`
      : updates.status !== undefined
        ? SQL`completed_at = null`
        : SQL`completed_at = completed_at`;

  const rows = (await SQL`
    update crm_activities set
      type = coalesce(${updates.type ?? null}, type),
      title = coalesce(${updates.title ?? null}, title),
      description = coalesce(${updates.description ?? null}, description),
      related_to = coalesce(${updates.relatedTo ?? null}, related_to),
      related_id = coalesce(${updates.relatedId ?? null}, related_id),
      related_name = coalesce(${updates.relatedName ?? null}, related_name),
      assigned_to = coalesce(${updates.assignedTo ?? null}, assigned_to),
      due_date = coalesce(${updates.dueDate ? new Date(updates.dueDate).toISOString() : null}, due_date),
      status = coalesce(${updates.status ?? null}, status),
      ${completedAtFragment},
      updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug}
    returning *
  `) as any[];

  if (!rows[0]) return null;

  if (rows[0].related_to && rows[0].related_id) {
    await logActivity({
      tenantSlug,
      entityType: rows[0].related_to as "lead" | "contact" | "customer" | "deal",
      entityId: rows[0].related_id,
      action: "activity_updated",
      description: `Activity "${rows[0].title}" updated`,
      metadata: { activityId: id, updates: Object.keys(updates) },
    }).catch(() => {});
  }

  return normalize(rows[0]);
}

export async function deleteCrmActivity(id: string, tenantSlug: string): Promise<boolean> {
  await ensureActivitiesTable();
  const rows = (await SQL`
    delete from crm_activities where id = ${id} and tenant_slug = ${tenantSlug} returning id
  `) as any[];
  return rows.length > 0;
}
