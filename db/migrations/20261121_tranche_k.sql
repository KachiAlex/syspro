-- Tranche K: CRM & support depth
-- prospects, contracts + templates, sales stages configurator,
-- email campaigns, warranty claims, SLA engine

-- Prospects (pre-lead pipeline entity)
create table if not exists crm_prospects (
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
);
create index if not exists crm_prospects_tenant_idx on crm_prospects (tenant_slug, status);
alter table if exists crm_leads add column if not exists prospect_id uuid;

-- Contracts + templates + fulfilment checklist
create table if not exists crm_contract_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  body text not null,
  fulfilment_terms jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (tenant_slug, name)
);
create table if not exists crm_contracts (
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
);
create index if not exists crm_contracts_tenant_idx on crm_contracts (tenant_slug, status);

-- Sales stages configurator
create table if not exists crm_sales_stages (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  sequence integer not null default 0,
  probability numeric not null default 0,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_slug, name)
);
alter table if exists crm_deals add column if not exists stage_id uuid;

-- Email campaigns (drip via sendEmail/Brevo)
create table if not exists crm_email_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft','active','paused','completed')),
  trigger_event text,             -- e.g. 'lead_created', 'manual'
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_slug, name)
);
create table if not exists crm_campaign_emails (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references crm_email_campaigns(id) on delete cascade,
  sequence integer not null,
  delay_days integer not null default 0,
  subject text not null,
  body_html text not null,
  body_text text
);
create index if not exists campaign_emails_campaign_idx on crm_campaign_emails (campaign_id);
create table if not exists crm_campaign_enrollments (
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
);
create index if not exists campaign_enroll_due_idx
  on crm_campaign_enrollments (tenant_slug, status, next_send_at);
create table if not exists crm_campaign_sends (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references crm_campaign_enrollments(id) on delete cascade,
  campaign_email_id uuid not null,
  sent_at timestamptz not null default now(),
  message_id text,
  error text
);

-- Warranty claims
create table if not exists support_warranty_claims (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  claim_number text not null,
  serial_no text,
  product_sku text,
  customer_id text,
  customer_name text,
  issue_date date not null default current_date,
  warranty_expiry date,
  status text not null default 'open'
    check (status in ('open','under_review','approved','rejected','work_done','closed')),
  complaint text not null,
  resolution text,
  ticket_id text,
  resolved_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_slug, claim_number)
);

-- SLA engine: extend the existing sla_policies / support_tickets with
-- business-hours calendar, pause/fulfil statuses, breach detection.
alter table if exists sla_policies add column if not exists service_days jsonb not null default '["mon","tue","wed","thu","fri"]';
alter table if exists sla_policies add column if not exists business_start time not null default '08:00';
alter table if exists sla_policies add column if not exists business_end time not null default '17:00';
alter table if exists sla_policies add column if not exists pause_on_statuses text[] not null default '{}';
alter table if exists sla_policies add column if not exists fulfil_on_statuses text[] not null default '{resolved,closed}';
alter table if exists support_tickets add column if not exists sla_paused boolean not null default false;
alter table if exists support_tickets add column if not exists sla_paused_at timestamptz;
alter table if exists support_tickets add column if not exists sla_paused_total_minutes integer not null default 0;
alter table if exists support_tickets add column if not exists sla_breached boolean not null default false;
alter table if exists support_tickets add column if not exists sla_breach_type text;
