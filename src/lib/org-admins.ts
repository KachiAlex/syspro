import { db, sql as SQL, SqlClient } from "@/lib/sql-client";

export type OrgAdminScope = "global" | "continent" | "region" | "country" | "state" | "branch" | "department" | "team";

export type OrgAdmin = {
  id: string;
  tenantSlug: string;
  nodeId: string;
  userEmail: string;
  displayName?: string | null;
  role?: string | null;
  scope: OrgAdminScope;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

async function ensureOrgAdminTable(sql: SqlClient = SQL) {
  await sql`
    create table if not exists org_admin_assignments (
      id uuid primary key default gen_random_uuid(),
      tenant_slug text not null,
      node_id text not null,
      user_email text not null,
      display_name text,
      role text,
      scope text not null,
      starts_at timestamptz,
      ends_at timestamptz,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`create index if not exists org_admin_assignments_tenant_idx on org_admin_assignments (tenant_slug)`;
  await sql`create index if not exists org_admin_assignments_node_idx on org_admin_assignments (tenant_slug, node_id)`;
  await sql`create index if not exists org_admin_assignments_user_idx on org_admin_assignments (tenant_slug, user_email)`;
}

export async function listOrgAdmins(tenantSlug: string, nodeId?: string, sql: SqlClient = SQL): Promise<OrgAdmin[]> {
  await ensureOrgAdminTable(sql);
  const rows = nodeId
    ? await sql`select * from org_admin_assignments where tenant_slug = ${tenantSlug} and node_id = ${nodeId} order by created_at desc`
    : await sql`select * from org_admin_assignments where tenant_slug = ${tenantSlug} order by created_at desc`;
  return rows.map(mapRow);
}

export async function upsertOrgAdmin(input: {
  id?: string;
  tenantSlug: string;
  nodeId: string;
  userEmail: string;
  displayName?: string | null;
  role?: string | null;
  scope: OrgAdminScope;
  startsAt?: string | null;
  endsAt?: string | null;
}, sql: SqlClient = SQL): Promise<OrgAdmin> {
  await ensureOrgAdminTable(sql);
  const id = input.id ?? (await sql`select gen_random_uuid() as id`).at(0)?.id ?? undefined;
  const [row] = await sql`
    insert into org_admin_assignments (id, tenant_slug, node_id, user_email, display_name, role, scope, starts_at, ends_at)
    values (${id}, ${input.tenantSlug}, ${input.nodeId}, ${input.userEmail}, ${input.displayName || null}, ${input.role || null}, ${input.scope}, ${input.startsAt || null}, ${input.endsAt || null})
    on conflict (id) do update set
      node_id = excluded.node_id,
      user_email = excluded.user_email,
      display_name = excluded.display_name,
      role = excluded.role,
      scope = excluded.scope,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      updated_at = now()
    returning *
  ` as any[];
  return mapRow(row);
}

export async function deleteOrgAdmin(id: string, tenantSlug: string, sql: SqlClient = SQL) {
  await ensureOrgAdminTable(sql);
  await sql`delete from org_admin_assignments where id = ${id} and tenant_slug = ${tenantSlug}`;
}

function mapRow(row: any): OrgAdmin {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    nodeId: row.node_id,
    userEmail: row.user_email,
    displayName: row.display_name,
    role: row.role,
    scope: row.scope,
    startsAt: row.starts_at?.toISOString?.() ?? row.starts_at ?? null,
    endsAt: row.ends_at?.toISOString?.() ?? row.ends_at ?? null,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  };
}
