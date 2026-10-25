-- Approval delegation + employee-expense convergence
--
-- 1. approval_delegates: out-of-office authority transfer for approvers.
-- 2. Copies admin_employee_expenses rows into the shared `expenses` table as
--    type='reimbursement' (preserving ids), re-points pending approvals rows
--    to entity_type='expense', and rebuilds expense_approvals audit rows for
--    already-decided expenses. admin_employee_expenses is kept as an archive.
-- Idempotent — re-running inserts nothing twice.

create table if not exists approval_delegates (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  delegator_id text not null,
  delegate_id text not null,
  entity_type text,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  active boolean default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists approval_delegates_lookup_idx
  on approval_delegates (tenant_slug, delegate_id, delegator_id);

-- ---------------------------------------------------------------------------
-- Convergence: admin_employee_expenses -> expenses (type='reimbursement')
-- ---------------------------------------------------------------------------

-- Defensive: linkage columns may pre-date the 20261025 migration.
alter table if exists admin_employee_expenses
  add column if not exists approval_id text,
  add column if not exists journal_entry_id text;
alter table if exists expenses
  add column if not exists department_id text,
  add column if not exists submitter_employee_id text,
  add column if not exists approval_id text,
  add column if not exists journal_entry_id text;

-- Fallback category used when the portal's free-text category has no match.
insert into expense_categories (id, code, name, account_id)
values ('cat_other', 'OTHER', 'Other', '6090')
on conflict (id) do nothing;

insert into expenses (
  id, tenant_slug, type, amount, tax_amount, total_amount, tax_type,
  category, category_id, description, vendor, date,
  approval_status, payment_status, attachments, metadata,
  department_id, submitter_employee_id, approval_id, journal_entry_id,
  created_by, created_at, updated_at
)
select
  e.id,
  e.tenant_slug,
  'reimbursement',
  e.amount,
  0,
  e.amount,
  'NONE',
  e.category,
  coalesce(c.id, 'cat_other'),
  e.description,
  null,
  e.date::date,
  case
    when e.status = 'approved' then 'APPROVED'
    when e.status = 'paid' then 'APPROVED'
    when e.status = 'rejected' then 'REJECTED'
    else 'PENDING'
  end,
  case when e.status = 'paid' then 'REIMBURSED' else 'UNPAID' end,
  case when e.receipt_url is not null then array[e.receipt_url] else array[]::text[] end,
  jsonb_build_object(
    'source', 'employee_portal',
    'migratedFrom', 'admin_employee_expenses',
    'employeeName', e.employee_name,
    'receiptUrl', e.receipt_url,
    'legacyApproverName', e.approver_name,
    'legacyApproverComment', e.approver_comment
  ),
  e.department_id,
  e.employee_id,
  e.approval_id,
  e.journal_entry_id,
  e.employee_id,
  coalesce(e.created_at, now()),
  coalesce(e.updated_at, e.created_at, now())
from admin_employee_expenses e
left join expense_categories c on lower(c.name) = lower(e.category)
where not exists (select 1 from expenses x where x.id = e.id);

-- Pending workflow rows for migrated expenses now point at the shared table.
update approvals a
set entity_type = 'expense'
where a.entity_type = 'employee_expense'
  and exists (select 1 from expenses e where e.id = a.entity_id);

-- Rebuild expense_approvals decision rows for already-decided migrated
-- expenses so the approval timeline UI has entries.
insert into expense_approvals (
  id, expense_id, approver_role, approver_id, approver_name, action, reason, amount_threshold
)
select
  gen_random_uuid()::text,
  e.id,
  'FINANCE',
  coalesce(e.approver_id, 'system'),
  coalesce(e.approver_name, 'Migrated decision'),
  case when e.status = 'rejected' then 'REJECTED' else 'APPROVED' end,
  e.approver_comment,
  e.amount
from admin_employee_expenses e
where e.status in ('approved', 'rejected', 'paid')
  and exists (select 1 from expenses x where x.id = e.id)
  and not exists (
    select 1 from expense_approvals ea
    where ea.expense_id = e.id and ea.action in ('APPROVED', 'REJECTED')
  );
