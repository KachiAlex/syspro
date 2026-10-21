-- Serial/batch tracking + e-invoice submissions
-- tracking: 'none' | 'serial' | 'batch' on inventory_products
alter table inventory_products add column if not exists tracking text not null default 'none';

alter table stock_movements add column if not exists lot_no text;
alter table stock_movements add column if not exists serial_nos jsonb;

create table if not exists inventory_serials (
  id text primary key,
  tenant_slug text not null,
  sku text not null,
  serial_no text not null,
  warehouse_id text,
  status text not null default 'in_stock', -- in_stock | issued | scrapped | returned
  received_movement_id text,
  issued_movement_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_slug, sku, serial_no)
);
create index if not exists inventory_serials_tenant_idx on inventory_serials (tenant_slug, sku, status);

create table if not exists inventory_lot_stock (
  id text primary key,
  tenant_slug text not null,
  sku text not null,
  lot_no text not null,
  warehouse_id text not null,
  qty_on_hand numeric(14,4) not null default 0,
  expiry_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_slug, sku, lot_no, warehouse_id)
);
create index if not exists inventory_lot_stock_expiry_idx on inventory_lot_stock (tenant_slug, expiry_date);

alter table inventory_stock_transfers add column if not exists serial_nos jsonb;
alter table inventory_stock_transfers add column if not exists lot_no text;

-- E-invoice submissions (FIRS/PEPPOL-style clearance)
alter table finance_invoices add column if not exists einvoice_status text;
alter table finance_invoices add column if not exists einvoice_irn text;

create table if not exists einvoice_submissions (
  id text primary key,
  tenant_slug text not null,
  invoice_id text not null,
  provider text not null default 'firs-sandbox',
  irn text not null,
  status text not null, -- submitted | accepted | rejected
  payload jsonb,
  response jsonb,
  submitted_by text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists einvoice_submissions_invoice_idx on einvoice_submissions (tenant_slug, invoice_id);
