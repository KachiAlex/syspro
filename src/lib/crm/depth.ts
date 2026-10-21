import { randomUUID } from "crypto";

import { db, sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { sendEmail } from "@/lib/email";

export function ensureCrmDepthTables() {
  return ensureOnce("crm/depth:ensureTables", ensureCrmDepthTablesRun);
}

async function ensureCrmDepthTablesRun() {
  const sql = SQL;
  await sql`create table if not exists crm_prospects (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    name text not null,
    company_name text,
    email text,
    phone text,
    industry text,
    market_segment text,
    website text,
    status text not null default 'open'
      check (status in ('open','converted','lost')),
    lead_id text,
    notes text,
    created_by text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;
  await sql`create index if not exists crm_prospects_tenant_idx on crm_prospects (tenant_slug, status)`;
  await sql`alter table if exists crm_leads add column if not exists prospect_id uuid`;
  await sql`create table if not exists crm_contract_templates (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    name text not null,
    body text not null,
    fulfilment_terms jsonb not null default '[]',
    created_at timestamptz not null default now(),
    unique (tenant_slug, name)
  )`;
  await sql`create table if not exists crm_contracts (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    contract_number text not null,
    template_id uuid,
    customer_id text not null,
    customer_name text not null,
    deal_id text,
    project_id text,
    status text not null default 'draft'
      check (status in ('draft','unsigned','active','fulfilled','expired','cancelled')),
    start_date date,
    end_date date,
    signed_date date,
    contract_value numeric,
    currency text not null default 'NGN',
    body text,
    fulfilment_checklist jsonb not null default '[]',
    document_url text,
    renewal_reminded boolean not null default false,
    created_by text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (tenant_slug, contract_number)
  )`;
  await sql`create table if not exists crm_sales_stages (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    name text not null,
    sequence integer not null default 0,
    probability numeric not null default 0,
    is_won boolean not null default false,
    is_lost boolean not null default false,
    created_at timestamptz not null default now(),
    unique (tenant_slug, name)
  )`;
  await sql`alter table if exists crm_deals add column if not exists stage_id uuid`;
  await sql`create table if not exists crm_email_campaigns (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    name text not null,
    description text,
    status text not null default 'draft'
      check (status in ('draft','active','paused','completed')),
    trigger_event text,
    created_by text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (tenant_slug, name)
  )`;
  await sql`create table if not exists crm_campaign_emails (
    id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null references crm_email_campaigns(id) on delete cascade,
    sequence integer not null,
    delay_days integer not null default 0,
    subject text not null,
    body_html text not null,
    body_text text
  )`;
  await sql`create table if not exists crm_campaign_enrollments (
    id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null references crm_email_campaigns(id) on delete cascade,
    tenant_slug text not null,
    recipient_type text not null default 'lead' check (recipient_type in ('lead','contact','customer','manual')),
    recipient_id text,
    recipient_email text not null,
    recipient_name text,
    status text not null default 'active'
      check (status in ('active','completed','unsubscribed','bounced')),
    current_step integer not null default 0,
    next_send_at timestamptz,
    enrolled_at timestamptz not null default now(),
    unique (campaign_id, recipient_email)
  )`;
  await sql`create index if not exists campaign_enroll_due_idx
    on crm_campaign_enrollments (tenant_slug, status, next_send_at)`;
  await sql`create table if not exists crm_campaign_sends (
    id uuid primary key default gen_random_uuid(),
    enrollment_id uuid not null references crm_campaign_enrollments(id) on delete cascade,
    campaign_email_id uuid not null,
    sent_at timestamptz not null default now(),
    message_id text,
    error text
  )`;
}

function nextNumber(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${randomUUID().slice(0, 4).toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Prospects
// ---------------------------------------------------------------------------

export async function listProspects(tenantSlug: string, status?: string) {
  await ensureCrmDepthTables();
  return status
    ? (await db.query(`SELECT * FROM crm_prospects WHERE tenant_slug = $1 AND status = $2 ORDER BY created_at DESC`, [tenantSlug, status])).rows
    : (await db.query(`SELECT * FROM crm_prospects WHERE tenant_slug = $1 ORDER BY created_at DESC`, [tenantSlug])).rows;
}

export async function createProspect(input: {
  tenantSlug: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  industry?: string;
  marketSegment?: string;
  website?: string;
  notes?: string;
  createdBy?: string;
}) {
  await ensureCrmDepthTables();
  return (await db.query(
    `INSERT INTO crm_prospects (tenant_slug, name, company_name, email, phone, industry, market_segment, website, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [input.tenantSlug, input.name, input.companyName ?? null, input.email ?? null, input.phone ?? null,
     input.industry ?? null, input.marketSegment ?? null, input.website ?? null, input.notes ?? null, input.createdBy ?? null])).rows[0];
}

