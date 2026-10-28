-- Purchase receipts (GRN) + three-way match
create table if not exists purchase_receipts (
  id text primary key,
  tenant_slug text not null,
  receipt_number text not null,
  purchase_order_id text,
  vendor_id text,
  vendor_name text,
  warehouse_id text,
  location text,
  received_date date not null,
  status text not null default 'pending' check (status in ('pending','received','rejected','cancelled')),
  total_amount numeric not null default 0,
  approval_id text,
  notes text,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists purchase_receipt_items (
  id text primary key,
  tenant_slug text not null,
  receipt_id text not null,
  po_item_id text,
  product_id text,
  sku text,
  description text,
  ordered_qty numeric not null default 0,
  received_qty numeric not null default 0,
  rejected_qty numeric not null default 0,
  unit_price numeric not null default 0,
  created_at timestamptz default now()
);
create index if not exists pri_receipt_idx on purchase_receipt_items (receipt_id);
create index if not exists purchase_receipts_tenant_idx on purchase_receipts (tenant_slug, status);
