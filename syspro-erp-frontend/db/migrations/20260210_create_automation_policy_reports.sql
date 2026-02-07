-- Automation, Policies, Reports schema
-- Ensure pgcrypto for gen_random_uuid
create extension if not exists "pgcrypto";

-- Automation rules
create table if not exists automation_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  description text,
  event_type text not null,
  condition jsonb not null,
  actions jsonb not null,
  scope jsonb,
  enabled boolean default true,
  simulation_only boolean default false,
  version integer default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists automation_rules_tenant_idx on automation_rules (tenant_slug);
create index if not exists automation_rules_event_idx on automation_rules (event_type);

-- Automation audits
create table if not exists automation_rule_audits (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid references automation_rules(id) on delete set null,
  tenant_slug text not null,
  trigger_event jsonb,
  matched boolean,
  result jsonb,
  actor text,
  scope jsonb,
  simulation boolean default false,
  created_at timestamptz default now()
);

create index if not exists automation_rule_audits_rule_idx on automation_rule_audits (rule_id);
create index if not exists automation_rule_audits_tenant_idx on automation_rule_audits (tenant_slug);

-- Automation action queue
create table if not exists automation_action_queue (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid references automation_rules(id) on delete set null,
  tenant_slug text not null,
  action_type text not null,
  action_payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  error text,
  scheduled_for timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists automation_action_queue_status_idx on automation_action_queue (status);
create index if not exists automation_action_queue_rule_idx on automation_action_queue (rule_id);
create index if not exists automation_action_queue_tenant_idx on automation_action_queue (tenant_slug);

-- Policies
create table if not exists policies (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  policy_key text not null,
  name text not null,
  category text,
  scope jsonb,
  status text not null default 'draft' check (status in ('draft','published','deprecated')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (tenant_slug, policy_key)
);

create table if not exists policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references policies(id) on delete cascade,
  version integer not null,
  document jsonb not null,
  effective_at timestamptz,
  created_at timestamptz default now(),
  unique (policy_id, version)
);

create index if not exists policy_versions_policy_idx on policy_versions (policy_id);

create table if not exists policy_overrides (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references policies(id) on delete cascade,
  tenant_slug text not null,
  scope jsonb,
  reason text,
  created_by text,
  created_at timestamptz default now()
);

create index if not exists policy_overrides_policy_idx on policy_overrides (policy_id);
create index if not exists policy_overrides_tenant_idx on policy_overrides (tenant_slug);

-- Reports
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
);

create index if not exists reports_tenant_idx on reports (tenant_slug);

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
  created_at timestamptz default now()
);

create index if not exists report_jobs_report_idx on report_jobs (report_id);
create index if not exists report_jobs_tenant_idx on report_jobs (tenant_slug);
create index if not exists report_jobs_status_idx on report_jobs (status);
