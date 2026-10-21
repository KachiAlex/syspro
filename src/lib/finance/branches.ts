import { randomUUID } from "crypto";

import { db } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";

// ---------------------------------------------------------------------------
// Branch master: the system of record for branch_id dimensions across the
// app (journal lines, invoices, bills, payments, budgets, stock). Org-tree
// branch/subsidiary nodes are mirrored here so the JSONB tree can stay the
// org-chart view while this table validates every transactional reference.
// Canonical schema: db/migrations/20261102_tenant_branches.sql
// ---------------------------------------------------------------------------

export type BranchStatus = "active" | "inactive" | "planning";
export type BranchKind = "branch" | "subsidiary";

export type Branch = {
  id: string;
  tenantSlug: string;
  code: string | null;
  name: string;
  kind: BranchKind;
  parentBranchId: string | null;
  region: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  timezone: string | null;
  currency: string | null;
  status: BranchStatus;
  manager: string | null;
  headcount: number;
  orgNodeId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type QueryLike = (text: string, params?: any[]) => Promise<any[]>;

const defaultQuery: QueryLike = async (text, params) => (await db.query(text, params)).rows;

export function ensureBranchTables() {
  return ensureOnce("finance/branches:ensureBranchTables", async () => {
    await db.query(`
      create table if not exists tenant_branches (
        id text primary key,
        tenant_slug text not null,
        code text,
        name text not null,
        kind text not null default 'branch',
        parent_branch_id text references tenant_branches(id) on delete set null,
        region text,
        country text,
        state text,
        city text,
        timezone text,
        currency text,
        status text not null default 'active',
        manager text,
        headcount integer not null default 0,
        org_node_id text,
        metadata jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (tenant_slug, code)
      )
    `);
    await db.query(
      `create index if not exists idx_tenant_branches_tenant on tenant_branches (tenant_slug)`
    );
    await db.query(
      `create index if not exists idx_tenant_branches_status on tenant_branches (tenant_slug, status)`
    );
    await db.query(`
      create table if not exists tenant_user_branches (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        user_id text not null,
        branch_id text not null references tenant_branches(id) on delete cascade,
        created_at timestamptz not null default now(),
        unique (tenant_slug, user_id, branch_id)
      )
    `);
  });
}

function mapRow(row: any): Branch {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    code: row.code ?? null,
    name: row.name,
    kind: (row.kind ?? "branch") as BranchKind,
    parentBranchId: row.parent_branch_id ?? null,
    region: row.region ?? null,
    country: row.country ?? null,
    state: row.state ?? null,
    city: row.city ?? null,
    timezone: row.timezone ?? null,
    currency: row.currency ?? null,
    status: (row.status ?? "active") as BranchStatus,
    manager: row.manager ?? null,
    headcount: Number(row.headcount ?? 0),
    orgNodeId: row.org_node_id ?? null,
    metadata: row.metadata ?? null,
    createdAt: row.created_at,
  };
}

export async function listBranches(tenantSlug: string): Promise<Branch[]> {
  await ensureBranchTables();
  const rows = await db.query(
    `select * from tenant_branches where tenant_slug = $1 order by kind, name`,
    [tenantSlug]
  );
  return rows.rows.map(mapRow);
}

export async function getBranch(
  tenantSlug: string,
  idOrCode: string
): Promise<Branch | null> {
  await ensureBranchTables();
  const rows = await db.query(
    `select * from tenant_branches where tenant_slug = $1 and (id = $2 or code = $2) limit 1`,
    [tenantSlug, idOrCode]
  );
  return rows.rows[0] ? mapRow(rows.rows[0]) : null;
}

export type BranchInput = {
  name: string;
  code?: string;
  kind?: BranchKind;
  parentBranchId?: string;
  region?: string;
  country?: string;
  state?: string;
  city?: string;
  timezone?: string;
  currency?: string;
  status?: BranchStatus;
  manager?: string;
  headcount?: number;
  metadata?: Record<string, unknown>;
};

