-- Tranche M: platform layer (workflows, print formats, webhooks, web forms,
-- data import, payment gateways, asset maintenance)

-- 30. Workflow state machine
create table if not exists workflow_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  doc_type text not null,
  name text not null,
  is_active boolean not null default true,
  status_field text not null default 'status',
  states jsonb not null default '[]'::jsonb,   -- [{name, docStatus?, style?}]
  transitions jsonb not null default '[]'::jsonb, -- [{from, to, action, roles[], condition?}]
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_slug, doc_type, name)
);
create index if not exists workflow_definitions_doc_idx
  on workflow_definitions (tenant_slug, doc_type) where is_active;

-- 31. Print formats
create table if not exists print_formats (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  doc_type text not null,
  name text not null,
  is_default boolean not null default false,
  header_html text,
  body_html text not null,     -- template with {{field}} placeholders
  footer_html text,
  css text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_slug, doc_type, name)
);

-- 32. Webhook subscriptions (outbound doc-event webhooks w/ signing + retry)
create table if not exists webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  target_url text not null,
  secret text,
  doc_types text[] not null default '{}',
  events text[] not null default '{create,update,submit}',
  is_active boolean not null default true,
  max_retries int not null default 3,
  created_at timestamptz not null default now()
);
create table if not exists webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references webhook_subscriptions(id) on delete cascade,
  tenant_slug text not null,
  event text not null,
  doc_type text not null,
  doc_id text,
  payload jsonb not null,
  status text not null default 'pending',  -- pending|delivered|failed|dead
  attempts int not null default 0,
  response_code int,
  last_error text,
  next_retry_at timestamptz not null default now(),
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists webhook_deliveries_retry_idx
  on webhook_deliveries (status, next_retry_at) where status = 'pending';

-- 33. Web forms
create table if not exists web_forms (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  slug text not null,
  target_entity text not null,    -- lead|ticket|customer
  schema jsonb not null default '[]'::jsonb, -- [{name,label,type,required,options[]}]
  success_message text default 'Submitted successfully',
  is_active boolean not null default true,
  notify_email text,
  submit_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_slug, slug)
);
create table if not exists web_form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references web_forms(id) on delete cascade,
  tenant_slug text not null,
  data jsonb not null,
  record_type text,
  record_id text,
  ip inet,
  created_at timestamptz not null default now()
);

-- 34. Data imports
create table if not exists data_imports (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  entity text not null,           -- customers|suppliers|items|employees|accounts
  file_name text,
  column_map jsonb not null default '{}'::jsonb, -- csvHeader -> field
  status text not null default 'draft',  -- draft|validated|imported|failed
  total_rows int not null default 0,
  imported_rows int not null default 0,
  failed_rows int not null default 0,
  errors jsonb not null default '[]'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- 35. Payment gateways
create table if not exists payment_gateway_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  provider text not null,          -- paystack|flutterwave
  public_key text,
  secret_key text not null,
  webhook_secret text,
  mode text not null default 'test', -- test|live
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_slug, provider)
);
create table if not exists payment_links (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  provider text not null,
  reference text not null,
  amount numeric(18,2) not null,
  currency text not null default 'NGN',
  status text not null default 'pending', -- pending|paid|failed|expired
  invoice_id uuid,
  payment_request_id uuid,
  customer_email text,
  checkout_url text,
  gateway_response jsonb,
  payment_entry_id uuid,
  paid_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  unique (tenant_slug, provider, reference)
);
create index if not exists payment_links_invoice_idx on payment_links (invoice_id, status);

-- 36. Asset maintenance
create table if not exists maintenance_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  asset_id uuid,
  asset_name text not null,
  item_name text,
  frequency text not null default 'monthly', -- weekly|monthly|quarterly|yearly
  next_due date not null,
  last_completed date,
  assigned_to text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists maintenance_schedules_due_idx
  on maintenance_schedules (tenant_slug, next_due) where is_active;

create table if not exists maintenance_visits (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  schedule_id uuid not null references maintenance_schedules(id) on delete cascade,
  scheduled_date date not null,
  completed_date date,
  status text not null default 'scheduled', -- scheduled|in_progress|completed|cancelled
  engineer text,
  work_done text,
  ticket_id uuid,
  created_at timestamptz not null default now()
);
