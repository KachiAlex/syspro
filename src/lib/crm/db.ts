import { randomUUID } from "crypto";
import { db, sql as SQL, SqlClient } from "@/lib/sql-client";
import type {
  CrmLeadStage,
  CrmLeadSource,
  CrmPipelineStage,
  CrmCustomerRecord,
  CrmContactRecord,
  CrmContact,
} from "./types";

/* using imported SQL */

function serializeTextArray(values?: string[] | null): string {
  if (!values || values.length === 0) {
    return "{}";
  }
  const escaped = values.map((value) => {
    const safe = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${safe}"`;
  });
  return `{${escaped.join(",")}}`;
}

export async function ensureCrmTables(sql: SqlClient = SQL) {
  await sql`
    create table if not exists crm_leads (
      id text primary key,
      tenant_slug text not null,
      region_id text not null,
      branch_id text not null,
      company_name text not null,
      contact_name text not null,
      contact_email text,
      contact_phone text,
      source text not null,
      stage text not null,
      score integer default 0,
      assigned_officer_id text,
      expected_value numeric,
      currency text,
      notes text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`
    create table if not exists crm_deals (
      id text primary key,
      tenant_slug text not null,
      customer_id text,
      lead_id text,
      stage text not null,
      value numeric not null,
      currency text not null,
      probability integer,
      expected_close date,
      assigned_officer_id text,
      status text default 'open',
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`
    create table if not exists crm_customers (
      id text primary key,
      tenant_slug text not null,
      region_id text not null,
      branch_id text not null,
      name text not null,
      primary_contact jsonb,
      status text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`
    create table if not exists crm_contacts (
      id text primary key,
      tenant_slug text not null,
      company text not null,
      contact_name text not null,
      contact_email text,
      contact_phone text,
      source text,
      status text default 'New',
      tags text[] default array[]::text[],
      imported_at timestamptz default now(),
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`
    create table if not exists crm_conversions (
      id text primary key,
      tenant_slug text not null,
      lead_id text not null,
      customer_id text,
      source_stage text,
      converted_at timestamptz default now()
    )
  `;

  await sql`
    create table if not exists crm_activity_log (
      id text primary key,
      tenant_slug text not null,
      entity_type text not null,
      entity_id text not null,
      action text not null,
      description text,
      metadata jsonb,
      created_at timestamptz default now()
    )
  `;

  // Add linking columns (safe to run repeatedly)
  await sql`alter table crm_leads add column if not exists contact_id text`;
  await sql`alter table crm_customers add column if not exists converted_from_lead_id text`;
  await sql`alter table crm_deals add column if not exists contact_id text`;
  await sql`alter table crm_deals add column if not exists name text`;

  // Add created_by columns for ownership tracking (employee portal CRM)
  await sql`alter table crm_leads add column if not exists created_by text`;
  await sql`alter table crm_contacts add column if not exists created_by text`;
  await sql`alter table crm_deals add column if not exists created_by text`;
}

export async function insertCustomer(row: {
  tenantSlug: string;
  regionId: string;
  branchId: string;
  name: string;
  primaryContact?: Record<string, unknown>;
  status?: string;
  convertedFromLeadId?: string;
}) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const id = randomUUID();
  await sql`
    insert into crm_customers (id, tenant_slug, region_id, branch_id, name, primary_contact, status, converted_from_lead_id)
    values (${id}, ${row.tenantSlug}, ${row.regionId}, ${row.branchId}, ${row.name}, ${row.primaryContact ?? null}, ${row.status ?? "active"}, ${row.convertedFromLeadId ?? null})
  `;
  const inserted = (await sql`select * from crm_customers where id = ${id} limit 1`) as CrmCustomerRecord[];
  return normalizeCustomerRow(inserted[0]);
}

export async function updateCustomer(id: string, updates: Partial<{ name: string; status: string; primaryContact: Record<string, unknown> }>) {
  const sql = SQL;
  await ensureCrmTables(sql);
  if (!updates.name && updates.status === undefined && updates.primaryContact === undefined) {
    const row = (await sql`select * from crm_customers where id = ${id} limit 1`) as CrmCustomerRecord[];
    return row.length ? normalizeCustomerRow(row[0]) : null;
  }

  const updated = (await sql`
    update crm_customers
    set
      name = coalesce(${updates.name ?? null}, name),
      status = coalesce(${updates.status ?? null}, status),
      primary_contact = coalesce(${updates.primaryContact ?? null}, primary_contact),
      updated_at = now()
    where id = ${id}
    returning *
  `) as CrmCustomerRecord[];
  return updated.length ? normalizeCustomerRow(updated[0]) : null;
}

export async function listCustomers(filters: { tenantSlug: string; regionId?: string | null; limit?: number }) {
  const sql = SQL;
  await ensureCrmTables(sql);
  
  const limit = filters.limit ? Math.min(Math.max(filters.limit, 1), 100) : 50;
  
  let rows: CrmCustomerRecord[];
  if (filters.regionId) {
    rows = (await sql`
      select * from crm_customers
      where tenant_slug = ${filters.tenantSlug}
      and region_id = ${filters.regionId}
      order by created_at desc
      limit ${limit}
    `) as CrmCustomerRecord[];
  } else {
    rows = (await sql`
      select * from crm_customers
      where tenant_slug = ${filters.tenantSlug}
      order by created_at desc
      limit ${limit}
    `) as CrmCustomerRecord[];
  }
  
  return rows.map(normalizeCustomerRow);
}

export async function countCustomers(filters: { tenantSlug: string; regionId?: string | null }) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const params: any[] = [filters.tenantSlug];
  let query = `select count(*)::int as cnt from crm_customers where tenant_slug = $1`;
  if (filters.regionId) {
    params.push(filters.regionId);
    query += ` and region_id = $${params.length}`;
  }
  const rows = (await db.query(query, params)).rows as any[];
  return rows.length ? Number(rows[0].cnt) : 0;
}