export async function createBranch(tenantSlug: string, input: BranchInput): Promise<Branch> {
  await ensureBranchTables();
  const id = randomUUID();
  const code = input.code ?? `BR-${id.slice(0, 6).toUpperCase()}`;
  if (input.parentBranchId) {
    const parent = await getBranch(tenantSlug, input.parentBranchId);
    if (!parent) throw new Error(`Parent branch ${input.parentBranchId} not found`);
    input.parentBranchId = parent.id;
  }
  const rows = await db.query(
    `insert into tenant_branches (
       id, tenant_slug, code, name, kind, parent_branch_id,
       region, country, state, city, timezone, currency,
       status, manager, headcount, metadata
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     returning *`,
    [
      id, tenantSlug, code, input.name, input.kind ?? "branch",
      input.parentBranchId ?? null, input.region ?? null, input.country ?? null,
      input.state ?? null, input.city ?? null, input.timezone ?? null,
      input.currency ?? null, input.status ?? "active", input.manager ?? null,
      input.headcount ?? 0,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]
  );
  return mapRow(rows.rows[0]);
}

export async function updateBranch(
  tenantSlug: string,
  id: string,
  updates: Partial<BranchInput>
): Promise<Branch | null> {
  await ensureBranchTables();
  if (updates.parentBranchId) {
    const parent = await getBranch(tenantSlug, updates.parentBranchId);
    if (!parent) throw new Error(`Parent branch ${updates.parentBranchId} not found`);
    if (parent.id === id) throw new Error("A branch cannot be its own parent");
    updates.parentBranchId = parent.id;
  }
  const rows = await db.query(
    `update tenant_branches set
       name = coalesce($3, name),
       code = coalesce($4, code),
       kind = coalesce($5, kind),
       parent_branch_id = coalesce($6, parent_branch_id),
       region = coalesce($7, region),
       country = coalesce($8, country),
       state = coalesce($9, state),
       city = coalesce($10, city),
       timezone = coalesce($11, timezone),
       currency = coalesce($12, currency),
       status = coalesce($13, status),
       manager = coalesce($14, manager),
       headcount = coalesce($15, headcount),
       metadata = coalesce($16, metadata),
       updated_at = now()
     where id = $1 and tenant_slug = $2
     returning *`,
    [
      id, tenantSlug, updates.name ?? null, updates.code ?? null,
      updates.kind ?? null, updates.parentBranchId ?? null, updates.region ?? null,
      updates.country ?? null, updates.state ?? null, updates.city ?? null,
      updates.timezone ?? null, updates.currency ?? null, updates.status ?? null,
      updates.manager ?? null, updates.headcount ?? null,
      updates.metadata ? JSON.stringify(updates.metadata) : null,
    ]
  );
  return rows.rows[0] ? mapRow(rows.rows[0]) : null;
}

/**
 * Delete a branch. If journal lines or finance documents reference it the
 * branch is deactivated instead of deleted, preserving auditability.
 */
export async function deleteBranch(
  tenantSlug: string,
  id: string
): Promise<{ deleted: boolean; deactivated: boolean }> {
  await ensureBranchTables();
  const refs = await db.query(
    `select
       (select count(*) from journal_entry_lines where branch_id = $1) +
       (select count(*) from finance_invoices where tenant_slug = $2 and branch_id = $1) +
       (select count(*) from bills where tenant_slug = $2 and branch_id::text = $1) as ref_count`,
    [id, tenantSlug]
  );
  if (Number(refs.rows[0]?.ref_count ?? 0) > 0) {
    await db.query(
      `update tenant_branches set status = 'inactive', updated_at = now()
       where id = $1 and tenant_slug = $2`,
      [id, tenantSlug]
    );
    return { deleted: false, deactivated: true };
  }
  await db.query(`delete from tenant_branches where id = $1 and tenant_slug = $2`, [id, tenantSlug]);
  return { deleted: true, deactivated: false };
}

