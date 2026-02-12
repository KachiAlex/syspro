import { db, sql as SQL, SqlClient } from "@/lib/sql-client";

/* using imported SQL */

type ReportStatus = "queued" | "running" | "succeeded" | "failed";

export async function ensureReportingTables(sql: SqlClient = SQL) {
  await sql`create extension if not exists "pgcrypto"`;
  await sql`
    create table if not exists reports (
      id uuid primary key default gen_random_uuid(),
      tenant_slug text not null,
      name text not null,
      report_type text not null,
      definition jsonb not null,
      filters jsonb,
      schedule text,
      enabled boolean default true,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`
    create table if not exists report_jobs (
      id uuid primary key default gen_random_uuid(),
      report_id uuid not null references reports(id) on delete cascade,
      tenant_slug text not null,
      requested_by text,
      status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
      filters jsonb,
      output_location text,
      error text,
      started_at timestamptz,
      completed_at timestamptz,
      attempt_count integer not null default 0,
      created_at timestamptz default now()
    )
  `;

  await sql`alter table report_jobs add column if not exists attempt_count integer not null default 0`;
}

export async function listReports(tenantSlug: string, sql: SqlClient = SQL) {
  await ensureReportingTables(sql);
  const rows = (await db.query(`select * from reports where tenant_slug = $1 order by created_at desc`, [tenantSlug])).rows as any[];
  return rows.map((r: any) => ({
    id: r.id,
    tenantSlug: r.tenant_slug,
    name: r.name,
    reportType: r.report_type,
    definition: r.definition,
    filters: r.filters,
    schedule: r.schedule,
    enabled: r.enabled,
    createdAt: r.created_at?.toISOString?.() ?? r.created_at,
    updatedAt: r.updated_at?.toISOString?.() ?? r.updated_at,
  }));
}

export async function createReport(input: { tenantSlug: string; name: string; reportType: string; definition: any; filters?: any; schedule?: string | null; enabled?: boolean }, sql: SqlClient = SQL) {
  await ensureReportingTables(sql);
  const [row] = await sql`
    insert into reports (tenant_slug, name, report_type, definition, filters, schedule, enabled)
    values (${input.tenantSlug}, ${input.name}, ${input.reportType}, ${JSON.stringify(input.definition)}, ${input.filters || null}, ${input.schedule || null}, ${input.enabled ?? true})
    returning *
  ` as any[];
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    name: row.name,
    reportType: row.report_type,
    definition: row.definition,
    filters: row.filters,
    schedule: row.schedule,
    enabled: row.enabled,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  };
}

export async function updateReport(id: string, tenantSlug: string, updates: Partial<{ name: string; reportType: string; definition: any; filters: any; schedule: string | null; enabled: boolean }>, sql: SqlClient = SQL) {
  await ensureReportingTables(sql);
  const fields: string[] = [];
  const values: any[] = [];
  const push = (frag: string, val: any) => {
    fields.push(frag);
    values.push(val);
  };
  if (updates.name !== undefined) push(`name = $${fields.length + 1}`, updates.name);
  if (updates.reportType !== undefined) push(`report_type = $${fields.length + 1}`, updates.reportType);
  if (updates.definition !== undefined) push(`definition = $${fields.length + 1}`, JSON.stringify(updates.definition));
  if (updates.filters !== undefined) push(`filters = $${fields.length + 1}`, updates.filters);
  if (updates.schedule !== undefined) push(`schedule = $${fields.length + 1}`, updates.schedule);
  if (updates.enabled !== undefined) push(`enabled = $${fields.length + 1}`, updates.enabled);

  if (fields.length === 0) {
    const [current] = await sql`select * from reports where id = ${id} and tenant_slug = ${tenantSlug} limit 1` as any[];
    return current ? mapReportRow(current) : null;
  }
  const query = `update reports set ${fields.join(", ")}, updated_at = now() where id = $${fields.length + 1} and tenant_slug = $${fields.length + 2} returning *`;
  const [row] = (await db.query(query, [...values, id, tenantSlug])).rows as any[];
  return row ? mapReportRow(row) : null;
}

export async function createReportJob(input: { reportId: string; tenantSlug: string; requestedBy?: string; filters?: any; status?: ReportStatus }, sql: SqlClient = SQL) {
  await ensureReportingTables(sql);
  const [row] = await sql`
    insert into report_jobs (report_id, tenant_slug, requested_by, status, filters, started_at)
    values (${input.reportId}, ${input.tenantSlug}, ${input.requestedBy || null}, ${input.status || "queued"}, ${input.filters || null}, now())
    returning *
  ` as any[];
  return row;
}

export async function updateReportJobStatus(id: string, status: ReportStatus, output?: { location?: string; error?: string }, incrementAttempt = false, sql: SqlClient = SQL) {
  await ensureReportingTables(sql);
  const increment = incrementAttempt ? sql`attempt_count = attempt_count + 1,` : sql``;
  const [row] = await sql`
    update report_jobs set ${increment} status = ${status}, output_location = ${output?.location || null}, error = ${output?.error || null}, completed_at = case when ${status} in ('succeeded','failed') then now() else completed_at end where id = ${id}
    returning *
  ` as any[];
  return row;
}

export async function listReportJobs(tenantSlug: string, reportId?: string, sql: SqlClient = SQL) {
  await ensureReportingTables(sql);
  const rows = reportId
    ? (await db.query(`select * from report_jobs where tenant_slug = $1 and report_id = $2 order by created_at desc`, [tenantSlug, reportId])).rows as any[]
    : (await db.query(`select * from report_jobs where tenant_slug = $1 order by created_at desc`, [tenantSlug])).rows as any[];
  return rows.map((r: any) => ({
    id: r.id,
    reportId: r.report_id,
    tenantSlug: r.tenant_slug,
    requestedBy: r.requested_by,
    status: r.status,
    filters: r.filters,
    outputLocation: r.output_location,
    error: r.error,
    startedAt: r.started_at?.toISOString?.() ?? r.started_at,
    completedAt: r.completed_at?.toISOString?.() ?? r.completed_at,
    createdAt: r.created_at?.toISOString?.() ?? r.created_at,
  }));
}

export async function fetchQueuedReportJobs(limit = 25, tenantSlug?: string, maxAttempts = 3, sql: SqlClient = SQL) {
  await ensureReportingTables(sql);
  const rows = tenantSlug
    ? (await db.query(`select * from report_jobs where status = 'queued' and tenant_slug = $1 and attempt_count < $2 order by created_at asc limit $3 for update skip locked`, [tenantSlug, maxAttempts, limit])).rows as any[]
    : (await db.query(`select * from report_jobs where status = 'queued' and attempt_count < $1 order by created_at asc limit $2 for update skip locked`, [maxAttempts, limit])).rows as any[];
  return rows.map((r: any) => ({
    id: r.id,
    reportId: r.report_id,
    tenantSlug: r.tenant_slug,
    requestedBy: r.requested_by,
    status: r.status,
    filters: r.filters,
    outputLocation: r.output_location,
    error: r.error,
    attemptCount: r.attempt_count,
    startedAt: r.started_at?.toISOString?.() ?? r.started_at,
    completedAt: r.completed_at?.toISOString?.() ?? r.completed_at,
    createdAt: r.created_at?.toISOString?.() ?? r.created_at,
  }));
}

function mapReportRow(row: any) {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    name: row.name,
    reportType: row.report_type,
    definition: row.definition,
    filters: row.filters,
    schedule: row.schedule,
    enabled: row.enabled,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  };
}
