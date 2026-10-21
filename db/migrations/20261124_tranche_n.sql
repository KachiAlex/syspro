-- Tranche N: long-tail ERPNext parity features
-- (party links, advance taxes, CRM masters, projects edges, mfg edges,
--  inventory edges, HRMS edges, platform edges)

-- ── Finance ────────────────────────────────────────────────────────────────
-- Party links: relate a party (customer/supplier/employee) to other parties
-- e.g. customer who is also a supplier (contra netting) or group member.
create table if not exists party_links (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  primary_type text not null,    -- customer|supplier|employee|shareholder
  primary_id text not null,
  secondary_type text not null,
  secondary_id text not null,
  created_by text,
  created_at timestamptz not null default now(),
  unique (tenant_slug, primary_type, primary_id, secondary_type, secondary_id)
);

-- Advance taxes: taxes withheld/charged on advance payment entries
-- (e.g. WHT deducted by a customer on an advance).
create table if not exists advance_taxes (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  payment_id text not null,
  tax_code text not null,
  description text,
  rate numeric not null default 0,
  tax_amount numeric not null default 0,
  account_code text,
  created_at timestamptz not null default now()
);
create index if not exists advance_taxes_payment_idx on advance_taxes (payment_id);

-- ── CRM masters ────────────────────────────────────────────────────────────
create table if not exists crm_territories (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  parent_id uuid references crm_territories(id) on delete set null,
  is_group boolean not null default false,
  territory_manager text,
  created_at timestamptz not null default now(),
  unique (tenant_slug, name, parent_id)
);

create table if not exists crm_industry_types (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (tenant_slug, name)
);

create table if not exists crm_market_segments (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (tenant_slug, name)
);

create table if not exists crm_competitors (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  website text,
  strengths text,
  weaknesses text,
  notes text,
  created_at timestamptz not null default now(),
  unique (tenant_slug, name)
);
-- deals ↔ competitors many-to-many
create table if not exists crm_deal_competitors (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  deal_id text not null,
  competitor_id uuid not null references crm_competitors(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (deal_id, competitor_id)
);

create table if not exists crm_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  title text,
  content text not null,
  party_type text,          -- lead|deal|customer|contact|prospect
  party_id text,
  notify_on_login boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists crm_notes_party_idx on crm_notes (tenant_slug, party_type, party_id);

create table if not exists crm_appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  title text not null,
  party_type text,
  party_id text,
  scheduled_at timestamptz not null,
  duration_minutes int not null default 30,
  status text not null default 'scheduled' check (status in ('scheduled','confirmed','completed','cancelled','no_show')),
  attendees jsonb not null default '[]'::jsonb,
  location text,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists crm_appointments_when_idx on crm_appointments (tenant_slug, scheduled_at);

-- SMS center (logs outbound SMS via the configured provider)
create table if not exists sms_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  to_number text not null,
  message text not null,
  status text not null default 'queued' check (status in ('queued','sent','failed','delivered')),
  provider text,
  provider_ref text,
  error text,
  related_type text,
  related_id text,
  sent_by text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── Projects ───────────────────────────────────────────────────────────────
create table if not exists task_types (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  description text,
  color text,
  created_at timestamptz not null default now(),
  unique (tenant_slug, name)
);

create table if not exists activity_types (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  default_rate numeric,
  created_at timestamptz not null default now(),
  unique (tenant_slug, name)
);

-- per-employee billing/cost rate per activity type
create table if not exists activity_costs (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  activity_type_id uuid not null references activity_types(id) on delete cascade,
  employee_id text,
  billing_rate numeric not null default 0,
  cost_rate numeric not null default 0,
  currency text not null default 'NGN',
  created_at timestamptz not null default now()
);

create table if not exists project_updates (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  project_id text not null,
  update_date date not null default current_date,
  summary text not null,
  status text,                 -- on_track|at_risk|blocked|done
  blockers text,
  percent_complete numeric,
  sent_to text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists project_updates_proj_idx on project_updates (tenant_slug, project_id);

create table if not exists installation_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  note_number text not null,
  customer_id text,
  customer_name text not null,
  invoice_id text,
  sales_order_id text,
  installation_date date not null default current_date,
  items jsonb not null default '[]'::jsonb,
  remarks text,
  status text not null default 'draft' check (status in ('draft','submitted','cancelled')),
  created_by text,
  created_at timestamptz not null default now(),
  unique (tenant_slug, note_number)
);

-- ── Manufacturing ──────────────────────────────────────────────────────────
-- material_cost column for the BOM update tool's cost recompute
alter table if exists bom_headers add column if not exists material_cost numeric;

create table if not exists plant_floors (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  code text,
  warehouse_id uuid,
  created_at timestamptz not null default now(),
  unique (tenant_slug, name)
);

create table if not exists downtime_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  workstation_id uuid,
  work_order_id text,
  plant_floor_id uuid references plant_floors(id) on delete set null,
  from_ts timestamptz not null,
  to_ts timestamptz,
  reason text not null,
  category text,               -- breakdown|changeover|material_wait|planned|other
  operator text,
  created_at timestamptz not null default now()
);
create index if not exists downtime_entries_ws_idx on downtime_entries (tenant_slug, workstation_id);

