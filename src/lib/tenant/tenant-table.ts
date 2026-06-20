import { SqlClient } from "@/lib/sql-client";

/**
 * Ensure the core `tenants` table exists with the columns required across the
 * tenant-admin and CRM flows. This helper is safe to call multiple times.
 */
export async function ensureTenantTable(sql: SqlClient) {
  await sql`
    create table if not exists tenants (
      id uuid primary key,
      name text not null,
      code text,
      domain text,
      "isActive" boolean default false,
      settings jsonb,
      "schemaName" text,
      "createdAt" timestamptz default now(),
      "updatedAt" timestamptz default now(),
      "deletedAt" timestamptz
    )
  `;

  await sql`alter table tenants add column if not exists settings jsonb default '{}'::jsonb`;
  await sql`alter table tenants add column if not exists slug text`;
  await sql`alter table tenants add column if not exists region text`;
  await sql`alter table tenants add column if not exists industry text`;
  await sql`alter table tenants add column if not exists seats integer`;
  await sql`alter table tenants add column if not exists status text default 'Pending'`;
  await sql`alter table tenants add column if not exists ledger_delta text default '₦0'`;
  await sql`alter table tenants add column if not exists admin_name text`;
  await sql`alter table tenants add column if not exists admin_email text`;
  await sql`alter table tenants add column if not exists admin_password_hash text`;
  await sql`alter table tenants add column if not exists admin_notes text`;
  await sql`alter table tenants add column if not exists default_region_id text`;
  await sql`alter table tenants add column if not exists default_region_name text`;
  await sql`alter table tenants add column if not exists default_branch_id text`;
  await sql`alter table tenants add column if not exists default_branch_name text`;

  await sql`create unique index if not exists tenants_slug_key on tenants(slug)`;
}