function normalizeCustomerRow(row: CrmCustomerRecord & { converted_from_lead_id?: string }) {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    regionId: row.region_id,
    branchId: row.branch_id,
    name: row.name,
    primaryContact: row.primary_contact,
    status: row.status,
    convertedFromLeadId: (row as any).converted_from_lead_id as string | null ?? null,
    createdAt: row.created_at,
  };
}

function normalizeContactRow(row: CrmContactRecord): CrmContact {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    company: row.company,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    source: row.source,
    status: row.status,
    tags: Array.isArray(row.tags) ? row.tags : row.tags ? [row.tags].flat() : [],
    importedAt: row.imported_at ?? row.created_at,
    createdBy: (row as any).created_by as string | null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertContact(row: {
  tenantSlug: string;
  company: string;
  contactName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  source?: string | null;
  status?: string | null;
  tags?: string[];
  importedAt?: string;
  createdBy?: string;
}) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const id = randomUUID();
  const tagsLiteral = serializeTextArray(row.tags);
  const inserted = (await sql`
    insert into crm_contacts (
      id,
      tenant_slug,
      company,
      contact_name,
      contact_email,
      contact_phone,
      source,
      status,
      tags,
      imported_at,
      created_by
    ) values (
      ${id},
      ${row.tenantSlug},
      ${row.company},
      ${row.contactName},
      ${row.contactEmail ?? null},
      ${row.contactPhone ?? null},
      ${row.source ?? "CSV import"},
      ${row.status ?? "New"},
      ${tagsLiteral}::text[],
      ${row.importedAt ?? null},
      ${row.createdBy ?? null}
    )
    returning *
  `) as CrmContactRecord[];
  return normalizeContactRow(inserted[0]);
}

export async function insertContacts(rows: Array<Parameters<typeof insertContact>[0]>) {
  const inserted: CrmContact[] = [];
  for (const row of rows) {
    inserted.push(await insertContact(row));
  }
  return inserted;
}

