-- ERPNext depth tranches B–F: ERP tools, deferred accounting, ledger
-- integrity, tax/pricing engine, asset depth, treasury. All idempotent;
-- runtime ensure-paths provision the same shapes so this is parity DDL.

-- ─── Tranche B: ERP tools ───────────────────────────────────────────────────

create table if not exists payment_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  status text not null default 'draft',
  payment_date date,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists mode_of_payment (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  type text not null default 'cash',
  account_code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_slug, name)
);

create table if not exists monthly_distributions (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  percentages jsonb not null,
  created_at timestamptz not null default now(),
  unique (tenant_slug, name)
);

create table if not exists cost_center_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  account_code text not null,
  allocations jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_slug, account_code)
);

create table if not exists statement_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  party_type text not null,
  as_of date not null,
  emailed integer not null default 0,
  failed integer not null default 0,
  created_at timestamptz not null default now()
);

-- ─── Tranche C: deferred accounting + ledger integrity ──────────────────────

create table if not exists deferred_items (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  direction text not null check (direction in ('revenue','expense')),
  document_type text not null,
  document_id text not null,
  line_no integer,
  party text,
  item text,
  total_amount numeric not null,
  recognized_amount numeric not null default 0,
  service_start_date date not null,
  service_end_date date not null,
  deferred_account_code text not null,
  recognition_account_code text not null,
  status text not null default 'open' check (status in ('open','completed','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists deferred_items_idx on deferred_items (tenant_slug, status, service_end_date);

create table if not exists deferred_schedule (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  deferred_item_id uuid not null references deferred_items (id) on delete cascade,
  period_date date not null,
  amount numeric not null,
  journal_entry_id text,
  status text not null default 'pending' check (status in ('pending','posted')),
  created_at timestamptz not null default now(),
  unique (deferred_item_id, period_date)
);

create table if not exists transaction_deletion_records (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  document_type text not null,
  document_id text not null,
  document_data jsonb,
  deleted_by text,
  reason text,
  created_at timestamptz not null default now()
);
alter table if exists transaction_deletion_records add column if not exists created_at timestamptz not null default now();
create index if not exists txn_del_idx on transaction_deletion_records (tenant_slug, document_type);

-- ─── Tranche D: tax engine + pricing ────────────────────────────────────────

create table if not exists tax_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  direction text not null default 'sales' check (direction in ('sales','purchase','both')),
  lines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_slug, name)
);

create table if not exists item_tax_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  item text not null,
  tax_template_id uuid references tax_templates (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (tenant_slug, item)
);

create table if not exists party_tax_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  party_type text not null,
  party_id text not null,
  tax_category text not null,
  created_at timestamptz not null default now(),
  unique (tenant_slug, party_type, party_id)
);

create table if not exists tax_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  priority integer not null default 0,
  direction text not null default 'sales' check (direction in ('sales','purchase')),
  tax_category text,
  party_type text,
  party_id text,
  item text,
  min_amount numeric,
  max_amount numeric,
  valid_from date,
  valid_to date,
  tax_template_id uuid references tax_templates (id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists tax_rules_idx on tax_rules (tenant_slug, direction, priority);

create table if not exists tax_withholding_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  rates jsonb not null,
  account_code text not null default '2210',
  created_at timestamptz not null default now(),
  unique (tenant_slug, name)
);

create table if not exists tax_withholding_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  category_id uuid not null references tax_withholding_categories (id) on delete cascade,
  party_type text not null,
  party_id text not null,
  document_type text not null,
  document_id text not null,
  fiscal_year integer not null,
  taxable_amount numeric not null,
  withheld_amount numeric not null,
  rate numeric not null,
  created_at timestamptz not null default now()
);
create index if not exists tds_entries_idx
  on tax_withholding_entries (tenant_slug, party_id, fiscal_year);

create table if not exists shipping_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  min_value numeric,
  max_value numeric,
  min_weight numeric,
  max_weight numeric,
  charge_type text not null default 'flat' check (charge_type in ('flat','percent')),
  charge_value numeric not null,
  account_code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_slug, name)
);

