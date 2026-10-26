-- Converged approval flows: approval linkage columns for flows that now
-- route decisions through the shared approvals engine.
-- Idempotent — safe to re-run.

alter table if exists procurement_requisitions add column if not exists approval_id text;
alter table if exists admin_leave add column if not exists approval_id text;

-- gl.ts closeFiscalPeriod writes these; the fiscal-periods.ts schema lacked them.
alter table if exists fiscal_periods add column if not exists closed_by text;
alter table if exists fiscal_periods add column if not exists locked_at timestamptz;
alter table if exists fiscal_periods add column if not exists locked_by text;