export async function listContacts(filters: { tenantSlug: string; tag?: string | null; limit?: number; offset?: number; createdBy?: string }) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
  const offset = Math.max(filters.offset ?? 0, 0);
  const tagFilter = filters.tag?.trim() || null;

  const params: Array<string | number> = [filters.tenantSlug];
  let query = `
    select *
    from crm_contacts
    where tenant_slug = $1
  `;

  if (filters.createdBy) {
    params.push(filters.createdBy);
    query += ` and created_by = $${params.length}`;
  }

  if (tagFilter) {
    params.push(tagFilter);
    query += ` and array_position(coalesce(tags, array[]::text[]), $${params.length}) is not null`;
  }

  query += `
    order by imported_at desc nulls last, created_at desc
    limit ${limit}
    offset ${offset}
  `;

  const rows = (await db.query(query, params)).rows as CrmContactRecord[];
  return rows.map(normalizeContactRow);
}

export async function countContacts(filters: { tenantSlug: string; tag?: string | null; createdBy?: string }) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const params: any[] = [filters.tenantSlug];
  let query = `select count(*)::int as cnt from crm_contacts where tenant_slug = $1`;
  if (filters.createdBy) {
    params.push(filters.createdBy);
    query += ` and created_by = $${params.length}`;
  }
  if (filters.tag) {
    params.push(filters.tag);
    query += ` and array_position(coalesce(tags, array[]::text[]), $${params.length}) is not null`;
  }
  const rows = (await db.query(query, params)).rows as any[];
  return rows.length ? Number(rows[0].cnt) : 0;
}

export async function updateContact(
  id: string,
  updates: Partial<{
    company: string;
    contactName: string;
    status: string | null;
    tags: string[];
    contactEmail: string | null;
    contactPhone: string | null;
    source: string | null;
  }>
) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const tagsLiteral = updates.tags ? serializeTextArray(updates.tags) : null;
  if (
    updates.company === undefined &&
    updates.contactName === undefined &&
    updates.status === undefined &&
    updates.tags === undefined &&
    updates.contactEmail === undefined &&
    updates.contactPhone === undefined &&
    updates.source === undefined
  ) {
    const row = (await sql`select * from crm_contacts where id = ${id} limit 1`) as CrmContactRecord[];
    return row.length ? normalizeContactRow(row[0]) : null;
  }

  const updated = (await sql`
    update crm_contacts
    set
      company = coalesce(${updates.company ?? null}, company),
      contact_name = coalesce(${updates.contactName ?? null}, contact_name),
      status = coalesce(${updates.status ?? null}, status),
      tags = coalesce(${tagsLiteral ? sql`${tagsLiteral}::text[]` : null}, tags),
      contact_email = coalesce(${updates.contactEmail ?? null}, contact_email),
      contact_phone = coalesce(${updates.contactPhone ?? null}, contact_phone),
      source = coalesce(${updates.source ?? null}, source),
      updated_at = now()
    where id = ${id}
    returning *
  `) as CrmContactRecord[];
  return updated.length ? normalizeContactRow(updated[0]) : null;
}

export async function getContact(id: string) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const rows = (await sql`select * from crm_contacts where id = ${id} limit 1`) as CrmContactRecord[];
  return rows.length ? normalizeContactRow(rows[0]) : null;
}

export async function deleteContact(id: string) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const deleted = (await sql`delete from crm_contacts where id = ${id} returning id`) as any[];
  return deleted.length > 0;
}

export async function insertDeal(row: {
  tenantSlug: string;
  customerId?: string;
  leadId?: string;
  contactId?: string;
  name?: string;
  stage: CrmPipelineStage;
  value: number;
  currency?: string;
  probability?: number;
  expectedClose?: string;
  assignedOfficerId?: string;
  status?: string;
  createdBy?: string;
}) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const id = randomUUID();
  const inserted = await sql`
    insert into crm_deals (
      id, tenant_slug, customer_id, lead_id, contact_id, name, stage, value, currency, probability, expected_close, assigned_officer_id, status, created_by
    ) values (
      ${id}, ${row.tenantSlug}, ${row.customerId ?? null}, ${row.leadId ?? null}, ${row.contactId ?? null},
      ${row.name ?? null}, ${row.stage}, ${row.value}, ${row.currency ?? "₦"},
      ${row.probability ?? null}, ${row.expectedClose ?? null}, ${row.assignedOfficerId ?? null}, ${row.status ?? "open"},
      ${row.createdBy ?? null}
    )
    returning *
  `;
  return normalizeDealRow((inserted as any[])[0]);
}