create table if not exists pricing_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  priority integer not null default 0,
  item text,
  item_category text,
  party_type text,
  party_id text,
  min_qty numeric,
  valid_from date,
  valid_to date,
  mode text not null default 'discount_pct' check (mode in ('price','discount_pct','margin')),
  value numeric not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists pricing_rules_idx on pricing_rules (tenant_slug, priority);

create table if not exists promotional_schemes (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  rules jsonb not null default '[]'::jsonb,
  valid_from date,
  valid_to date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_slug, name)
);

create table if not exists coupon_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  code text not null,
  description text,
  discount_type text not null default 'percent' check (discount_type in ('percent','fixed')),
  discount_value numeric not null,
  min_order_value numeric,
  valid_from date,
  valid_to date,
  max_uses integer,
  used_count integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_slug, code)
);

-- ─── Tranche E: asset depth ─────────────────────────────────────────────────

alter table if exists asset_maintenance add column if not exists parts jsonb not null default '[]'::jsonb;
alter table if exists asset_maintenance add column if not exists purchase_invoice_id text;

create table if not exists asset_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  parent_name text,
  created_at timestamptz not null default now(),
  unique (tenant_slug, name)
);

create table if not exists asset_finance_books (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  asset_id text not null,
  finance_book text not null,
  method text not null default 'straight_line',
  useful_life_months integer,
  total_expected_units numeric,
  depreciated_units numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_slug, asset_id, finance_book)
);

create table if not exists asset_usage_log (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  asset_id text not null,
  period_date date not null,
  units numeric not null,
  finance_book text not null default 'main',
  created_at timestamptz not null default now()
);
create index if not exists asset_usage_idx on asset_usage_log (tenant_slug, asset_id);

-- ─── Tranche F: treasury ────────────────────────────────────────────────────

create table if not exists bank_recon_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  priority integer not null default 0,
  match_field text not null default 'description' check (match_field in ('description','reference')),
  pattern text not null,
  account_code text,
  party_type text check (party_type in ('customer','vendor')),
  party_id text,
  amount_tolerance numeric,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists bank_recon_rules_idx on bank_recon_rules (tenant_slug, priority);

create table if not exists bank_guarantees (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  direction text not null check (direction in ('issued','received')),
  beneficiary text not null,
  bank text not null,
  amount numeric not null,
  currency text not null default 'NGN',
  start_date date not null,
  end_date date not null,
  margin_amount numeric not null default 0,
  status text not null default 'open' check (status in ('open','claimed','released','expired')),
  journal_entry_id text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists invoice_discountings (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  invoice_id text not null,
  bank text not null,
  loan_amount numeric not null,
  disbursement_date date not null,
  period_days integer not null default 90,
  status text not null default 'sanctioned' check (status in ('sanctioned','settled','closed')),
  journal_entry_id text,
  settled_date date,
  created_at timestamptz not null default now()
);

create table if not exists subscription_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  item text not null,
  unit_price numeric not null,
  qty numeric not null default 1,
  interval text not null default 'monthly' check (interval in ('daily','weekly','monthly','quarterly','yearly')),
  revenue_account_code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_slug, name)
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  customer_id text not null,
  plan_id uuid not null references subscription_plans (id) on delete cascade,
  start_date date not null,
  end_date date,
  next_invoice_date date not null,
  status text not null default 'active' check (status in ('active','paused','cancelled','ended')),
  party_account_code text,
  bank_account_code text,
  created_at timestamptz not null default now()
);
create index if not exists subscriptions_due_idx
  on subscriptions (tenant_slug, status, next_invoice_date);

create table if not exists subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  subscription_id uuid not null references subscriptions (id) on delete cascade,
  invoice_id text not null,
  period_start date not null,
  period_end date not null,
  amount numeric not null,
  created_at timestamptz not null default now(),
  unique (subscription_id, period_start)
);

alter table if exists exchange_rates add column if not exists source text not null default 'manual';
