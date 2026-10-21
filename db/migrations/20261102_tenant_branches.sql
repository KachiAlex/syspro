-- 20261102_tenant_branches.sql
-- Relational branch master. Branches previously existed only as nodes inside
-- the tenant_org_structures JSONB tree, so every branch_id column in the
-- system was unvalidated free text. This migration creates the master table
-- and backfills it from the org tree (branch + subsidiary nodes), preserving
-- node ids so existing branch_id references stay valid.

CREATE TABLE IF NOT EXISTS tenant_branches (
  id text PRIMARY KEY,
  tenant_slug text NOT NULL,
  code text,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'branch',          -- 'branch' | 'subsidiary'
  parent_branch_id text REFERENCES tenant_branches(id) ON DELETE SET NULL,
  region text,
  country text,
  state text,
  city text,
  timezone text,
  currency text,
  status text NOT NULL DEFAULT 'active',         -- 'active' | 'inactive' | 'planning'
  manager text,
  headcount integer NOT NULL DEFAULT 0,
  org_node_id text,                              -- link back to org-tree node
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_slug, code)
);

CREATE INDEX IF NOT EXISTS idx_tenant_branches_tenant ON tenant_branches (tenant_slug);
CREATE INDEX IF NOT EXISTS idx_tenant_branches_status ON tenant_branches (tenant_slug, status);

-- Backfill from the org-structure JSONB tree. Both 'branch' and 'subsidiary'
-- nodes become branch rows (subsidiaries are legal entities and reportable
-- units). parent_branch_id points at the nearest ancestor branch/subsidiary.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tenant_org_structures'
  ) THEN
    WITH RECURSIVE nodes AS (
      SELECT
        s.slug,
        s.tree AS node,
        NULL::text AS parent_branch_id
      FROM tenant_org_structures s
      WHERE jsonb_typeof(s.tree) = 'object'

      UNION ALL

      SELECT
        n.slug,
        child.value,
        CASE WHEN n.node->>'type' IN ('branch', 'subsidiary')
             THEN n.node->>'id'
             ELSE n.parent_branch_id
        END
      FROM nodes n
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(n.node->'children') = 'array'
             THEN n.node->'children'
             ELSE '[]'::jsonb
        END
      ) AS child(value)
    )
    INSERT INTO tenant_branches (
      id, tenant_slug, code, name, kind, parent_branch_id,
      region, country, state, city, timezone, currency,
      status, manager, headcount, org_node_id, metadata
    )
    SELECT
      n.node->>'id',
      n.slug,
      COALESCE(NULLIF(n.node->'metadata'->>'code', ''), n.node->>'id'),
      COALESCE(NULLIF(n.node->>'name', ''), 'Branch'),
      n.node->>'type',
      n.parent_branch_id,
      NULLIF(n.node->>'region', ''),
      NULLIF(n.node->'metadata'->>'country', ''),
      NULLIF(n.node->'metadata'->>'state', ''),
      NULLIF(n.node->'metadata'->>'city', ''),
      NULLIF(n.node->>'timezone', ''),
      NULLIF(n.node->'metadata'->>'currency', ''),
      CASE n.node->>'status'
        WHEN 'Live' THEN 'active'
        WHEN 'Paused' THEN 'inactive'
        ELSE 'planning'
      END,
      NULLIF(n.node->>'manager', ''),
      COALESCE((n.node->>'headcount')::int, 0),
      n.node->>'id',
      n.node->'metadata'
    FROM nodes n
    WHERE n.node->>'type' IN ('branch', 'subsidiary')
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