export async function updateDeal(id: string, updates: Partial<{
  stage: CrmPipelineStage;
  probability: number;
  assignedOfficerId: string;
  status: string;
  value: number;
  currency: string;
  expectedClose: string | null;
}>) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const hasUpdates = Object.values(updates).some((v) => v !== undefined);
  if (!hasUpdates) {
    const row = (await sql`select * from crm_deals where id = ${id} limit 1`) as Record<string, unknown>[];
    return row.length ? normalizeDealRow(row[0]) : null;
  }

  const updated = (await sql`
    update crm_deals
    set
      stage = coalesce(${updates.stage ?? null}, stage),
      probability = coalesce(${updates.probability ?? null}, probability),
      assigned_officer_id = coalesce(${updates.assignedOfficerId ?? null}, assigned_officer_id),
      status = coalesce(${updates.status ?? null}, status),
      value = coalesce(${updates.value ?? null}, value),
      currency = coalesce(${updates.currency ?? null}, currency),
      expected_close = ${typeof updates.expectedClose !== "undefined" ? updates.expectedClose : null} ?? expected_close,
      updated_at = now()
    where id = ${id}
    returning *
  `) as Record<string, unknown>[];
  return updated.length ? normalizeDealRow(updated[0]) : null;
}

export async function listDeals(filters: Partial<{ tenantSlug: string; customerId?: string; leadId?: string; stage?: string; limit?: number; offset?: number; createdBy?: string }>) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const params: any[] = [];
  let idx = 1;
  let where = "where 1=1";
  if (filters.tenantSlug) {
    params.push(filters.tenantSlug);
    where += ` and tenant_slug = $${idx++}`;
  }
  if (filters.customerId) {
    params.push(filters.customerId);
    where += ` and customer_id = $${idx++}`;
  }
  if (filters.leadId) {
    params.push(filters.leadId);
    where += ` and lead_id = $${idx++}`;
  }
  if (filters.stage) {
    params.push(filters.stage);
    where += ` and stage = $${idx++}`;
  }
  if (filters.createdBy) {
    params.push(filters.createdBy);
    where += ` and created_by = $${idx++}`;
  }
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);
  const query = `select * from crm_deals ${where} order by created_at desc limit ${limit} offset ${offset}`;
  const rows = (await db.query(query, params)).rows as any[];
  return rows.map(normalizeDealRow);
}

export async function countDeals(filters: Partial<{ tenantSlug: string; customerId?: string; leadId?: string; stage?: string; createdBy?: string }>) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const params: any[] = [];
  let idx = 1;
  let where = "where 1=1";
  if (filters.tenantSlug) {
    params.push(filters.tenantSlug);
    where += ` and tenant_slug = $${idx++}`;
  }
  if (filters.customerId) {
    params.push(filters.customerId);
    where += ` and customer_id = $${idx++}`;
  }
  if (filters.leadId) {
    params.push(filters.leadId);
    where += ` and lead_id = $${idx++}`;
  }
  if (filters.stage) {
    params.push(filters.stage);
    where += ` and stage = $${idx++}`;
  }
  if (filters.createdBy) {
    params.push(filters.createdBy);
    where += ` and created_by = $${idx++}`;
  }
  const query = `select count(*)::int as cnt from crm_deals ${where}`;
  const rows = (await db.query(query, params)).rows as any[];
  return rows.length ? Number(rows[0].cnt) : 0;
}

export async function deleteDeal(id: string) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const deleted = (await sql`delete from crm_deals where id = ${id} returning id`) as any[];
  return deleted.length > 0;
}

