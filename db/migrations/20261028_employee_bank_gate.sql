-- Employee bank-detail gating: staged changes + fraud-window timestamp.
-- Idempotent — safe to re-run.

alter table if exists admin_employees add column if not exists pending_bank_details jsonb;
alter table if exists admin_employees add column if not exists bank_details_changed_at timestamptz;
