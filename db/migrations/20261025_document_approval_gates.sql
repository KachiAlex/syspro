-- Document approval gates: bills, vendor payments, payroll runs, salary
-- changes, credit limits, treasury facilities.
-- Links underlying documents to their approvals row and stages pending
-- values for apply-on-approval outcomes. Idempotent.

alter table if exists bills add column if not exists approval_id text;
alter table if exists vendor_payments add column if not exists approval_id text;
alter table if exists admin_payroll_runs add column if not exists approval_id text;

-- Staged changes applied by the approval outcome (cleared on rejection)
alter table if exists admin_employees add column if not exists pending_salary numeric;
alter table if exists finance_customers add column if not exists pending_credit_limit numeric;

-- Treasury lifecycle widened for workflow: pending_approval carries no
-- journal entries until the chain decides; rejected voids the facility.
alter table if exists bank_guarantees drop constraint if exists bank_guarantees_status_check;
alter table if exists bank_guarantees add constraint bank_guarantees_status_check
  check (status in ('open','pending_approval','claimed','released','expired','rejected'));

alter table if exists invoice_discountings drop constraint if exists invoice_discountings_status_check;
alter table if exists invoice_discountings add constraint invoice_discountings_status_check
  check (status in ('sanctioned','pending_approval','settled','closed','rejected'));