export async function insertLead(row: {
  tenantSlug: string;
  regionId: string;
  branchId: string;
  companyName: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  source: CrmLeadSource;
  stage: CrmLeadStage;
  assignedOfficerId?: string;
  expectedValue?: number;
  currency?: string;
  notes?: string;
  contactId?: string;
  createdBy?: string;
}) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const id = randomUUID();
  const inserted = await sql`
    insert into crm_leads (
      id, tenant_slug, region_id, branch_id, company_name, contact_name, contact_email, contact_phone,
      source, stage, score, assigned_officer_id, expected_value, currency, notes, contact_id, created_by
    ) values (
      ${id}, ${row.tenantSlug}, ${row.regionId}, ${row.branchId}, ${row.companyName}, ${row.contactName},
      ${row.contactEmail ?? null}, ${row.contactPhone ?? null}, ${row.source}, ${row.stage}, 0,
      ${row.assignedOfficerId ?? null}, ${row.expectedValue ?? null}, ${row.currency ?? "₦"}, ${row.notes ?? null},
      ${row.contactId ?? null}, ${row.createdBy ?? null}
    )
    returning *
  `;
  return normalizeLeadRow((inserted as any[])[0]);
}

export async function updateLead(id: string, updates: Partial<{
  companyName: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  source: CrmLeadSource;
  stage: CrmLeadStage;
  score: number;
  assignedOfficerId: string | null;
  expectedValue: number | null;
  currency: string;
  notes: string;
}>) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const hasUpdates = Object.values(updates).some((v) => v !== undefined);
  if (!hasUpdates) {
    const row = (await sql`select * from crm_leads where id = ${id} limit 1`) as Record<string, unknown>[];
    return row.length ? normalizeLeadRow(row[0]) : null;
  }

  const updated = (await sql`
    update crm_leads
    set
      company_name = coalesce(${updates.companyName ?? null}, company_name),
      contact_name = coalesce(${updates.contactName ?? null}, contact_name),
      contact_email = ${typeof updates.contactEmail !== "undefined" ? updates.contactEmail : null} ?? contact_email,
      contact_phone = ${typeof updates.contactPhone !== "undefined" ? updates.contactPhone : null} ?? contact_phone,
      source = coalesce(${updates.source ?? null}, source),
      stage = coalesce(${updates.stage ?? null}, stage),
      score = coalesce(${updates.score ?? null}, score),
      assigned_officer_id = ${typeof updates.assignedOfficerId !== "undefined" ? updates.assignedOfficerId : null} ?? assigned_officer_id,
      expected_value = ${typeof updates.expectedValue !== "undefined" ? updates.expectedValue : null} ?? expected_value,
      currency = coalesce(${updates.currency ?? null}, currency),
      notes = coalesce(${updates.notes ?? null}, notes),
      updated_at = now()
    where id = ${id}
    returning *
  `) as Record<string, unknown>[];
  return updated.length ? normalizeLeadRow(updated[0]) : null;
}

export async function deleteLead(id: string) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const deleted = (await sql`delete from crm_leads where id = ${id} returning id`) as any[];
  return deleted.length > 0;
}

export async function getLead(id: string) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const rows = (await sql`select * from crm_leads where id = ${id} limit 1`) as any[];
  return rows.length ? normalizeLeadRow(rows[0]) : null;
}

