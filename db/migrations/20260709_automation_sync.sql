-- Automation cross-module sync support.
-- The code creates these inline as well (create/alter if not exists), this
-- migration documents them for environments that run migrations explicitly.

-- Dedup ledger for time-based triggers so cron cannot re-fire the same
-- (tenant, event, source) inside its cooldown window.
CREATE TABLE IF NOT EXISTS automation_event_dedup (
  tenant_slug text NOT NULL,
  event_type text NOT NULL,
  dedup_key text NOT NULL,
  emitted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_slug, event_type, dedup_key)
);

-- Over-budget alert dedup: stamped when projects.over-budget fires, cleared
-- when spend drops back under budget so a re-cross alerts again.
ALTER TABLE IF EXISTS projects
  ADD COLUMN IF NOT EXISTS over_budget_alerted_at timestamptz;
