import { db, sql as SQL, SqlClient } from "@/lib/sql-client";

/* using imported SQL */

export async function ensurePolicyTables(sql: SqlClient = SQL) {
  await sql`create extension if not exists "pgcrypto"`;
  await sql`
    create table if not exists policies (
      id uuid primary key default gen_random_uuid(),
      tenant_slug text not null,
      policy_key text not null,
      name text not null,
      category text,
      scope jsonb,
      status text not null default 'draft' check (status in ('draft','published','deprecated')),
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      unique (tenant_slug, policy_key)
    )
  `;

  await sql`
    create table if not exists policy_versions (
      id uuid primary key default gen_random_uuid(),
      policy_id uuid not null references policies(id) on delete cascade,
      version integer not null,
      document jsonb not null,
      effective_at timestamptz,
      created_at timestamptz default now(),
      unique (policy_id, version)
    )
  `;

  await sql`
    create table if not exists policy_overrides (
      id uuid primary key default gen_random_uuid(),
      policy_id uuid not null references policies(id) on delete cascade,
      tenant_slug text not null,
      scope jsonb,
      reason text,
      created_by text,
      created_at timestamptz default now()
    )
  `;
}

export async function listPolicies(tenantSlug: string, sql: SqlClient = SQL) {
  await ensurePolicyTables(sql);
  const policies = (await sql`select * from policies where tenant_slug = ${tenantSlug} order by created_at desc`) as any[];
  const versions = (await sql`
    select pv.* from policy_versions pv
    join policies p on p.id = pv.policy_id
    where p.tenant_slug = ${tenantSlug}
  `) as any[];
  const versionsArr = versions as any[];
  const versionsByPolicy = versionsArr.reduce<Record<string, any[]>>((acc: Record<string, any[]>, row: any) => {
    acc[row.policy_id] = acc[row.policy_id] || [];
    acc[row.policy_id].push(row);
    return acc;
  }, {} as Record<string, any[]>);
  return policies.map((p: any) => ({
    id: p.id,
    tenantSlug: p.tenant_slug,
    key: p.policy_key,
    name: p.name,
    category: p.category,
    scope: p.scope,
    status: p.status,
    createdAt: p.created_at?.toISOString?.() ?? p.created_at,
    updatedAt: p.updated_at?.toISOString?.() ?? p.updated_at,
    versions: (versionsByPolicy[p.id] || []).map((v: any) => ({
      id: v.id,
      version: v.version,
      document: v.document,
      effectiveAt: v.effective_at?.toISOString?.() ?? v.effective_at,
      createdAt: v.created_at?.toISOString?.() ?? v.created_at,
    })),
  }));
}

export async function getPolicyWithVersions(id: string, tenantSlug: string, sql: SqlClient = SQL) {
  await ensurePolicyTables(sql);
  const policies = await sql`select * from policies where id = ${id} and tenant_slug = ${tenantSlug} limit 1`;
  if (!policies.length) return null;
  const policy = policies[0];
  const versions = await sql`select * from policy_versions where policy_id = ${policy.id} order by version desc`;
  return {
    id: policy.id,
    tenantSlug: policy.tenant_slug,
    key: policy.policy_key,
    name: policy.name,
    category: policy.category,
    scope: policy.scope,
    status: policy.status,
    createdAt: policy.created_at?.toISOString?.() ?? policy.created_at,
    updatedAt: policy.updated_at?.toISOString?.() ?? policy.updated_at,
    versions: versions.map((v: any) => ({
      id: v.id,
      version: v.version,
      document: v.document,
      effectiveAt: v.effective_at?.toISOString?.() ?? v.effective_at,
      createdAt: v.created_at?.toISOString?.() ?? v.created_at,
    })),
  };
}

export async function createPolicy(input: { tenantSlug: string; key: string; name: string; category?: string; scope?: any; document: any; effectiveAt?: string | null }, sql: SqlClient = SQL) {
  await ensurePolicyTables(sql);
  const [policy] = await sql`
    insert into policies (tenant_slug, policy_key, name, category, scope, status)
    values (${input.tenantSlug}, ${input.key}, ${input.name}, ${input.category || null}, ${input.scope || null}, 'draft')
    returning *
  ` as any[];

  const [version] = await sql`
    insert into policy_versions (policy_id, version, document, effective_at)
    values (${policy.id}, 1, ${JSON.stringify(input.document)}, ${input.effectiveAt || null})
    returning *
  ` as any[];

  return {
    id: policy.id,
    tenantSlug: policy.tenant_slug,
    key: policy.policy_key,
    name: policy.name,
    category: policy.category,
    scope: policy.scope,
    status: policy.status,
    createdAt: policy.created_at?.toISOString?.() ?? policy.created_at,
    updatedAt: policy.updated_at?.toISOString?.() ?? policy.updated_at,
    versions: [
      {
        id: version.id,
        version: version.version,
        document: version.document,
        effectiveAt: version.effective_at?.toISOString?.() ?? version.effective_at,
        createdAt: version.created_at?.toISOString?.() ?? version.created_at,
      },
    ],
  };
}

export async function addPolicyVersion(policyId: string, versionNumber: number, document: any, effectiveAt?: string | null, sql: SqlClient = SQL) {
  await ensurePolicyTables(sql);
  const [version] = await sql`
    insert into policy_versions (policy_id, version, document, effective_at)
    values (${policyId}, ${versionNumber}, ${JSON.stringify(document)}, ${effectiveAt || null})
    returning *
  ` as any[];
  return version;
}

export async function updatePolicyStatus(policyId: string, status: "draft" | "published" | "deprecated", sql: SqlClient = SQL) {
  await ensurePolicyTables(sql);
  const [row] = await sql`update policies set status = ${status}, updated_at = now() where id = ${policyId} returning *` as any[];
  return row;
}

export async function addPolicyOverride(input: { policyId: string; tenantSlug: string; scope?: any; reason?: string; createdBy?: string }, sql: SqlClient = SQL) {
  await ensurePolicyTables(sql);
  await sql`
    insert into policy_overrides (policy_id, tenant_slug, scope, reason, created_by)
    values (${input.policyId}, ${input.tenantSlug}, ${input.scope || null}, ${input.reason || null}, ${input.createdBy || null})
  `;
}
