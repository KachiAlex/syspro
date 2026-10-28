create table if not exists delivery_notes (
  id text primary key,
  tenant_slug text not null,
  note_number text not null,
  sales_order_id text,
  customer_id text,
  customer_name text,
  warehouse_id text,
  delivery_date date not null,
  status text not null default 'pending' check (status in ('pending','delivered','rejected','cancelled')),
  total_amount numeric not null default 0,
  approval_id text,
  driver text,
  vehicle text,
  notes text,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists delivery_note_items (
  id text primary key,
  tenant_slug text not null,
  note_id text not null,
  so_line_key text,
  product_id text,
  sku text,
  description text,
  ordered_qty numeric not null default 0,
  delivered_qty numeric not null default 0,
  rejected_qty numeric not null default 0,
  unit_price numeric not null default 0,
  created_at timestamptz default now()
);
create index if not exists dni_note_idx on delivery_note_items (note_id);
create index if not exists delivery_notes_tenant_idx on delivery_notes (tenant_slug, status);
