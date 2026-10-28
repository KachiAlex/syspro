create table if not exists inventory_stock_layers (
  id text primary key,
  tenant_slug text not null,
  product_sku text not null,
  warehouse_id text,
  received_qty numeric not null default 0,
  remaining_qty numeric not null default 0,
  unit_cost numeric not null default 0,
  reference_id text,
  created_at timestamptz not null default now()
);
create index if not exists isl_fifo_idx on inventory_stock_layers (tenant_slug, product_sku, warehouse_id, created_at) where remaining_qty > 0;
alter table if exists stock_movements add column if not exists cogs_amount numeric;
