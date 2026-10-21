-- Tranche L: HRMS depth
-- employee check-ins, leave accrual engine + allocations,
-- employee advances, employee onboarding/separation lifecycle

-- Raw punch log (device/manual source) — attendance derives from these
create table if not exists hr_employee_checkins (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  employee_id text not null,
  timestamp timestamptz not null,
  log_type text not null check (log_type in ('in','out')),
  source text not null default 'manual',  -- manual|device|mobile|import
  device_id text,
  shift_id uuid,
  skip_auto_attendance boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists hr_checkins_emp_idx
  on hr_employee_checkins (tenant_slug, employee_id, timestamp);
create index if not exists hr_checkins_unprocessed_idx
  on hr_employee_checkins (tenant_slug, timestamp) where not skip_auto_attendance;

-- Leave allocations (ERPNext leave_allocation docs)
create table if not exists hr_leave_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  employee_id text not null,
  leave_type text not null,
  year integer not null,
  allocated_days numeric not null default 0,
  carried_over_days numeric not null default 0,
  expires_at date,
  status text not null default 'active' check (status in ('active','expired','cancelled')),
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  unique (tenant_slug, employee_id, leave_type, year)
);

-- Leave accrual log (dedupe for periodic accrual runs; admin_leave_policies
-- already carries accrual frequency + entitled_days)
create table if not exists hr_leave_accrual_log (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  employee_id text not null,
  leave_type text not null,
  period text not null,              -- '2025-11'
  days_accrued numeric not null,
  created_at timestamptz not null default now(),
  unique (tenant_slug, employee_id, leave_type, period)
);

-- Employee advances (advance -> disburse -> repay, GL integrated)
create table if not exists hr_employee_advances (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  advance_number text not null,
  employee_id text not null,
  employee_name text,
  amount numeric not null check (amount > 0),
  purpose text,
  status text not null default 'requested'
    check (status in ('requested','approved','disbursed','partially_repaid','repaid','rejected','cancelled')),
  approved_by text,
  disbursed_at timestamptz,
  disburse_journal_id uuid,
  repaid_amount numeric not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_slug, advance_number)
);
create table if not exists hr_advance_repayments (
  id uuid primary key default gen_random_uuid(),
  advance_id uuid not null references hr_employee_advances(id) on delete cascade,
  amount numeric not null check (amount > 0),
  method text not null default 'payroll',   -- payroll|cash|bank|expense_offset
  journal_entry_id uuid,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

-- Employee lifecycle: onboarding + separation checklists
create table if not exists hr_employee_lifecycle (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  kind text not null check (kind in ('onboarding','separation')),
  employee_id text not null,
  employee_name text,
  status text not null default 'in_progress'
    check (status in ('in_progress','completed','cancelled')),
  designation text,
  department_id text,
  start_date date,
  separation_date date,
  reason text,
  checklist jsonb not null default '[]',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hr_lifecycle_emp_idx
  on hr_employee_lifecycle (tenant_slug, employee_id);
