-- Marketing & Sales core tables
-- Migration: 2026-02-13

create table if not exists marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  type text,
  objective text,
  channels jsonb,
  budget numeric default 0,
  region text,
  owner_id text,
  status text default 'draft',
  approval_state text default 'pending',
  start_date date,
  end_date date,
  created_by text,
  approved_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists marketing_campaigns_tenant_idx on marketing_campaigns (tenant_slug);
create index if not exists marketing_campaigns_region_idx on marketing_campaigns (region);

create table if not exists marketing_lead_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  key text not null,
  name text not null,
  type text,
  metadata jsonb,
  created_at timestamptz default now()
);
create index if not exists marketing_lead_sources_tenant_idx on marketing_lead_sources (tenant_slug);

create table if not exists marketing_leads (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  campaign_id uuid references marketing_campaigns(id) on delete set null,
  source_id uuid references marketing_lead_sources(id) on delete set null,
  cost_center text,
  contact_id text,
  name text,
  email text,
  phone text,
  status text default 'new',
  score numeric default 0,
  attribution jsonb,
  created_at timestamptz default now(),
  converted_at timestamptz
);
create index if not exists marketing_leads_tenant_idx on marketing_leads (tenant_slug);
create index if not exists marketing_leads_campaign_idx on marketing_leads (campaign_id);

create table if not exists marketing_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  campaign_id uuid references marketing_campaigns(id) on delete set null,
  type text,
  url text,
  metadata jsonb,
  version integer default 1,
  approval_state text default 'pending',
  approved_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists sales_opportunities (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  lead_id uuid references marketing_leads(id) on delete set null,
  account_id text,
  campaign_id uuid references marketing_campaigns(id) on delete set null,
  value numeric default 0,
  currency text default 'USD',
  stage text,
  assigned_to text,
  created_at timestamptz default now(),
  closed_at timestamptz,
  won boolean default false
);
create index if not exists sales_opps_tenant_idx on sales_opportunities (tenant_slug);
create index if not exists sales_opps_campaign_idx on sales_opportunities (campaign_id);

create table if not exists sales_activities (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  opportunity_id uuid references sales_opportunities(id) on delete cascade,
  type text,
  actor text,
  occurred_at timestamptz default now(),
  notes text,
  linked_campaign_id uuid references marketing_campaigns(id) on delete set null
);

create table if not exists marketing_campaign_costs (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  campaign_id uuid references marketing_campaigns(id) on delete cascade,
  amount numeric not null,
  currency text default 'USD',
  date date,
  note text,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists marketing_attribution_records (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  opportunity_id uuid references sales_opportunities(id) on delete set null,
  model text not null,
  attribution jsonb,
  total numeric default 0,
  calculated_at timestamptz default now()
);