create table if not exists mfg_sub_operations (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  work_order_id text not null,
  operation_id text not null,      -- parent operation ref
  name text not null,
  workstation_id uuid,
  planned_minutes int,
  actual_minutes int,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- Master Production Schedule: demand plan netting forecast+orders vs supply
create table if not exists master_production_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  period_from date not null,
  period_to date not null,
  status text not null default 'draft' check (status in ('draft','confirmed','closed')),
  created_by text,
  created_at timestamptz not null default now(),
  unique (tenant_slug, name)
);
create table if not exists mps_items (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  mps_id uuid not null references master_production_schedules(id) on delete cascade,
  product_sku text not null,
  forecast_qty numeric not null default 0,
  order_qty numeric not null default 0,
  on_hand numeric not null default 0,
  planned_qty numeric not null default 0
);

-- ── Inventory edges ────────────────────────────────────────────────────────
create table if not exists packing_slips (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  slip_number text not null,
  sales_order_id text,
  delivery_reference text,
  from_case_no int not null default 1,
  to_case_no int,
  items jsonb not null default '[]'::jsonb,  -- [{sku,name,qty}]
  gross_weight numeric,
  net_weight numeric,
  status text not null default 'draft',
  created_by text,
  created_at timestamptz not null default now(),
  unique (tenant_slug, slip_number)
);

-- Putaway rules: preferred warehouse/bin capacity per product
create table if not exists putaway_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  product_sku text not null,
  warehouse_id uuid not null,
  bin text,
  capacity numeric not null default 0,
  priority int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists putaway_rules_sku_idx on putaway_rules (tenant_slug, product_sku);

-- Party item codes: customer's SKU and manufacturer's part number per item
create table if not exists item_party_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  product_sku text not null,
  party_type text not null check (party_type in ('customer','manufacturer','supplier')),
  party_id text,
  party_code text not null,   -- the code the party uses
  party_name text,
  created_at timestamptz not null default now(),
  unique (tenant_slug, product_sku, party_type, party_code)
);

-- ── HRMS edges ─────────────────────────────────────────────────────────────
create table if not exists leave_encashments (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  employee_id text not null,
  leave_type text not null,
  encashment_date date not null default current_date,
  encashable_days numeric not null,
  rate_per_day numeric not null default 0,
  amount numeric not null default 0,
  status text not null default 'draft' check (status in ('draft','approved','paid','rejected','cancelled')),
  payroll_run_id text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists overtime_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  employee_id text not null,
  work_date date not null,
  hours numeric not null,
  rate_multiplier numeric not null default 1.5,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','paid')),
  approved_by text,
  payroll_run_id text,
  created_at timestamptz not null default now()
);

