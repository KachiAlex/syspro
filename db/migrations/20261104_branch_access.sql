-- 20261104_branch_access.sql
-- Per-user branch scoping. Users with no rows in this table are
-- unrestricted; rows restrict them to the listed branches.

CREATE TABLE IF NOT EXISTS tenant_user_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  user_id text NOT NULL,
  branch_id text NOT NULL REFERENCES tenant_branches(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_slug, user_id, branch_id)
);
CREATE INDEX IF NOT EXISTS idx_user_branches_user ON tenant_user_branches (tenant_slug, user_id);
CREATE INDEX IF NOT EXISTS idx_user_branches_branch ON tenant_user_branches (tenant_slug, branch_id);
