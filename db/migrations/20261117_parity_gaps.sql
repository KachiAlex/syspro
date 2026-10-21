-- Tranche G — ERPNext parity gaps (2026-11-17)
-- equity, sales partners, invoice loyalty, pegged currencies, cheque print,
-- bank clearance, process run logs, tax packs. All idempotent.

-- ─── Equity: share types, shareholders, transfers ────────────────────────────
create table if not exists share_types (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  face_value numeric not null,
  premium numeric not null default 0,
  capital_account_code text not null default '3210',
  premium_account_code text not null default '3220',
  unique (tenant_slug, name)
);

create table if not exists shareholders (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  email text,
  address text,
  folio_no text,
  created_at timestamptz not null default now(),
  unique (tenant_slug, name)
);

create table if not exists share_transfers (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  transfer_type text not null check (transfer_type in ('issue','purchase','transfer')),
  share_type_id uuid not null references share_types(id),
  from_shareholder_id uuid references shareholders(id),
  to_shareholder_id uuid references shareholders(id),
  qty numeric not null,
  rate numeric not null,
  posting_date date not null,
  bank_account_code text not null default '1100',
  journal_entry_id text,
  status text not null default 'posted' check (status in ('posted','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists share_transfers_idx on share_transfers (tenant_slug, posting_date);

-- ─── Sales partners & commissions ────────────────────────────────────────────
create table if not exists sales_partners (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  partner_type text not null default 'agent' check (partner_type in ('agent','reseller','referrer','distributor')),
  commission_rate numeric not null,
  email text, phone text, territory text,
  expense_account_code text not null default '6500',
  payable_account_code text not null default '2350',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_slug, name)
);

create table if not exists sales_partner_commissions (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  partner_id uuid not null references sales_partners(id) on delete cascade,
  invoice_id text not null,
  invoice_amount numeric not null,
  commission_rate numeric not null,
  commission_amount numeric not null,
  status text not null default 'accrued' check (status in ('accrued','paid','cancelled')),
  accrual_journal_entry_id text,
  payout_journal_entry_id text,
  paid_date date,
  created_at timestamptz not null default now(),
  unique (tenant_slug, partner_id, invoice_id)
);

alter table finance_invoices add column if not exists sales_partner_id uuid;

-- ─── Invoice-side loyalty programs ───────────────────────────────────────────
create table if not exists loyalty_programs (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  earn_rate numeric not null,
  redeem_value numeric not null,
  min_points_to_redeem integer not null default 0,
  max_redeem_pct numeric not null default 100,
  expense_account_code text not null default '6100',
  expiry_days integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_slug, name)
);

create table if not exists loyalty_point_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  program_id uuid not null references loyalty_programs(id) on delete cascade,
  customer_code text not null,
  invoice_id text,
  type text not null check (type in ('earn','redeem')),
  points numeric not null,
  discount_amount numeric,
  expiry_date date,
  created_at timestamptz not null default now(),
  unique (tenant_slug, program_id, invoice_id, type)
);

-- ─── Pegged currencies ───────────────────────────────────────────────────────
create table if not exists pegged_currencies (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  currency text not null,
  pegged_to text not null,
  rate numeric not null,
  active boolean not null default true,
  unique (tenant_slug, currency),
  check (currency <> pegged_to)
);

-- ─── Cheque print templates ──────────────────────────────────────────────────
create table if not exists cheque_print_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  bank text,
  fields jsonb not null,
  scan_url text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_slug, name)
);

-- ─── Bank clearance ──────────────────────────────────────────────────────────
alter table bank_statement_lines add column if not exists clearance_date date;
alter table bank_statement_lines add column if not exists cleared boolean not null default false;

-- ─── Process run audit logs ──────────────────────────────────────────────────
create table if not exists process_run_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  process text not null,
  params jsonb,
  result jsonb,
  item_count integer,
  status text not null check (status in ('success','partial','failed')),
  error text,
  duration_ms integer,
  run_by text,
  created_at timestamptz not null default now()
);
create index if not exists process_run_logs_idx
  on process_run_logs (tenant_slug, process, created_at desc);

-- ─── Tax pack applications ───────────────────────────────────────────────────
create table if not exists tax_pack_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  pack_code text not null,
  applied_by text,
  detail jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_slug, pack_code)
);

-- ─── Equity GL accounts (shared CoA rows, matching gl.ts convention) ─────────
insert into chart_of_accounts (
  id, tenant_slug, code, name, type,
  account_code, account_name, account_type,
  currency, is_active, is_system_account, created_at, updated_at
)
select gen_random_uuid(), null, v.code, v.name, 'equity',
       v.code, v.name, 'EQUITY', 'NGN', true, true, now(), now()
from (values
  ('3210', 'Share Capital'),
  ('3220', 'Share Premium')
) v(code, name)
on conflict do nothing;
