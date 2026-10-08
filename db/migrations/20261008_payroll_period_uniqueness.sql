-- Payroll: one active run per (tenant, period).
-- Prevents a second draft being approved into a duplicate GL accrual and
-- disbursement for the same period. Cancel the existing run to re-run a period.
--
-- NOTE: fails if legacy duplicate active runs exist for the same
-- (tenant_slug, period) — resolve those rows first.
create unique index if not exists idx_admin_payroll_runs_tenant_period_active
  on admin_payroll_runs(tenant_slug, period)
  where status <> 'cancelled';
