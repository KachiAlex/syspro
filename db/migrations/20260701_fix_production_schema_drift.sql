-- Align older production databases with the schema the application expects.
-- All statements are idempotent and non-destructive: only ADD COLUMN /
-- CREATE TABLE IF NOT EXISTS / index creation / backfills.

-- ─── tenants: columns added by newer code paths ───────────────────────────
alter table if exists tenants add column if not exists code text;
alter table if exists tenants add column if not exists domain text;
alter table if exists tenants add column if not exists "schemaName" text;
alter table if exists tenants add column if not exists "createdAt" timestamptz default now();
alter table if exists tenants add column if not exists "updatedAt" timestamptz default now();
alter table if exists tenants add column if not exists "deletedAt" timestamptz;
alter table if exists tenants add column if not exists settings jsonb default '{}'::jsonb;
alter table if exists tenants add column if not exists region text;
alter table if exists tenants add column if not exists industry text;
alter table if exists tenants add column if not exists seats integer;
alter table if exists tenants add column if not exists status text default 'Pending';
alter table if exists tenants add column if not exists ledger_delta text default '₦0';
alter table if exists tenants add column if not exists admin_name text;
alter table if exists tenants add column if not exists admin_email text;
alter table if exists tenants add column if not exists admin_password_hash text;
alter table if exists tenants add column if not exists admin_notes text;
alter table if exists tenants add column if not exists default_region_id text;
alter table if exists tenants add column if not exists default_region_name text;
alter table if exists tenants add column if not exists default_branch_id text;
alter table if exists tenants add column if not exists default_branch_name text;
alter table if exists tenants add column if not exists "isActive" boolean default false;
alter table if exists tenants add column if not exists industry_profiles jsonb default '[]'::jsonb;

-- Backfill camelCase timestamps from the legacy snake_case columns, only
-- where those legacy columns exist.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'tenants' and column_name = 'created_at') then
    update tenants set "createdAt" = created_at
      where "createdAt" is null and created_at is not null;
  end if;
  if exists (select 1 from information_schema.columns
             where table_name = 'tenants' and column_name = 'updated_at') then
    update tenants set "updatedAt" = updated_at
      where "updatedAt" is null and updated_at is not null;
  end if;
end $$;

create unique index if not exists tenants_slug_key on tenants(slug);

-- ─── tenant_admins: tenant_slug used by tenant-scoped queries ─────────────
alter table if exists tenant_admins add column if not exists tenant_slug text;

do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'tenant_admins')
     and exists (select 1 from information_schema.tables where table_name = 'tenants')
     and exists (select 1 from information_schema.columns
                 where table_name = 'tenant_admins' and column_name = 'tenant_id') then
    update tenant_admins ta
      set tenant_slug = t.slug
      from tenants t
      where ta.tenant_id = t.id and ta.tenant_slug is null;
  end if;
end $$;

create index if not exists tenant_admins_tenant_slug_idx on tenant_admins(tenant_slug);

-- ─── employee password reset tokens ───────────────────────────────────────
create table if not exists admin_password_reset_tokens (
  id serial primary key,
  tenant_slug text not null,
  employee_id text,
  token text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists admin_password_reset_tokens_token_idx
  on admin_password_reset_tokens(token);
create index if not exists admin_password_reset_tokens_tenant_idx
  on admin_password_reset_tokens(tenant_slug);

-- ─── tenant security settings + notification preferences ──────────────────
create table if not exists tenant_security_settings (
  tenant_slug text primary key,
  mfa_settings jsonb not null default '{}'::jsonb,
  security_metrics jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists user_notification_preferences (
  user_id text primary key,
  tenant_slug text,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ─── tenant-admin tables referenced by the app but missing in older DBs ───
-- Uses the tenant_slug-based shape from src/lib/tenant-admin/schema.ts (the
-- earlier admin_tables migration used a uuid tenant_id model that predates
-- integer tenant ids).
create table if not exists admin_security_policies (
  id text primary key,
  tenant_slug text not null,
  name text not null,
  description text,
  rules jsonb not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by text,
  updated_by text
);
create index if not exists idx_admin_security_policies_tenant
  on admin_security_policies(tenant_slug);

create table if not exists admin_audit_logs (
  id text primary key,
  tenant_slug text not null,
  user_id text not null,
  action text not null,
  resource text not null,
  resource_id text not null,
  changes jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);
create index if not exists idx_admin_audit_logs_tenant
  on admin_audit_logs(tenant_slug);
create index if not exists idx_admin_audit_logs_user on admin_audit_logs(user_id);
create index if not exists idx_admin_audit_logs_resource
  on admin_audit_logs(resource, resource_id);
create index if not exists idx_admin_audit_logs_created
  on admin_audit_logs(created_at desc);

create table if not exists admin_workflow_executions (
  id text primary key,
  tenant_slug text not null,
  workflow_id text not null,
  triggered_by text not null,
  current_step_id text,
  status text default 'running',
  execution_history jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_admin_workflow_executions_tenant
  on admin_workflow_executions(tenant_slug);

-- admin_workflows existed in older DBs without the newer columns.
alter table if exists admin_workflows add column if not exists trigger text default 'manual';
alter table if exists admin_workflows add column if not exists status text default 'draft';
alter table if exists admin_workflows add column if not exists is_active boolean default false;
alter table if exists admin_workflows add column if not exists description text;
alter table if exists admin_workflows add column if not exists created_by text;
alter table if exists admin_workflows add column if not exists updated_by text;
create index if not exists idx_admin_workflows_active on admin_workflows(is_active);

create table if not exists admin_integrations (
  id text primary key,
  tenant_slug text not null,
  name text not null,
  type text not null check (type in ('webhook', 'oauth', 'api_key', 'custom')),
  status text default 'inactive' check (status in ('active', 'inactive', 'error', 'pending')),
  provider text,
  config jsonb not null,
  webhook_url text,
  events text[] default array[]::text[],
  last_sync_at timestamptz,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by text,
  updated_by text
);
create index if not exists idx_admin_integrations_tenant
  on admin_integrations(tenant_slug);

create table if not exists admin_api_keys (
  id text primary key,
  tenant_slug text not null,
  name text not null,
  key text not null unique,
  secret text not null,
  permissions jsonb not null,
  rate_limit integer,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz default now(),
  created_by text,
  constraint unique_key_per_tenant unique (tenant_slug, key)
);

-- ─── audit log action constraint was too restrictive ──────────────────────
alter table if exists admin_audit_logs drop constraint if exists admin_audit_logs_action_check;
