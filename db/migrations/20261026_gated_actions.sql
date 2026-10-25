-- Gated actions (delegation-of-authority registry): staged vendor bank
-- changes + fraud-window marker used by vendor-payment risk escalation
-- (payments within 30d of a bank change get a forced company-officer step).
-- Idempotent.

alter table if exists vendors add column if not exists pending_bank_details jsonb;
alter table if exists vendors add column if not exists bank_details_changed_at timestamptz;
