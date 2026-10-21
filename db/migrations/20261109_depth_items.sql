-- Depth items: timesheet billing, portals, POS, custom fields, CSV import,
-- storefront.

-- Timesheet → invoice link
alter table time_logs add column if not exists invoice_id text;
alter table projects add column if not exists customer_name text;
alter table projects add column if not exists customer_id text;
alter table projects add column if not exists billing_rate numeric;

-- Customer/vendor portal access tokens
create table if not exists portal_tokens (
  id text primary key,
  tenant_slug text not null,
  party_type text not null check (party_type in ('customer','vendor')),
  party_id text,
  party_name text not null,
  email text,
  token text not null unique,
  status text not null default 'active' check (status in ('active','revoked')),
  expires_at timestamptz,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists portal_tokens_tenant_idx on portal_tokens (tenant_slug, party_type, party_id);

-- POS sales
create table if not exists pos_sales (
  id text primary key,
  tenant_slug text not null,
  invoice_id text,
  warehouse_id text,
  payment_method text not null default 'cash',
  customer_name text,
  items jsonb not null,
  net_amount numeric not null,
  tax_amount numeric not null default 0,
  total_amount numeric not null,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists pos_sales_tenant_idx on pos_sales (tenant_slug, created_at);

-- Low-code custom field definitions per doctype.
-- Custom values live in each doctype's metadata.custom_fields jsonb — the
-- customizable doctypes below get a metadata column if they lack one.
alter table inventory_products add column if not exists metadata jsonb;
alter table projects add column if not exists metadata jsonb;
alter table admin_employees add column if not exists metadata jsonb;
alter table sales_orders add column if not exists metadata jsonb;

create table if not exists custom_field_defs (
  id text primary key,
  tenant_slug text not null,
  doctype text not null,
  field_name text not null,
  label text not null,
  field_type text not null check (field_type in ('text','number','date','boolean','select')),
  options jsonb,
  required boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_slug, doctype, field_name)
);

-- CSV import jobs
create table if not exists import_jobs (
  id text primary key,
  tenant_slug text not null,
  entity text not null,
  status text not null default 'completed',
  total_rows integer not null default 0,
  imported integer not null default 0,
  failed integer not null default 0,
  errors jsonb,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists import_jobs_tenant_idx on import_jobs (tenant_slug, created_at);

-- Storefront: public order records (catalog is read from inventory_products)
create table if not exists storefront_orders (
  id text primary key,
  tenant_slug text not null,
  order_number text not null,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  items jsonb not null,
  total numeric not null,
  status text not null default 'pending' check (status in ('pending','confirmed','fulfilled','cancelled')),
  sales_order_id text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists storefront_orders_tenant_idx on storefront_orders (tenant_slug, status);
