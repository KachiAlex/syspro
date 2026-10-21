-- Tranche I: inventory completeness
-- UOM framework, item variants, item-group tree, stock reconciliation,
-- stock reservation, receipt quality inspection, product bundles

-- UOM framework
create table if not exists inventory_uom_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  unique (tenant_slug, name)
);
create table if not exists inventory_uoms (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  category_id uuid references inventory_uom_categories(id),
  must_be_whole boolean not null default false,
  unique (tenant_slug, name)
);
create table if not exists inventory_uom_conversions (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  from_uom text not null,
  to_uom text not null,
  factor numeric not null check (factor > 0),
  unique (tenant_slug, from_uom, to_uom)
);
alter table if exists inventory_products add column if not exists stock_uom text default 'Unit';

-- Item groups as a tree (replaces flat category string; category kept for compat)
create table if not exists inventory_item_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  parent_id uuid references inventory_item_groups(id),
  is_group boolean not null default false,
  unique (tenant_slug, name, parent_id)
);
alter table if exists inventory_products add column if not exists item_group_id uuid;

-- Item variants: attributes + variants of a template product
create table if not exists inventory_item_attributes (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  values text[] not null default '{}',
  unique (tenant_slug, name)
);
create table if not exists inventory_item_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  template_product_id text not null,
  variant_sku text not null,
  attributes jsonb not null default '{}',
  sale_price numeric,
  unit_cost numeric,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_slug, variant_sku)
);
create index if not exists inventory_item_variants_template_idx
  on inventory_item_variants (tenant_slug, template_product_id);

-- Stock reconciliation (cycle count / physical count vs book)
create table if not exists inventory_stock_reconciliations (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  rec_number text not null,
  warehouse_id text not null,
  status text not null default 'draft' check (status in ('draft','submitted','cancelled')),
  count_date date not null default current_date,
  remarks text,
  journal_entry_id uuid,
  submitted_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_slug, rec_number)
);
create table if not exists inventory_stock_reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  reconciliation_id uuid not null references inventory_stock_reconciliations(id) on delete cascade,
  product_sku text not null,
  book_quantity numeric not null default 0,
  counted_quantity numeric,
  variance numeric,
  valuation_rate numeric not null default 0,
  variance_value numeric
);
create index if not exists stock_rec_items_rec_idx
  on inventory_stock_reconciliation_items (reconciliation_id);

-- Stock reservation (against sales orders)
create table if not exists inventory_stock_reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  product_sku text not null,
  warehouse_id text not null default 'main',
  quantity numeric not null check (quantity > 0),
  sales_order_id text,
  status text not null default 'active' check (status in ('active','released','consumed')),
  reserved_by text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stock_reservations_tenant_idx
  on inventory_stock_reservations (tenant_slug, product_sku) where status = 'active';
create index if not exists stock_reservations_so_idx
  on inventory_stock_reservations (sales_order_id) where status = 'active';

-- Quality inspection on stock receipts
create table if not exists inventory_quality_inspections (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  inspection_number text not null,
  reference_type text not null default 'purchase_receipt',
  reference_id text,
  product_sku text not null,
  warehouse_id text,
  inspected_quantity numeric not null,
  accepted_quantity numeric not null default 0,
  rejected_quantity numeric not null default 0,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','partial')),
  inspector text,
  readings jsonb,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_slug, inspection_number)
);

-- Product bundles (sales BOM / kits — no production, explode on sale)
create table if not exists inventory_product_bundles (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  bundle_sku text not null,
  name text not null,
  description text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_slug, bundle_sku)
);
create table if not exists inventory_product_bundle_items (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references inventory_product_bundles(id) on delete cascade,
  product_sku text not null,
  quantity numeric not null check (quantity > 0)
);
create index if not exists bundle_items_bundle_idx
  on inventory_product_bundle_items (bundle_id);
