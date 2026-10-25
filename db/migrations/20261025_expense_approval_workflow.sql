-- Expense approval workflow
-- Routes finance + employee-portal expenses through the shared approvals
-- engine (approval_rules / approvals). Idempotent — mirrors runtime ensures.

-- Linkage columns on finance expenses: which department's authority decides,
-- who submitted, the approvals workflow row, and the GL entry posted on
-- final approval.
alter table if exists expenses
  add column if not exists department_id text,
  add column if not exists submitter_employee_id text,
  add column if not exists approval_id text,
  add column if not exists journal_entry_id text;

create index if not exists expenses_department_idx
  on expenses (tenant_slug, department_id);

-- Same linkage on employee-portal expenses.
alter table if exists admin_employee_expenses
  add column if not exists approval_id text,
  add column if not exists journal_entry_id text;

-- Entity/rule types grew (expense, employee_expense, category_based) — relax
-- any legacy check constraints so the new rows are accepted.
alter table if exists approval_rules drop constraint if exists approval_rules_entity_type_check;
alter table if exists approval_rules drop constraint if exists approval_rules_rule_type_check;
alter table if exists approvals drop constraint if exists approvals_entity_type_check;

create index if not exists approvals_entity_lookup_idx
  on approvals (tenant_slug, entity_type, entity_id, status);
