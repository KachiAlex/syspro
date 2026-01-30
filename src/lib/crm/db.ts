import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import type {
  CrmLeadStage,
  CrmLeadSource,
  CrmPipelineStage,
  CrmCustomerRecord,
  CrmContactRecord,
  CrmContact,
} from "./types";

const SQL = getSql();

type SqlClient = ReturnType<typeof getSql>;

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
}

export async function insertCustomer(row: {
  tenantSlug: string;
  regionId: string;
  branchId: string;
  name: string;
  primaryContact?: Record<string, unknown>;
  status?: string;
}) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const id = randomUUID();
  await sql`
    insert into crm_customers (id, tenant_slug, region_id, branch_id, name, primary_contact, status)
    values (${id}, ${row.tenantSlug}, ${row.regionId}, ${row.branchId}, ${row.name}, ${row.primaryContact ?? null}, ${row.status ?? "active"})
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
  const rows = (await sql`
    select * from crm_customers
    where tenant_slug = ${filters.tenantSlug}
    ${filters.regionId ? sql`and region_id = ${filters.regionId}` : sql``}
    order by created_at desc
    ${filters.limit ? sql`limit ${filters.limit}` : sql``}
  `) as CrmCustomerRecord[];
  return rows.map(normalizeCustomerRow);
}

function normalizeCustomerRow(row: CrmCustomerRecord) {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    regionId: row.region_id,
    branchId: row.branch_id,
    name: row.name,
    primaryContact: row.primary_contact,
    status: row.status,
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
}) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const id = randomUUID();
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
      imported_at
    ) values (
      ${id},
      ${row.tenantSlug},
      ${row.company},
      ${row.contactName},
      ${row.contactEmail ?? null},
      ${row.contactPhone ?? null},
      ${row.source ?? "CSV import"},
      ${row.status ?? "New"},
      ${sql.array(row.tags ?? [], "text")},
      ${row.importedAt ?? null}
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

export async function listContacts(filters: { tenantSlug: string; tag?: string | null; limit?: number; offset?: number }) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const rows = (await sql`
    select *
    from crm_contacts
    where tenant_slug = ${filters.tenantSlug}
    ${filters.tag ? sql`and ${filters.tag} = any(tags)` : sql``}
    order by imported_at desc nulls last, created_at desc
    ${filters.limit ? sql`limit ${filters.limit}` : sql`limit 50`}
    ${filters.offset ? sql`offset ${filters.offset}` : sql``}
  `) as CrmContactRecord[];
  return rows.map(normalizeContactRow);
}

export async function updateContact(
  id: string,
  updates: Partial<{ status: string | null; tags: string[]; contactEmail: string | null; contactPhone: string | null }>
) {
  const sql = SQL;
  await ensureCrmTables(sql);
  if (
    updates.status === undefined &&
    updates.tags === undefined &&
    updates.contactEmail === undefined &&
    updates.contactPhone === undefined
  ) {
    const row = (await sql`select * from crm_contacts where id = ${id} limit 1`) as CrmContactRecord[];
    return row.length ? normalizeContactRow(row[0]) : null;
  }

  const updated = (await sql`
    update crm_contacts
    set
      status = coalesce(${updates.status ?? null}, status),
      tags = coalesce(${updates.tags ? sql.array(updates.tags, "text") : null}, tags),
      contact_email = coalesce(${updates.contactEmail ?? null}, contact_email),
      contact_phone = coalesce(${updates.contactPhone ?? null}, contact_phone),
      updated_at = now()
    where id = ${id}
    returning *
  `) as CrmContactRecord[];
  return updated.length ? normalizeContactRow(updated[0]) : null;
}

export async function insertDeal(row: {
  tenantSlug: string;
  customerId?: string;
  leadId?: string;
  stage: CrmPipelineStage;
  value: number;
  currency?: string;
  probability?: number;
  expectedClose?: string;
  assignedOfficerId?: string;
  status?: string;
}) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const id = randomUUID();
  await sql`
    insert into crm_deals (
      id, tenant_slug, customer_id, lead_id, stage, value, currency, probability, expected_close, assigned_officer_id, status
    ) values (
      ${id}, ${row.tenantSlug}, ${row.customerId ?? null}, ${row.leadId ?? null}, ${row.stage}, ${row.value}, ${row.currency ?? "₦"},
      ${row.probability ?? null}, ${row.expectedClose ?? null}, ${row.assignedOfficerId ?? null}, ${row.status ?? "open"}
    )
  `;
  const inserted = (await sql`select * from crm_deals where id = ${id} limit 1`) as Record<string, unknown>[];
  return normalizeDealRow(inserted[0]);
}

export async function updateDeal(id: string, updates: Partial<{
  stage: CrmPipelineStage;
  probability: number;
  assignedOfficerId: string;
  status: string;
}>) {
  const sql = SQL;
  await ensureCrmTables(sql);
  if (!updates.stage && updates.probability === undefined && updates.assignedOfficerId === undefined && updates.status === undefined) {
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
      updated_at = now()
    where id = ${id}
    returning *
  `) as Record<string, unknown>[];
  return updated.length ? normalizeDealRow(updated[0]) : null;
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
}) {
  const sql = SQL;
  await ensureCrmTables(sql);
  const id = randomUUID();
  await sql`
    insert into crm_leads (
      id, tenant_slug, region_id, branch_id, company_name, contact_name, contact_email, contact_phone,
      source, stage, score, assigned_officer_id, expected_value, currency, notes
    ) values (
      ${id}, ${row.tenantSlug}, ${row.regionId}, ${row.branchId}, ${row.companyName}, ${row.contactName},
      ${row.contactEmail ?? null}, ${row.contactPhone ?? null}, ${row.source}, ${row.stage}, 0,
      ${row.assignedOfficerId ?? null}, ${row.expectedValue ?? null}, ${row.currency ?? "₦"}, ${row.notes ?? null}
    )
  `;
  const inserted = (await sql`
    select * from crm_leads where id = ${id} limit 1
  `) as Record<string, unknown>[];
  return normalizeLeadRow(inserted[0]);
}

export async function updateLead(id: string, updates: Partial<{
  stage: CrmLeadStage;
  assignedOfficerId: string;
  notes: string;
}>) {
  const sql = SQL;
  await ensureCrmTables(sql);
  if (!updates.stage && updates.assignedOfficerId === undefined && updates.notes === undefined) {
    const row = (await sql`select * from crm_leads where id = ${id} limit 1`) as Record<string, unknown>[];
    return row.length ? normalizeLeadRow(row[0]) : null;
  }

  const updated = (await sql`
    update crm_leads
    set
      stage = coalesce(${updates.stage ?? null}, stage),
      assigned_officer_id = coalesce(${updates.assignedOfficerId ?? null}, assigned_officer_id),
      notes = coalesce(${updates.notes ?? null}, notes),
      updated_at = now()
    where id = ${id}
    returning *
  `) as Record<string, unknown>[];
  return updated.length ? normalizeLeadRow(updated[0]) : null;
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
    stage: row.stage as CrmPipelineStage,
    value: row.value ? Number(row.value) : 0,
    currency: row.currency as string,
    probability: row.probability ? Number(row.probability) : null,
    expectedClose: row.expected_close as string | null,
    assignedOfficerId: row.assigned_officer_id as string | null,
    status: row.status as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