/**
 * Resolve a set of branch references (id or code) to canonical ids.
 * Throws on any value that does not match a tenant_branches row.
 */
export async function resolveBranchIds(
  tenantSlug: string,
  values: Array<string | null | undefined>,
  q: QueryLike = defaultQuery
): Promise<Map<number, string | null>> {
  const result = new Map<number, string | null>();
  const wanted = [...new Set(values.filter((v): v is string => Boolean(v)))];
  if (!wanted.length) {
    values.forEach((_, i) => result.set(i, null));
    return result;
  }

  const rows = await q(
    `select id, code from tenant_branches
     where tenant_slug = $1 and (id = any($2) or code = any($2))`,
    [tenantSlug, wanted]
  );
  const lookup = new Map<string, string>();
  for (const row of rows) {
    if (row.id) lookup.set(row.id, row.id);
    if (row.code) lookup.set(row.code, row.id);
  }

  values.forEach((value, i) => {
    if (!value) {
      result.set(i, null);
      return;
    }
    const resolved = lookup.get(value);
    if (!resolved) {
      throw new Error(`Unknown branch "${value}" for tenant ${tenantSlug}`);
    }
    result.set(i, resolved);
  });
  return result;
}

/**
 * Tenant default branch: tenants.default_branch_id when set and valid,
 * otherwise the tenant's sole active branch, otherwise null.
 */
export async function getDefaultBranchId(
  tenantSlug: string,
  q: QueryLike = defaultQuery
): Promise<string | null> {
  try {
    const rows = await q(
      `select default_branch_id from tenants where slug = $1 limit 1`,
      [tenantSlug]
    );
    const configured = rows[0]?.default_branch_id;
    if (configured) {
      const valid = await resolveBranchIds(tenantSlug, [configured], q);
      if (valid.get(0)) return valid.get(0)!;
    }
  } catch {
    // tenants table/column shape drift — fall through to sole-branch default
  }
  const active = await q(
    `select id from tenant_branches where tenant_slug = $1 and status = 'active'`,
    [tenantSlug]
  );
  return active.length === 1 ? active[0].id : null;
}

/**
 * Mirror org-tree branch/subsidiary nodes into tenant_branches so the table
 * stays the system of record while the JSONB tree remains the org chart.
 * Nodes removed from the tree are marked inactive (never deleted — they may
 * be referenced by posted documents).
 */
export async function syncBranchesFromTree(
  tenantSlug: string,
  tree: { id: string; type: string; children?: any[] } | null
): Promise<void> {
  if (!tree) return;
  await ensureBranchTables();

  const found = new Map<string, { node: any; parentBranchId: string | null }>();
  const walk = (node: any, parentBranchId: string | null) => {
    const isBranch = node?.type === "branch" || node?.type === "subsidiary";
    const nextParent = isBranch ? node.id : parentBranchId;
    if (isBranch) found.set(node.id, { node, parentBranchId });
    for (const child of node?.children ?? []) walk(child, nextParent);
  };
  walk(tree, null);

  for (const { node, parentBranchId } of found.values()) {
    const status =
      node.status === "Live" ? "active" : node.status === "Paused" ? "inactive" : "planning";
    await db.query(
      `insert into tenant_branches (
         id, tenant_slug, code, name, kind, parent_branch_id,
         region, country, state, city, timezone, currency,
         status, manager, headcount, org_node_id, metadata
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       on conflict (id) do update set
         tenant_slug = excluded.tenant_slug,
         code = excluded.code,
         name = excluded.name,
         kind = excluded.kind,
         parent_branch_id = excluded.parent_branch_id,
         region = excluded.region,
         country = excluded.country,
         state = excluded.state,
         city = excluded.city,
         timezone = excluded.timezone,
         currency = excluded.currency,
         status = excluded.status,
         manager = excluded.manager,
         headcount = excluded.headcount,
         org_node_id = excluded.org_node_id,
         metadata = excluded.metadata,
         updated_at = now()`,
      [
        node.id, tenantSlug,
        node.metadata?.code || node.id, node.name || "Branch",
        node.type, parentBranchId,
        node.region || null, node.metadata?.country || null,
        node.metadata?.state || null, node.metadata?.city || null,
        node.timezone || null, node.metadata?.currency || null,
        status, node.manager || null, node.headcount ?? 0,
        node.id, node.metadata ? JSON.stringify(node.metadata) : null,
      ]
    );
  }

  if (found.size) {
    await db.query(
      `update tenant_branches set status = 'inactive', updated_at = now()
       where tenant_slug = $1 and org_node_id is not null
         and id <> all($2) and status <> 'inactive'`,
      [tenantSlug, [...found.keys()]]
    );
  }
}

