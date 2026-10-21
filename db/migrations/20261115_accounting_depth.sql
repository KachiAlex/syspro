-- 20261115_accounting_depth.sql
-- ERPNext accounting-depth extensions. All statements are additive and
-- idempotent; the application also self-provisions these via ensure-paths,
-- so this file is the canonical record of intended schema.

-- Finance Book: parallel ledger books on journal entries (default 'main').
alter table if exists journal_entries
  add column if not exists finance_book text not null default 'main';

-- Configurable accounting dimensions (ERPNext Accounting Dimension).
create table if not exists accounting_dimensions (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  dimension_key text not null,
  label text not null,
  required_for jsonb not null default '[]'::jsonb,
  allowed_values jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_slug, dimension_key)
);
alter table if exists journal_entry_lines
  add column if not exists dimensions jsonb;

-- Tenant accounting settings (ERPNext Accounts Settings document).
create table if not exists finance_settings (
  tenant_slug text primary key,
  accounts_frozen_until date,
  credit_check_mode text not null default 'block',
  auto_exchange_revaluation boolean not null default false,
  default_payment_terms_days integer not null default 30,
  updated_at timestamptz not null default now()
);

-- Journal entry templates (ERPNext Journal Entry Template).
create table if not exists journal_entry_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  description text,
  journal_type text not null default 'MANUAL',
  lines jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_slug, name)
);

-- Asset lifecycle: locations/movements, maintenance, value adjustments,
-- capitalizations.
alter table if exists fixed_assets
  add column if not exists location text;
alter table if exists fixed_assets
  add column if not exists custodian text;
alter table if exists fixed_assets
  add column if not exists finance_book text not null default 'main';
alter table if exists asset_depreciation_schedule
  add column if not exists finance_book text not null default 'main';

create table if not exists asset_maintenance_teams (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  members jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_slug, name)
);

create table if not exists asset_maintenance (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  asset_id text not null references fixed_assets (id) on delete cascade,
  kind text not null default 'preventive',
  team_name text,
  status text not null default 'scheduled',
  scheduled_date date,
  completed_date date,
  description text,
  cost numeric not null default 0,
  journal_entry_id text,
  created_at timestamptz not null default now()
);
create index if not exists asset_maint_idx
  on asset_maintenance (tenant_slug, asset_id, status);

create table if not exists asset_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  asset_id text not null references fixed_assets (id) on delete cascade,
  from_location text,
  to_location text,
  custodian text,
  moved_at timestamptz not null default now(),
  notes text
);
create index if not exists asset_move_idx
  on asset_movements (tenant_slug, asset_id);

create table if not exists asset_value_adjustments (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  asset_id text not null references fixed_assets (id) on delete cascade,
  adjustment_date date not null,
  old_nbv numeric not null,
  new_nbv numeric not null,
  delta numeric not null,
  reason text,
  journal_entry_id text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists asset_capitalizations (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  asset_id text references fixed_assets (id) on delete set null,
  capitalization_date date not null,
  source_account_code text not null,
  amount numeric not null,
  journal_entry_id text,
  created_at timestamptz not null default now()
);