export async function listLeads(filters: Partial<{ tenantSlug: string; regionId: string; branchId: string; salesOfficerId: string; stage: string; source: string; search: string; limit: number; offset: number; createdBy: string }>) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const params: any[] = [];
  let idx = 1;
  let where = "where 1=1";
  if (filters.tenantSlug) {
    params.push(filters.tenantSlug);
    where += ` and tenant_slug = $${idx++}`;
  }
  if (filters.regionId) {
    params.push(filters.regionId);
    where += ` and region_id = $${idx++}`;
  }
  if (filters.branchId) {
    params.push(filters.branchId);
    where += ` and branch_id = $${idx++}`;
  }
  if (filters.salesOfficerId) {
    params.push(filters.salesOfficerId);
    where += ` and assigned_officer_id = $${idx++}`;
  }
  if (filters.createdBy) {
    params.push(filters.createdBy);
    where += ` and created_by = $${idx++}`;
  }
  if (filters.stage) {
    params.push(filters.stage);
    where += ` and stage = $${idx++}`;
  }
  if (filters.source) {
    params.push(filters.source);
    where += ` and source = $${idx++}`;
  }
  if (filters.search) {
    const searchPattern = `%${filters.search}%`;
    params.push(searchPattern);
    const searchIdx = idx++;
    where += ` and (contact_name ilike $${searchIdx} or company_name ilike $${searchIdx} or contact_email ilike $${searchIdx})`;
  }
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);

  const query = `
    select * from crm_leads
    ${where}
    order by created_at desc
    limit ${limit} offset ${offset}
  `;

  const rows = (await db.query(query, params)).rows as any[];
  return rows.map(normalizeLeadRow);
}

export async function countLeads(filters: Partial<{ tenantSlug: string; regionId: string; branchId: string; salesOfficerId: string; stage: string; source: string; search: string; createdBy: string }>) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const params: any[] = [];
  let idx = 1;
  let where = "where 1=1";
  if (filters.tenantSlug) {
    params.push(filters.tenantSlug);
    where += ` and tenant_slug = $${idx++}`;
  }
  if (filters.regionId) {
    params.push(filters.regionId);
    where += ` and region_id = $${idx++}`;
  }
  if (filters.branchId) {
    params.push(filters.branchId);
    where += ` and branch_id = $${idx++}`;
  }
  if (filters.salesOfficerId) {
    params.push(filters.salesOfficerId);
    where += ` and assigned_officer_id = $${idx++}`;
  }
  if (filters.createdBy) {
    params.push(filters.createdBy);
    where += ` and created_by = $${idx++}`;
  }
  if (filters.stage) {
    params.push(filters.stage);
    where += ` and stage = $${idx++}`;
  }
  if (filters.source) {
    params.push(filters.source);
    where += ` and source = $${idx++}`;
  }
  if (filters.search) {
    const searchPattern = `%${filters.search}%`;
    params.push(searchPattern);
    const searchIdx = idx++;
    where += ` and (contact_name ilike $${searchIdx} or company_name ilike $${searchIdx} or contact_email ilike $${searchIdx})`;
  }

  const query = `select count(*)::int as cnt from crm_leads ${where}`;
  const rows = (await db.query(query, params)).rows as any[];
  return rows.length ? Number(rows[0].cnt) : 0;
}

