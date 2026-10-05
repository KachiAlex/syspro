import { SqlClient } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";

/**
 * Ensure the core `tenants` table exists with the columns required across the
 * tenant-admin and CRM flows. This helper is safe to call multiple times.
 */
export function ensureTenantTable(...args: Parameters<typeof ensureTenantTableRun>) {
  return ensureOnce("tenant/tenant-table:ensureTenantTable", () => ensureTenantTableRun(...args));
}

async function ensureTenantTableRun(sql: SqlClient) {
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

  await sql`alter table tenants add column if not exists "isActive" boolean default false`;

  await sql`alter table tenants add column if not exists industry_profiles jsonb default '[]'::jsonb`;

  // Columns that exist in dev-created schemas but were missing from older
  // production databases — several routes select them unconditionally.
  await sql`alter table tenants add column if not exists code text`;
  await sql`alter table tenants add column if not exists domain text`;
  await sql`alter table tenants add column if not exists "schemaName" text`;
  await sql`alter table tenants add column if not exists "createdAt" timestamptz default now()`;
  await sql`alter table tenants add column if not exists "updatedAt" timestamptz default now()`;
  await sql`alter table tenants add column if not exists "deletedAt" timestamptz`;
  await sql`
    do $$
    begin
      if exists (select 1 from information_schema.columns
                 where table_name = 'tenants' and column_name = 'created_at') then
        update tenants set "createdAt" = created_at
          where "createdAt" is null and created_at is not null;
      end if;
    end $$
  `;

  await sql`create unique index if not exists tenants_slug_key on tenants(slug)`;

  // tenant_admins is queried by tenant_slug in several routes; older schemas
  // only have tenant_id, so add and backfill the slug column.
  await sql`
    create table if not exists tenant_admins (
      id serial primary key,
      tenant_id integer,
      email text not null,
      name text,
      password_hash text,
      role text default 'admin',
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`alter table tenant_admins add column if not exists tenant_slug text`;
  await sql`
    update tenant_admins ta
    set tenant_slug = t.slug
    from tenants t
    where ta.tenant_id = t.id and ta.tenant_slug is null
  `;
  await sql`create index if not exists tenant_admins_tenant_slug_idx on tenant_admins(tenant_slug)`;

  // Employee portal password-reset tokens (used by /api/employee/forgot-password
  // and /api/employee/reset-password).
  await sql`
    create table if not exists admin_password_reset_tokens (
      id serial primary key,
      tenant_slug text not null,
      employee_id text,
      token text not null,
      expires_at timestamptz not null,
      used boolean not null default false,
      created_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists admin_password_reset_tokens_token_idx on admin_password_reset_tokens(token)`;
  await sql`create index if not exists admin_password_reset_tokens_tenant_idx on admin_password_reset_tokens(tenant_slug)`;

  // Per-tenant security settings shown on the tenant-admin security page
  // (MFA requirements, session policy, password rules).
  await sql`
    create table if not exists tenant_security_settings (
      tenant_slug text primary key,
      mfa_settings jsonb not null default '{}'::jsonb,
      security_metrics jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `;

  // Per-user notification preferences (channels, categories, quiet hours).
  await sql`
    create table if not exists user_notification_preferences (
      user_id text primary key,
      tenant_slug text,
      preferences jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `;
}