/** Convert a prospect into a CRM lead, linking both sides. */
export async function convertProspect(tenantSlug: string, prospectId: string) {
  await ensureCrmDepthTables();
  const prospect = (await db.query(
    `SELECT * FROM crm_prospects WHERE id = $1 AND tenant_slug = $2`, [prospectId, tenantSlug])).rows[0];
  if (!prospect) throw new Error("Prospect not found");
  if (prospect.lead_id) return { leadId: prospect.lead_id, alreadyConverted: true };

  const branch = (await db.query(
    `SELECT id FROM tenant_branches WHERE tenant_slug = $1 AND status = 'active' ORDER BY created_at LIMIT 1`,
    [tenantSlug]).catch(() => ({ rows: [] }))).rows?.[0];
  const { insertLead } = await import("./db");
  const lead = await insertLead({
    tenantSlug,
    regionId: branch?.id ?? "default",
    branchId: branch?.id ?? "default",
    companyName: prospect.company_name ?? prospect.name,
    contactName: prospect.name,
    contactEmail: prospect.email ?? undefined,
    contactPhone: prospect.phone ?? undefined,
    source: "prospect" as any,
    stage: "new" as any,
    notes: prospect.notes ?? undefined,
  } as any);
  await db.query(
    `UPDATE crm_leads SET prospect_id = $1 WHERE id = $2`, [prospectId, (lead as any).id]);
  await db.query(
    `UPDATE crm_prospects SET status = 'converted', lead_id = $1, updated_at = now() WHERE id = $2`,
    [(lead as any).id, prospectId]);
  return { leadId: (lead as any).id, alreadyConverted: false };
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

export async function upsertContractTemplate(input: {
  tenantSlug: string;
  name: string;
  body: string;
  fulfilmentTerms?: { term: string; required?: boolean }[];
}) {
  await ensureCrmDepthTables();
  return (await db.query(
    `INSERT INTO crm_contract_templates (tenant_slug, name, body, fulfilment_terms)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (tenant_slug, name) DO UPDATE SET body = excluded.body, fulfilment_terms = excluded.fulfilment_terms
     RETURNING *`,
    [input.tenantSlug, input.name, input.body, JSON.stringify(input.fulfilmentTerms ?? [])])).rows[0];
}

export async function listContractTemplates(tenantSlug: string) {
  await ensureCrmDepthTables();
  return (await db.query(`SELECT * FROM crm_contract_templates WHERE tenant_slug = $1 ORDER BY name`, [tenantSlug])).rows;
}

export async function createContract(input: {
  tenantSlug: string;
  templateId?: string | null;
  customerId: string;
  customerName: string;
  dealId?: string | null;
  projectId?: string | null;
  startDate?: string;
  endDate?: string;
  contractValue?: number;
  currency?: string;
  body?: string;
  createdBy?: string;
}) {
  await ensureCrmDepthTables();
  let body = input.body ?? null;
  let checklist: any[] = [];
  if (input.templateId) {
    const tpl = (await db.query(
      `SELECT * FROM crm_contract_templates WHERE id = $1 AND tenant_slug = $2`, [input.templateId, input.tenantSlug])).rows[0];
    if (tpl) {
      body = body ?? tpl.body;
      checklist = (tpl.fulfilment_terms ?? []).map((t: any) => ({ term: t.term, required: t.required ?? false, fulfilled: false }));
    }
  }
  return (await db.query(
    `INSERT INTO crm_contracts
       (tenant_slug, contract_number, template_id, customer_id, customer_name, deal_id, project_id,
        start_date, end_date, contract_value, currency, body, fulfilment_checklist, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [input.tenantSlug, nextNumber("CON"), input.templateId ?? null, input.customerId, input.customerName,
     input.dealId ?? null, input.projectId ?? null, input.startDate ?? null, input.endDate ?? null,
     input.contractValue ?? null, input.currency ?? "NGN", body, JSON.stringify(checklist), input.createdBy ?? null])).rows[0];
}

export async function listContracts(tenantSlug: string, status?: string) {
  await ensureCrmDepthTables();
  return status
    ? (await db.query(`SELECT * FROM crm_contracts WHERE tenant_slug = $1 AND status = $2 ORDER BY created_at DESC`, [tenantSlug, status])).rows
    : (await db.query(`SELECT * FROM crm_contracts WHERE tenant_slug = $1 ORDER BY created_at DESC`, [tenantSlug])).rows;
}

export async function updateContractStatus(
  tenantSlug: string,
  id: string,
  status: "unsigned" | "active" | "fulfilled" | "expired" | "cancelled"
) {
  await ensureCrmDepthTables();
  const row = (await db.query(
    `UPDATE crm_contracts
     SET status = $1, signed_date = CASE WHEN $1 = 'active' AND signed_date IS NULL THEN current_date ELSE signed_date END,
         updated_at = now()
     WHERE id = $2 AND tenant_slug = $3 RETURNING *`,
    [status, id, tenantSlug])).rows[0];
  if (!row) throw new Error("Contract not found");
  return row;
}

export async function updateFulfilment(tenantSlug: string, contractId: string, termIndex: number, fulfilled: boolean) {
  await ensureCrmDepthTables();
  const contract = (await db.query(
    `SELECT * FROM crm_contracts WHERE id = $1 AND tenant_slug = $2`, [contractId, tenantSlug])).rows[0];
  if (!contract) throw new Error("Contract not found");
  const checklist = contract.fulfilment_checklist ?? [];
  if (termIndex < 0 || termIndex >= checklist.length) throw new Error("Invalid checklist index");
  checklist[termIndex] = { ...checklist[termIndex], fulfilled };
  const allFulfilled = checklist.length > 0 && checklist.every((t: any) => t.fulfilled || !t.required);
  await db.query(
    `UPDATE crm_contracts
     SET fulfilment_checklist = $1,
         status = CASE WHEN $2 AND status = 'active' THEN 'fulfilled' ELSE status END,
         updated_at = now()
     WHERE id = $3`,
    [JSON.stringify(checklist), allFulfilled, contractId]);
  return { checklist, fulfilled: allFulfilled };
}

/** Contracts expiring within N days — for renewal notifications. */
export async function contractsExpiringWithin(tenantSlug: string, days: number) {
  await ensureCrmDepthTables();
  return (await db.query(
    `SELECT * FROM crm_contracts
     WHERE tenant_slug = $1 AND status = 'active'
       AND end_date IS NOT NULL AND end_date <= current_date + ($2 || ' days')::interval
       AND NOT renewal_reminded`,
    [tenantSlug, days])).rows;
}

// ---------------------------------------------------------------------------
// Sales stages configurator
// ---------------------------------------------------------------------------

const DEFAULT_STAGES = [
  { name: "Qualification", sequence: 1, probability: 10 },
  { name: "Needs Analysis", sequence: 2, probability: 25 },
  { name: "Proposal", sequence: 3, probability: 50 },
  { name: "Negotiation", sequence: 4, probability: 75 },
  { name: "Closed Won", sequence: 5, probability: 100, isWon: true },
  { name: "Closed Lost", sequence: 6, probability: 0, isLost: true },
];

export async function listSalesStages(tenantSlug: string) {
  await ensureCrmDepthTables();
  let rows = (await db.query(
    `SELECT * FROM crm_sales_stages WHERE tenant_slug = $1 ORDER BY sequence`, [tenantSlug])).rows;
  if (!rows.length) {
    for (const s of DEFAULT_STAGES) {
      await db.query(
        `INSERT INTO crm_sales_stages (tenant_slug, name, sequence, probability, is_won, is_lost)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (tenant_slug, name) DO NOTHING`,
        [tenantSlug, s.name, s.sequence, s.probability, s.isWon ?? false, s.isLost ?? false]);
    }
    rows = (await db.query(
      `SELECT * FROM crm_sales_stages WHERE tenant_slug = $1 ORDER BY sequence`, [tenantSlug])).rows;
  }
  return rows;
}

export async function upsertSalesStage(input: {
  tenantSlug: string;
  name: string;
  sequence: number;
  probability?: number;
  isWon?: boolean;
  isLost?: boolean;
}) {
  await ensureCrmDepthTables();
  return (await db.query(
    `INSERT INTO crm_sales_stages (tenant_slug, name, sequence, probability, is_won, is_lost)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (tenant_slug, name) DO UPDATE SET
       sequence = excluded.sequence, probability = excluded.probability,
       is_won = excluded.is_won, is_lost = excluded.is_lost
     RETURNING *`,
    [input.tenantSlug, input.name, input.sequence, input.probability ?? 0, input.isWon ?? false, input.isLost ?? false])).rows[0];
}

/** Weighted pipeline value: sum(deal value × stage probability) for open deals. */
export async function weightedPipeline(tenantSlug: string) {
  await ensureCrmDepthTables();
  const stages = await listSalesStages(tenantSlug);
  const probByName = new Map(stages.map((s: any) => [String(s.name).toLowerCase(), Number(s.probability)]));
  const deals = (await db.query(
    `SELECT id, name, stage, value FROM crm_deals WHERE tenant_slug = $1 AND status NOT IN ('closed_won','closed_lost')`,
    [tenantSlug])).rows;
  let weighted = 0;
  const byStage = new Map<string, number>();
  for (const d of deals) {
    const prob = probByName.get(String(d.stage ?? "").toLowerCase()) ?? 0;
    const w = Number(d.value ?? 0) * (prob / 100);
    weighted += w;
    byStage.set(d.stage ?? "unknown", (byStage.get(d.stage ?? "unknown") ?? 0) + w);
  }
  return {
    weightedTotal: weighted,
    byStage: [...byStage.entries()].map(([stage, value]) => ({ stage, weightedValue: value })),
  };
}

// ---------------------------------------------------------------------------
// Email campaigns (drip via centralized sendEmail / Brevo)
// ---------------------------------------------------------------------------

export async function upsertCampaign(input: {
  tenantSlug: string;
  name: string;
  description?: string;
  triggerEvent?: string | null;
  emails: { delayDays: number; subject: string; bodyHtml: string; bodyText?: string }[];
}) {
  await ensureCrmDepthTables();
  const campaign = (await db.query(
    `INSERT INTO crm_email_campaigns (tenant_slug, name, description, trigger_event)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (tenant_slug, name) DO UPDATE SET description = excluded.description, trigger_event = excluded.trigger_event
     RETURNING *`,
    [input.tenantSlug, input.name, input.description ?? null, input.triggerEvent ?? null])).rows[0];
  await db.query(`DELETE FROM crm_campaign_emails WHERE campaign_id = $1`, [campaign.id]);
  for (const [idx, e] of input.emails.entries()) {
    await db.query(
      `INSERT INTO crm_campaign_emails (campaign_id, sequence, delay_days, subject, body_html, body_text)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [campaign.id, idx + 1, e.delayDays, e.subject, e.bodyHtml, e.bodyText ?? null]);
  }
  return campaign;
}

export async function listCampaigns(tenantSlug: string) {
  await ensureCrmDepthTables();
  const campaigns = (await db.query(
    `SELECT c.*, (SELECT count(*) FROM crm_campaign_enrollments e WHERE e.campaign_id = c.id AND e.status = 'active')::int AS active_enrollments
     FROM crm_email_campaigns c WHERE c.tenant_slug = $1 ORDER BY c.name`, [tenantSlug])).rows;
  return campaigns;
}

export async function setCampaignStatus(tenantSlug: string, id: string, status: "draft" | "active" | "paused" | "completed") {
  await ensureCrmDepthTables();
  const row = (await db.query(
    `UPDATE crm_email_campaigns SET status = $1, updated_at = now() WHERE id = $2 AND tenant_slug = $3 RETURNING *`,
    [status, id, tenantSlug])).rows[0];
  if (!row) throw new Error("Campaign not found");
  return row;
}

export async function enrollRecipient(input: {
  tenantSlug: string;
  campaignId: string;
  recipientEmail: string;
  recipientName?: string;
  recipientType?: string;
  recipientId?: string;
}) {
  await ensureCrmDepthTables();
  const firstStep = (await db.query(
    `SELECT * FROM crm_campaign_emails WHERE campaign_id = $1 ORDER BY sequence LIMIT 1`, [input.campaignId])).rows[0];
  if (!firstStep) throw new Error("Campaign has no emails configured");
  const row = (await db.query(
    `INSERT INTO crm_campaign_enrollments
       (campaign_id, tenant_slug, recipient_type, recipient_id, recipient_email, recipient_name, next_send_at)
     VALUES ($1,$2,$3,$4,$5,$6, now() + ($7 || ' days')::interval)
     ON CONFLICT (campaign_id, recipient_email) DO NOTHING
     RETURNING *`,
    [input.campaignId, input.tenantSlug, input.recipientType ?? "lead",
     input.recipientId ?? null, input.recipientEmail, input.recipientName ?? null,
     firstStep.delay_days])).rows[0];
  return row ?? { alreadyEnrolled: true };
}

/**
 * Process due campaign sends: delivers the next email per enrollment,
 * advances the step or marks completed. Called by scheduler/API.
 */
export async function processCampaignSends(tenantSlug: string, limit = 50) {
  await ensureCrmDepthTables();
  const due = (await db.query(
    `SELECT e.*, c.status AS campaign_status FROM crm_campaign_enrollments e
     JOIN crm_email_campaigns c ON c.id = e.campaign_id
     WHERE e.tenant_slug = $1 AND e.status = 'active' AND c.status = 'active'
       AND e.next_send_at IS NOT NULL AND e.next_send_at <= now()
     ORDER BY e.next_send_at LIMIT $2`,
    [tenantSlug, limit])).rows;

  let sent = 0;
  for (const enrollment of due) {
    const step = (await db.query(
      `SELECT * FROM crm_campaign_emails WHERE campaign_id = $1 AND sequence = $2`,
      [enrollment.campaign_id, enrollment.current_step + 1])).rows[0];
    if (!step) {
      await db.query(`UPDATE crm_campaign_enrollments SET status = 'completed' WHERE id = $1`, [enrollment.id]);
      continue;
    }
    const result = await sendEmail({
      to: enrollment.recipient_email,
      subject: step.subject,
      html: step.body_html.replace(/\{\{name\}\}/g, enrollment.recipient_name ?? ""),
      text: step.body_text ?? undefined,
    });
    await db.query(
      `INSERT INTO crm_campaign_sends (enrollment_id, campaign_email_id, message_id, error)
       VALUES ($1,$2,$3,$4)`,
      [enrollment.id, step.id, result.messageId ?? null, result.success ? null : result.error ?? "send failed"]);

    const nextStep = (await db.query(
      `SELECT * FROM crm_campaign_emails WHERE campaign_id = $1 AND sequence = $2`,
      [enrollment.campaign_id, enrollment.current_step + 2])).rows[0];
    await db.query(
      `UPDATE crm_campaign_enrollments
       SET current_step = current_step + 1,
           status = CASE WHEN NOT $2 THEN 'completed' ELSE status END,
           next_send_at = CASE WHEN $2 THEN now() + ($3 || ' days')::interval ELSE NULL END
       WHERE id = $4`,
      [enrollment.id, Boolean(nextStep), nextStep?.delay_days ?? 0, enrollment.id]);
    if (result.success) sent++;
  }
  return { processed: due.length, sent };
}