function normalizeLeadRow(row: any) {
  return {
    id: row.id as string,
    tenantSlug: row.tenant_slug as string,
    regionId: row.region_id as string,
    branchId: row.branch_id as string,
    companyName: row.company_name as string,
    contactName: row.contact_name as string,
    contactEmail: row.contact_email as string | null,
    contactPhone: row.contact_phone as string | null,
    source: row.source as CrmLeadSource,
    stage: row.stage as CrmLeadStage,
    score: Number(row.score ?? 0),
    assignedOfficerId: row.assigned_officer_id as string | null,
    expectedValue: row.expected_value ? Number(row.expected_value) : null,
    currency: row.currency as string,
    notes: row.notes as string | null,
    contactId: (row.contact_id as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function normalizeDealRow(row: any) {
  return {
    id: row.id as string,
    tenantSlug: row.tenant_slug as string,
    customerId: row.customer_id as string | null,
    leadId: row.lead_id as string | null,
    contactId: (row.contact_id as string | null) ?? null,
    name: (row.name as string | null) ?? null,
    stage: row.stage as CrmPipelineStage,
    value: row.value ? Number(row.value) : 0,
    currency: row.currency as string,
    probability: row.probability ? Number(row.probability) : null,
    expectedClose: row.expected_close as string | null,
    assignedOfficerId: row.assigned_officer_id as string | null,
    status: row.status as string,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ---------------------------------------------------------------------------
// Conversions (lead → customer analytics)
// ---------------------------------------------------------------------------

export async function recordConversion(params: {
  tenantSlug: string;
  leadId: string;
  customerId?: string;
  sourceStage?: string;
}) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const id = randomUUID();
  await sql`
    insert into crm_conversions (id, tenant_slug, lead_id, customer_id, source_stage, converted_at)
    values (${id}, ${params.tenantSlug}, ${params.leadId}, ${params.customerId ?? null}, ${params.sourceStage ?? null}, now())
  `;
  return id;
}

export async function getConversionStats(params: { tenantSlug: string; days?: number }) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const since = new Date();
  since.setDate(since.getDate() - (params.days ?? 30));
  const isoSince = since.toISOString();

  const totalConvertedResult = (await sql`
    select count(*)::int as cnt from crm_conversions
    where tenant_slug = ${params.tenantSlug}
  `) as any[];
  const totalConverted = totalConvertedResult[0]?.cnt ?? 0;

  const recentConvertedResult = (await sql`
    select count(*)::int as cnt from crm_conversions
    where tenant_slug = ${params.tenantSlug}
    and converted_at >= ${isoSince}
  `) as any[];
  const recentConverted = recentConvertedResult[0]?.cnt ?? 0;

  const totalLeadsResult = (await sql`
    select count(*)::int as cnt from crm_leads
    where tenant_slug = ${params.tenantSlug}
  `) as any[];
  const totalLeads = totalLeadsResult[0]?.cnt ?? 0;

  const conversionRate = totalLeads > 0 ? Math.round((totalConverted / totalLeads) * 10000) / 100 : 0;

  return {
    totalConverted,
    recentConverted,
    totalLeads,
    conversionRate,
  };
}

export async function listConversions(params: { tenantSlug: string; limit?: number }) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const limit = Math.min(Math.max(params.limit ?? 10, 1), 100);
  const rows = (await sql`
    select * from crm_conversions
    where tenant_slug = ${params.tenantSlug}
    order by converted_at desc
    limit ${limit}
  `) as any[];
  return rows.map(normalizeConversionRow);
}

function normalizeConversionRow(row: any) {
  return {
    id: row.id as string,
    tenantSlug: row.tenant_slug as string,
    leadId: row.lead_id as string,
    customerId: row.customer_id as string | null,
    sourceStage: row.source_stage as string | null,
    convertedAt: row.converted_at as string,
  };
}

// ---------------------------------------------------------------------------
// Activity Log
// ---------------------------------------------------------------------------

export async function logActivity(params: {
  tenantSlug: string;
  entityType: "lead" | "contact" | "customer" | "deal" | "conversion";
  entityId: string;
  action: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const id = randomUUID();
  await sql`
    insert into crm_activity_log (id, tenant_slug, entity_type, entity_id, action, description, metadata)
    values (${id}, ${params.tenantSlug}, ${params.entityType}, ${params.entityId}, ${params.action},
      ${params.description ?? null}, ${params.metadata ? JSON.stringify(params.metadata) : null})
  `;
  return id;
}

export async function listActivities(params: { tenantSlug: string; limit?: number; entityType?: string; entityId?: string }) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
  if (params.entityType && params.entityId) {
    const rows = (await sql`
      select * from crm_activity_log
      where tenant_slug = ${params.tenantSlug} and entity_type = ${params.entityType} and entity_id = ${params.entityId}
      order by created_at desc limit ${limit}
    `) as any[];
    return rows.map(normalizeActivityRow);
  }
  const rows = (await sql`
    select * from crm_activity_log
    where tenant_slug = ${params.tenantSlug}
    order by created_at desc limit ${limit}
  `) as any[];
  return rows.map(normalizeActivityRow);
}

function normalizeActivityRow(row: any) {
  return {
    id: row.id as string,
    tenantSlug: row.tenant_slug as string,
    entityType: row.entity_type as string,
    entityId: row.entity_id as string,
    action: row.action as string,
    description: row.description as string | null,
    metadata: row.metadata as Record<string, unknown> | null,
    createdAt: row.created_at as string,
  };
}
