-- Sales/purchase returns, landed cost vouchers, recurring invoices,
-- multi-entity consolidation support.

create table if not exists finance_returns (
  id text primary key,
  tenant_slug text not null,
  direction text not null check (direction in ('sales','purchase')),
  source_document_id text not null,       -- invoice id or bill id
  document_no text not null,              -- CN-xxx / DN-xxx
  status text not null default 'posted' check (status in ('draft','posted','void')),
  items jsonb not null,                   -- [{description, sku?, quantity, unitPrice, taxRate}]
  net_amount numeric not null,
  tax_amount numeric not null default 0,
  total_amount numeric not null,
  reason text,
  restock boolean not null default false,
  journal_entry_id text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists finance_returns_tenant_idx on finance_returns (tenant_slug, direction, created_at);
create index if not exists finance_returns_source_idx on finance_returns (tenant_slug, source_document_id);

create table if not exists landed_cost_vouchers (
  id text primary key,
  tenant_slug text not null,
  reference_id text not null,             -- goods receipt / PO / movement ref
  charge_type text not null,              -- freight | customs_duty | insurance | other
  total_amount numeric not null,
  allocation_method text not null default 'value' check (allocation_method in ('value','quantity','manual')),
  allocations jsonb,                      -- computed [{sku, amount}]
  expense_account_code text,
  journal_entry_id text,
  status text not null default 'posted' check (status in ('draft','posted','void')),
  created_at timestamptz not null default now()
);
create index if not exists landed_cost_vouchers_tenant_idx on landed_cost_vouchers (tenant_slug);

create table if not exists recurring_invoices (
  id text primary key,
  tenant_slug text not null,
  customer_name text not null,
  customer_code text,
  frequency text not null check (frequency in ('daily','weekly','monthly','quarterly','yearly')),
  next_run_date date not null,
  end_date date,
  status text not null default 'active' check (status in ('active','paused','completed')),
  template jsonb not null,                -- {lineItems, currency, paymentTerms, notes, taxRate}
  last_invoice_id text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recurring_invoices_due_idx on recurring_invoices (tenant_slug, status, next_run_date);

-- Consolidated reporting across member entities of one group
alter table tenants add column if not exists consolidation_group text;