// ---------------------------------------------------------------------------
// Per-user branch access scope
// ---------------------------------------------------------------------------

/**
 * Returns the set of branch ids a user may access, or null when the user is
 * unrestricted (no rows assigned). An empty array means "restricted to none".
 */
export async function getBranchScope(
  tenantSlug: string,
  userId: string
): Promise<string[] | null> {
  await ensureBranchTables();
  const rows = await db.query(
    `select branch_id from tenant_user_branches where tenant_slug = $1 and user_id = $2`,
    [tenantSlug, userId]
  );
  if (!rows.rows.length) return null;
  return rows.rows.map((r: any) => r.branch_id);
}

/** Replace a user's branch assignment set. Empty array clears restrictions. */
export async function assignUserBranches(
  tenantSlug: string,
  userId: string,
  branchIds: string[]
): Promise<void> {
  await ensureBranchTables();
  for (const ref of branchIds) {
    const branch = await getBranch(tenantSlug, ref);
    if (!branch) throw new Error(`Unknown branch "${ref}"`);
  }
  await db.query(
    `delete from tenant_user_branches where tenant_slug = $1 and user_id = $2`,
    [tenantSlug, userId]
  );
  for (const ref of branchIds) {
    const branch = await getBranch(tenantSlug, ref);
    await db.query(
      `insert into tenant_user_branches (tenant_slug, user_id, branch_id)
       values ($1, $2, $3) on conflict do nothing`,
      [tenantSlug, userId, branch!.id]
    );
  }
}

export async function listUserBranchAssignments(
  tenantSlug: string
): Promise<Array<{ userId: string; branchId: string; branchName: string; branchCode: string | null }>> {
  await ensureBranchTables();
  const rows = await db.query(
    `select ub.user_id, ub.branch_id, b.name as branch_name, b.code as branch_code
     from tenant_user_branches ub
     join tenant_branches b on b.id = ub.branch_id
     where ub.tenant_slug = $1
     order by ub.user_id, b.name`,
    [tenantSlug]
  );
  return rows.rows.map((r: any) => ({
    userId: r.user_id,
    branchId: r.branch_id,
    branchName: r.branch_name,
    branchCode: r.branch_code,
  }));
}

/**
 * Resolve the effective branch filter for a request. `requested` may be a
 * branch id or code; it is validated and must fall inside the user's scope.
 * Returns null when the query should be unfiltered.
 */
export async function resolveEffectiveBranchIds(
  tenantSlug: string,
  userId: string,
  requested?: string | null
): Promise<string[] | null> {
  const scope = await getBranchScope(tenantSlug, userId);
  if (requested) {
    const resolved = await resolveBranchIds(tenantSlug, [requested]);
    const id = resolved.get(0)!;
    if (scope && !scope.includes(id)) {
      throw Object.assign(
        new Error(`Branch "${requested}" is outside your access scope`),
        { status: 403 }
      );
    }
    return [id];
  }
  return scope;
}
