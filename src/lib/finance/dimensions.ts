import { randomUUID } from "crypto";
import { db } from "../sql-client";

export interface AccountingDimension {
  id: string;
  tenantSlug: string;
  dimensionKey: string;
  label: string;
  requiredFor: string[];
  allowedValues: string[] | null;
  active: boolean;
  createdAt: string;
}

function toDim(r: any): AccountingDimension {
  const parse = (v: any) => (typeof v === "string" ? JSON.parse(v) : v);
  return {
    id: r.id,
    tenantSlug: r.tenant_slug,
    dimensionKey: r.dimension_key,
    label: r.label,
    requiredFor: parse(r.required_for) ?? [],
    allowedValues: parse(r.allowed_values),
    active: Boolean(r.active),
    createdAt: r.created_at,
  };
}

async function ensureTable() {
  // Table is provisioned by ensureGLTables (single schema owner); guard for
  // callers that reach this module first.
  await db.query(`
    create table if not exists accounting_dimensions (
      id uuid primary key default gen_random_uuid(),
      tenant_slug text not null,
      dimension_key text not null,
      label text not null,
      required_for jsonb not null default '[]'::jsonb,
      allowed_values jsonb,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      unique (tenant_slug, dimension_key)
    )`);
}

export async function listDimensions(tenantSlug: string): Promise<AccountingDimension[]> {
  await ensureTable();
  const { rows } = await db.query(
    `select * from accounting_dimensions where tenant_slug = $1 order by dimension_key`,
    [tenantSlug],
  );
  return (rows as any[]).map(toDim);
}

export async function upsertDimension(input: {
  tenantSlug: string;
  dimensionKey: string;
  label: string;
  requiredFor?: string[];
  allowedValues?: string[] | null;
  active?: boolean;
}): Promise<AccountingDimension> {
  await ensureTable();
  const key = input.dimensionKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
  if (!key) throw new Error("dimensionKey is required");
  const { rows } = await db.query(
    `insert into accounting_dimensions (id, tenant_slug, dimension_key, label, required_for, allowed_values, active)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (tenant_slug, dimension_key)
     do update set label = excluded.label, required_for = excluded.required_for,
                   allowed_values = excluded.allowed_values, active = excluded.active
     returning *`,
    [
      randomUUID(), input.tenantSlug, key, input.label,
      JSON.stringify(input.requiredFor ?? []),
      input.allowedValues ? JSON.stringify(input.allowedValues) : null,
      input.active ?? true,
    ],
  );
  return toDim((rows as any[])[0]);
}

export async function deleteDimension(id: string, tenantSlug: string): Promise<boolean> {
  await ensureTable();
  const { rowCount } = await db.query(
    `delete from accounting_dimensions where id = $1 and tenant_slug = $2`,
    [id, tenantSlug],
  );
  return (rowCount ?? 0) > 0;
}
