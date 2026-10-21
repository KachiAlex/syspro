-- Tranche J: manufacturing depth
-- workstations, routings, job cards, production plans, sales forecasts,
-- subcontracting supplied-materials ledger extensions

-- Workstations (capacity + operating cost)
create table if not exists manufacturing_workstations (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  code text not null,
  workstation_type text,
  labor_rate numeric not null default 0,
  overhead_rate numeric not null default 0,
  electricity_rate numeric not null default 0,
  rent_rate numeric not null default 0,
  capacity_hours_per_day numeric not null default 8,
  working_hours jsonb,            -- {"mon":["08:00-17:00"],...}
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_slug, code)
);

-- Routings (ordered ops template attachable to BOM)
create table if not exists manufacturing_routings (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  description text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_slug, name)
);
create table if not exists manufacturing_routing_operations (
  id uuid primary key default gen_random_uuid(),
  routing_id uuid not null references manufacturing_routings(id) on delete cascade,
  sequence integer not null,
  name text not null,
  workstation_id uuid references manufacturing_workstations(id),
  standard_minutes numeric not null default 0
);
create index if not exists routing_ops_routing_idx
  on manufacturing_routing_operations (routing_id);
alter table if exists bom_headers add column if not exists routing_id uuid;

-- Job cards (full execution record per WO operation)
create table if not exists manufacturing_job_cards (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  job_card_number text not null,
  work_order_id text not null,
  operation_id text,
  operation_name text not null,
  workstation_id uuid,
  employee_id text,
  status text not null default 'open'
    check (status in ('open','in_progress','paused','completed','cancelled')),
  planned_quantity numeric not null default 0,
  completed_quantity numeric not null default 0,
  rejected_quantity numeric not null default 0,
  planned_minutes numeric not null default 0,
  actual_minutes numeric not null default 0,
  labor_cost numeric not null default 0,
  overhead_cost numeric not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_slug, job_card_number)
);
create index if not exists job_cards_wo_idx on manufacturing_job_cards (work_order_id);

create table if not exists manufacturing_job_card_time_logs (
  id uuid primary key default gen_random_uuid(),
  job_card_id uuid not null references manufacturing_job_cards(id) on delete cascade,
  employee_id text,
  started_at timestamptz not null,
  ended_at timestamptz,
  minutes numeric,
  completed_quantity numeric not null default 0,
  notes text
);
create index if not exists job_card_time_logs_jc_idx
  on manufacturing_job_card_time_logs (job_card_id);

-- Sales forecasts (feed production planning)
create table if not exists manufacturing_sales_forecasts (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  product_sku text not null,
  forecast_date date not null,
  forecast_quantity numeric not null,
  consumed_quantity numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists sales_forecasts_tenant_idx
  on manufacturing_sales_forecasts (tenant_slug, product_sku, forecast_date);

-- Production plans (aggregate SO demand + forecast -> WO + MR generation)
create table if not exists manufacturing_production_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  plan_number text not null,
  plan_name text not null,
  status text not null default 'draft'
    check (status in ('draft','submitted','in_progress','completed','cancelled')),
  period_start date,
  period_end date,
  include_sales_orders boolean not null default true,
  include_forecasts boolean not null default true,
  generated_work_orders int not null default 0,
  generated_material_requests int not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_slug, plan_number)
);
create table if not exists manufacturing_production_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references manufacturing_production_plans(id) on delete cascade,
  product_sku text not null,
  product_name text,
  demanded_quantity numeric not null default 0,
  sales_order_quantity numeric not null default 0,
  forecast_quantity numeric not null default 0,
  on_hand_quantity numeric not null default 0,
  wip_quantity numeric not null default 0,
  planned_quantity numeric not null default 0,
  bom_id text,
  work_order_id text,
  material_request_id uuid
);
create index if not exists production_plan_items_plan_idx
  on manufacturing_production_plan_items (plan_id);

-- Subcontracting supplied-materials ledger: issue -> consume -> return
alter table if exists subcontract_materials
  add column if not exists consumed_quantity numeric not null default 0;
alter table if exists subcontract_materials
  add column if not exists returned_quantity numeric not null default 0;
create table if not exists subcontract_material_movements (
  id uuid primary key default gen_random_uuid(),
  subcontract_material_id text not null,
  tenant_slug text not null,
  movement_type text not null check (movement_type in ('issue','consume','return')),
  quantity numeric not null check (quantity > 0),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists subcontract_mat_mov_idx
  on subcontract_material_movements (subcontract_material_id);
