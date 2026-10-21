-- Tranche H: sales/procurement cycle completion
-- quotations, RFQ + supplier quotations, material requests, item reorder rules

-- 1. Quotations (sell-side pre-order document)
create table if not exists sales_quotations (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  quotation_number text not null,
  customer_id text,
  customer_name text not null,
  quotation_date date not null default current_date,
  valid_until date,
  status text not null default 'draft'
    check (status in ('draft','sent','accepted','rejected','expired','converted','lost')),
  currency text not null default 'NGN',
  subtotal numeric not null default 0,
  tax_total numeric not null default 0,
  total numeric not null default 0,
  notes text,
  sales_order_id text,
  lost_reason text,
  metadata jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists sales_quotations_tenant_number_uq
  on sales_quotations (tenant_slug, quotation_number);
create index if not exists sales_quotations_tenant_status_idx
  on sales_quotations (tenant_slug, status);

create table if not exists sales_quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references sales_quotations(id) on delete cascade,
  product_id text,
  sku text,
  description text not null,
  quantity numeric not null default 1,
  uom text,
  unit_price numeric not null default 0,
  tax_rate numeric,
  line_amount numeric not null default 0,
  metadata jsonb
);
create index if not exists sales_quotation_items_quotation_idx
  on sales_quotation_items (quotation_id);

-- 2. RFQ + supplier quotations (buy-side competitive bidding)
create table if not exists procurement_rfqs (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  rfq_number text not null,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft','sent','closed','cancelled')),
  required_by date,
  metadata jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists procurement_rfqs_tenant_number_uq
  on procurement_rfqs (tenant_slug, rfq_number);

create table if not exists procurement_rfq_items (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references procurement_rfqs(id) on delete cascade,
  product_id text,
  sku text,
  description text not null,
  quantity numeric not null default 1,
  uom text,
  target_price numeric
);
create index if not exists procurement_rfq_items_rfq_idx
  on procurement_rfq_items (rfq_id);

create table if not exists procurement_rfq_suppliers (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references procurement_rfqs(id) on delete cascade,
  vendor_id uuid not null,
  unique (rfq_id, vendor_id)
);
create index if not exists procurement_rfq_suppliers_rfq_idx
  on procurement_rfq_suppliers (rfq_id);

create table if not exists procurement_supplier_quotations (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  rfq_id uuid not null references procurement_rfqs(id) on delete cascade,
  vendor_id uuid not null,
  vendor_name text not null,
  status text not null default 'submitted'
    check (status in ('submitted','awarded','rejected','withdrawn')),
  currency text not null default 'NGN',
  subtotal numeric not null default 0,
  tax_total numeric not null default 0,
  total numeric not null default 0,
  valid_until date,
  notes text,
  purchase_order_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists procurement_sq_tenant_idx
  on procurement_supplier_quotations (tenant_slug, status);
create index if not exists procurement_sq_rfq_idx
  on procurement_supplier_quotations (rfq_id);

create table if not exists procurement_supplier_quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references procurement_supplier_quotations(id) on delete cascade,
  rfq_item_id uuid,
  product_id text,
  description text not null,
  quantity numeric not null default 1,
  uom text,
  unit_price numeric not null default 0,
  line_amount numeric not null default 0
);
create index if not exists procurement_sq_items_quotation_idx
  on procurement_supplier_quotation_items (quotation_id);

-- 3. Material requests (internal requisition -> PO / WO / transfer)
create table if not exists material_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  mr_number text not null,
  request_type text not null
    check (request_type in ('purchase','manufacture','transfer')),
  status text not null default 'draft'
    check (status in ('draft','open','partially_ordered','ordered','cancelled')),
  requested_by text,
  required_by date,
  notes text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists material_requests_tenant_number_uq
  on material_requests (tenant_slug, mr_number);

create table if not exists material_request_items (
  id uuid primary key default gen_random_uuid(),
  material_request_id uuid not null references material_requests(id) on delete cascade,
  product_id text not null,
  product_name text,
  description text,
  quantity numeric not null,
  ordered_quantity numeric not null default 0,
  uom text,
  warehouse_id text
);
create index if not exists material_request_items_mr_idx
  on material_request_items (material_request_id);

-- 4. Item reorder rules -> auto material requests
create table if not exists inventory_reorder_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  product_sku text not null,
  warehouse_id text not null default 'main',
  reorder_level numeric not null,
  reorder_quantity numeric not null,
  request_type text not null default 'purchase'
    check (request_type in ('purchase','manufacture','transfer')),
  enabled boolean not null default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_slug, product_sku, warehouse_id)
);
create index if not exists inventory_reorder_rules_tenant_idx
  on inventory_reorder_rules (tenant_slug) where enabled;

-- sales_orders: link back to quotation + credit check flag
alter table if exists sales_orders add column if not exists quotation_id uuid;
alter table if exists sales_orders add column if not exists material_request_id uuid;
alter table if exists purchase_orders add column if not exists material_request_id uuid;
alter table if exists purchase_orders add column if not exists rfq_id uuid;
alter table if exists purchase_orders add column if not exists supplier_quotation_id uuid;
alter table if exists manufacturing_work_orders add column if not exists material_request_id uuid;
