-- Finance extensions: imprest/petty-cash funds, staff advances, payment
-- terms & schedules, customer credit limits, dunning, multi-currency,
-- bank statement lines, and payment-request (gateway) framework.
-- All new objects are additive and idempotent.

begin;

-- ---------------------------------------------------------------------------
-- Imprest / petty cash
-- ---------------------------------------------------------------------------
create table if not exists imprest_funds (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  custodian text,
  float_amount numeric not null default 0,
  petty_cash_account_code text not null default '1040',
  bank_account_code text not null default '1110',
  status text not null default 'active' check (status in ('active','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists imprest_funds_tenant_name_uq
  on imprest_funds (tenant_slug, name);

create table if not exists imprest_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  fund_id uuid not null references imprest_funds (id),
  txn_type text not null check (txn_type in ('replenishment','disbursement','adjustment')),
  txn_date date not null,
  amount numeric not null check (amount > 0),
  expense_account_code text,
  description text,
  journal_entry_id uuid,
  status text not null default 'posted' check (status in ('posted','reversed')),
  created_at timestamptz not null default now()
);
create index if not exists imprest_txn_fund_idx on imprest_transactions (fund_id, txn_date);
create index if not exists imprest_txn_tenant_idx on imprest_transactions (tenant_slug);

-- ---------------------------------------------------------------------------
-- Staff advances (issued -> applied to expenses -> settled / refunded)
-- ---------------------------------------------------------------------------
create table if not exists staff_advances (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  advance_number text not null,
  employee_name text not null,
  employee_id text,
  fund_id uuid references imprest_funds (id),
  amount numeric not null check (amount > 0),
  purpose text,
  status text not null default 'issued'
    check (status in ('issued','partially_settled','settled','refunded')),
  issue_date date not null,
  journal_entry_id uuid,
  applied_amount numeric not null default 0,
  refunded_amount numeric not null default 0,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists staff_advances_number_uq
  on staff_advances (tenant_slug, advance_number);
create index if not exists staff_advances_tenant_idx
  on staff_advances (tenant_slug, status);

create table if not exists staff_advance_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  advance_id uuid not null references staff_advances (id),
  expense_id text,
  amount numeric not null check (amount > 0),
  journal_entry_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists staff_advance_app_idx
  on staff_advance_applications (advance_id);

-- ---------------------------------------------------------------------------
-- Payment terms, invoice schedules, customer credit limits, dunning
-- ---------------------------------------------------------------------------
create table if not exists payment_terms (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  -- [{"days":30,"portion":100},{"days":60,"portion":0}] portions must sum 100
  terms jsonb not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists payment_terms_tenant_name_uq
  on payment_terms (tenant_slug, name);

create table if not exists invoice_payment_schedule (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  invoice_id text not null references finance_invoices (id) on delete cascade,
  due_date date not null,
  amount numeric not null,
  paid_amount numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists invoice_pay_sched_idx
  on invoice_payment_schedule (invoice_id, due_date);
create index if not exists invoice_pay_sched_due_idx
  on invoice_payment_schedule (tenant_slug, due_date) where paid_amount < amount;

create table if not exists finance_customers (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  customer_code text not null,
  name text not null,
  credit_limit numeric,
  credit_hold boolean not null default false,
  payment_term_id uuid references payment_terms (id),
  default_currency text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_slug, customer_code)
);
create index if not exists finance_customers_name_idx
  on finance_customers (tenant_slug, name);

create table if not exists dunning_notices (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  invoice_id text not null references finance_invoices (id),
  level integer not null,
  issue_date date not null,
  method text not null default 'letter',
  fee_amount numeric not null default 0,
  journal_entry_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists dunning_invoice_idx
  on dunning_notices (tenant_slug, invoice_id, level);

alter table finance_invoices add column if not exists payment_term_id uuid;
alter table finance_invoices add column if not exists customer_id uuid;

-- ---------------------------------------------------------------------------
-- Multi-currency
-- ---------------------------------------------------------------------------
create table if not exists exchange_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  currency text not null,
  rate_date date not null,
  -- units of `currency` per 1 unit of tenant base currency
  rate numeric not null check (rate > 0),
  created_at timestamptz not null default now(),
  unique (tenant_slug, currency, rate_date)
);

alter table finance_invoices add column if not exists transaction_currency text;
alter table finance_invoices add column if not exists exchange_rate numeric;
alter table finance_payments add column if not exists transaction_currency text;
alter table finance_payments add column if not exists exchange_rate numeric;

-- ---------------------------------------------------------------------------
-- Bank statement import + matching
-- ---------------------------------------------------------------------------
create table if not exists bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  bank_account_code text not null,
  line_date date not null,
  description text,
  reference text,
  -- positive = deposit, negative = withdrawal
  amount numeric not null,
  status text not null default 'unmatched'
    check (status in ('unmatched','matched','ignored','posted')),
  matched_entity text,
  matched_id text,
  journal_entry_id uuid,
  reconciliation_id text,
  created_at timestamptz not null default now()
);
create index if not exists bank_stmt_lines_idx
  on bank_statement_lines (tenant_slug, bank_account_code, line_date);
create index if not exists bank_stmt_lines_status_idx
  on bank_statement_lines (tenant_slug, status);

-- ---------------------------------------------------------------------------
-- Payment requests (gateway framework: paystack / flutterwave / stripe)
-- ---------------------------------------------------------------------------
create table if not exists payment_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  invoice_id text not null references finance_invoices (id),
  provider text not null check (provider in ('paystack','flutterwave','stripe','manual')),
  reference text not null,
  amount numeric not null,
  currency text,
  status text not null default 'pending'
    check (status in ('pending','paid','failed','expired')),
  link_url text,
  provider_reference text,
  paid_payment_id text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_slug, reference)
);
create index if not exists payment_requests_invoice_idx
  on payment_requests (invoice_id, status);

commit;