create table if not exists employee_grievances (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  employee_id text not null,
  grievance_type text not null,
  subject text not null,
  description text,
  raised_on date not null default current_date,
  status text not null default 'open' check (status in ('open','investigating','resolved','closed','dismissed')),
  assigned_to text,
  resolution text,
  resolved_on date,
  created_at timestamptz not null default now()
);

create table if not exists employee_transfers (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  employee_id text not null,
  from_department_id text,
  to_department_id text,
  from_branch_id text,
  to_branch_id text,
  transfer_date date not null,
  reason text,
  status text not null default 'draft' check (status in ('draft','approved','completed','cancelled')),
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists employee_skill_maps (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  employee_id text not null,
  skill text not null,
  proficiency int not null default 1 check (proficiency between 1 and 5),
  evaluated_on date not null default current_date,
  evaluator text,
  created_at timestamptz not null default now(),
  unique (tenant_slug, employee_id, skill)
);

create table if not exists training_programs (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  description text,
  supplier text,
  created_at timestamptz not null default now(),
  unique (tenant_slug, name)
);
create table if not exists training_events (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  program_id uuid references training_programs(id) on delete set null,
  event_name text not null,
  start_date date not null,
  end_date date,
  venue text,
  trainer text,
  status text not null default 'scheduled' check (status in ('scheduled','ongoing','completed','cancelled')),
  attendees jsonb not null default '[]'::jsonb, -- [{employeeId, name, status}]
  created_at timestamptz not null default now()
);

create table if not exists staffing_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  department_id text,
  period_from date,
  period_to date,
  designations jsonb not null default '[]'::jsonb, -- [{designation, count, estCost}]
  total_estimated_cost numeric not null default 0,
  status text not null default 'draft' check (status in ('draft','submitted','approved','cancelled')),
  created_by text,
  created_at timestamptz not null default now()
);

-- NG PAYE relief declarations (rent relief, pension, NHF, life assurance…)
create table if not exists employee_tax_declarations (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  employee_id text not null,
  tax_year int not null,
  reliefs jsonb not null default '{}'::jsonb,
  declared_amount numeric not null default 0,
  proof_document text,
  status text not null default 'draft' check (status in ('draft','submitted','approved','rejected')),
  created_at timestamptz not null default now(),
  unique (tenant_slug, employee_id, tax_year)
);

-- ── Platform / assets ──────────────────────────────────────────────────────
create table if not exists asset_shift_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  asset_id text not null,
  employee_id text,
  shift_id text,
  from_date date not null,
  to_date date,
  status text not null default 'active' check (status in ('active','ended')),
  created_at timestamptz not null default now()
);

create table if not exists asset_activity_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  asset_id text not null,
  activity_type text not null,   -- inspection|repair|reading|transfer|other
  reading_value numeric,         -- odometer/hours
  notes text,
  logged_by text,
  created_at timestamptz not null default now()
);
create index if not exists asset_activity_logs_asset_idx on asset_activity_logs (tenant_slug, asset_id);

-- DocShare: share a document with another user
create table if not exists doc_shares (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  doc_type text not null,
  doc_id text not null,
  shared_with text not null,     -- user id or email
  permission text not null default 'read' check (permission in ('read','write','share')),
  created_by text,
  created_at timestamptz not null default now(),
  unique (tenant_slug, doc_type, doc_id, shared_with)
);

-- Energy points: lightweight gamification ledger
create table if not exists energy_point_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  user_id text not null,
  points int not null,
  reason text not null,
  doc_type text,
  doc_id text,
  reverted boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists energy_point_logs_user_idx on energy_point_logs (tenant_slug, user_id);

-- CMS: blog posts + web pages for the public site
create table if not exists cms_posts (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  title text not null,
  slug text not null,
  content text not null,
  excerpt text,
  category text,
  cover_image text,
  published boolean not null default false,
  published_at timestamptz,
  author text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_slug, slug)
);
create table if not exists cms_pages (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  title text not null,
  slug text not null,
  content text not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_slug, slug)
);
