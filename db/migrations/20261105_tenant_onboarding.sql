-- Tenant onboarding wizard state.
-- Steps JSONB stores only UI metadata (skipped/current/dismissed/completed_at).
-- Step completion itself is recomputed live from real tenant data on every read,
-- so configuration done outside the wizard is reflected automatically.

CREATE TABLE IF NOT EXISTS tenant_onboarding_state (
  tenant_slug    text PRIMARY KEY,
  steps          jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_step   text,
  dismissed      boolean NOT NULL DEFAULT false,
  completed_at   timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
