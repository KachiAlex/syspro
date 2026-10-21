-- POS hardening: integrity, cash control, registers, returns, held sales, price lists, loyalty.

-- Registers (multi-till): each register runs its own shift.
create table if not exists pos_registers (
  id text primary key,
  tenant_slug text not null,
  code text not null,
  name text not null,
  warehouse_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_slug, code)
);

-- Sequential receipt numbering per register (fiscal series).
create table if not exists pos_counters (
  tenant_slug text not null,
  counter_key text not null,
  next_seq bigint not null default 1,
  primary key (tenant_slug, counter_key)
);

-- Mid-shift cash movements: pay_in, pay_out, bank drop.
create table if not exists pos_cash_movements (
  id text primary key,
  tenant_slug text not null,
  shift_id text not null,
  register_id text,
  type text not null check (type in ('pay_in','pay_out','drop')),
  amount numeric not null check (amount > 0),
  reason text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists pos_cash_movements_shift on pos_cash_movements (tenant_slug, shift_id);

-- Parked / held sales (suspend a cart, resume later).
create table if not exists pos_held_sales (
  id text primary key,
  tenant_slug text not null,
  register_id text,
  label text,
  cart jsonb not null,
  customer_code text,
  created_by text,
  created_at timestamptz not null default now()
);

-- POS returns (linked to the originating sale + finance credit note).
create table if not exists pos_returns (
  id text primary key,
  tenant_slug text not null,
  sale_id text not null,
  invoice_id text,
  credit_note_id text,
  items jsonb not null,
  refund_method text not null default 'cash',
  refund_amount numeric not null,
  restocked boolean not null default false,
  reason text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists pos_returns_sale on pos_returns (tenant_slug, sale_id);

-- Customer price lists.
create table if not exists pos_price_lists (
  id text primary key,
  tenant_slug text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists pos_price_list_items (
  id text primary key,
  tenant_slug text not null,
  price_list_id text not null references pos_price_lists (id) on delete cascade,
  sku text not null,
  price numeric not null check (price >= 0),
  unique (price_list_id, sku)
);

-- Loyalty ledger.
create table if not exists pos_loyalty_txns (
  id text primary key,
  tenant_slug text not null,
  customer_code text not null,
  sale_id text,
  type text not null check (type in ('earn','redeem','adjust')),
  points numeric not null,
  value numeric,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists pos_loyalty_txns_customer on pos_loyalty_txns (tenant_slug, customer_code);

-- POS audit trail (discounts, price overrides, returns, cash movements, shift events).
create table if not exists pos_audit_log (
  id text primary key,
  tenant_slug text not null,
  actor text,
  action text not null,
  entity_type text,
  entity_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists pos_audit_log_tenant on pos_audit_log (tenant_slug, created_at desc);

-- pos_sales hardening columns.
alter table if exists pos_sales add column if not exists receipt_no text;
alter table if exists pos_sales add column if not exists receipt_seq bigint;
alter table if exists pos_sales add column if not exists register_id text;
alter table if exists pos_sales add column if not exists status text not null default 'completed';
alter table if exists pos_sales add column if not exists tenders jsonb;
alter table if exists pos_sales add column if not exists amount_tendered numeric;
alter table if exists pos_sales add column if not exists change_due numeric;
alter table if exists pos_sales add column if not exists discount_amount numeric not null default 0;
alter table if exists pos_sales add column if not exists discount_reason text;
alter table if exists pos_sales add column if not exists rounding_amount numeric not null default 0;
alter table if exists pos_sales add column if not exists card_fees numeric not null default 0;
alter table if exists pos_sales add column if not exists customer_code text;
alter table if exists pos_sales add column if not exists idempotency_key text;
alter table if exists pos_sales add column if not exists error text;
create unique index if not exists pos_sales_idem on pos_sales (tenant_slug, idempotency_key) where idempotency_key is not null;
create index if not exists pos_sales_receipt on pos_sales (tenant_slug, receipt_no);

-- Shift scoping: one open shift per register (coalesce keeps a single tenant-wide
-- open shift valid when registers aren't used).
alter table if exists pos_shifts add column if not exists register_id text;
alter table if exists pos_shifts add column if not exists flagged boolean not null default false;
alter table if exists pos_shifts add column if not exists variance_reason text;
drop index if exists pos_shifts_one_open;
create unique index if not exists pos_shifts_one_open
  on pos_shifts (tenant_slug, coalesce(register_id, '')) where status = 'open';

-- Products may opt in to negative stock (default: guard blocks overselling).
alter table if exists inventory_products add column if not exists allow_negative_stock boolean not null default false;

-- Rounding/write-off GL account.
insert into chart_of_accounts (id, tenant_slug, code, name, type, account_code, account_name, account_type, currency, is_active, is_system_account, created_at, updated_at)
select gen_random_uuid(), null, '6900', 'Rounding & Write-offs', 'expense', '6900', 'Rounding & Write-offs', 'EXPENSE', 'NGN', true, true, now(), now()
where not exists (select 1 from chart_of_accounts where coalesce(code, account_code) = '6900' and tenant_slug is null);
