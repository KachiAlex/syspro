import { randomUUID } from "node:crypto";
import { db, sql as SQL } from "../sql-client";
import { ensureOnce } from "@/lib/ensure-once";

/**
 * Low-code extensibility: tenant-defined custom fields per doctype.
 * Values live in each document's metadata.custom_fields jsonb — no schema
 * changes per tenant, safe for multi-tenant use. Definitions are validated
 * here; records store values against field_name.
 */

export type CustomFieldType = "text" | "number" | "date" | "boolean" | "select";

export interface CustomFieldDef {
  id: string;
  doctype: string;
  fieldName: string;
  label: string;
  fieldType: CustomFieldType;
  options: string[] | null;
  required: boolean;
  createdAt: string;
}

/** Doctypes that accept custom fields — guard against arbitrary table abuse. */
export const CUSTOMIZABLE_DOCTYPES = [
  "finance_invoices",
  "bills",
  "finance_customers",
  "vendors",
  "inventory_products",
  "sales_orders",
  "projects",
  "admin_employees",
] as const;

export function ensureCustomFieldTables(...args: Parameters<typeof ensureRun>) {
  return ensureOnce("platform/custom-fields:ensure", () => ensureRun(...args));
}

async function ensureRun(sql = SQL) {
  // Custom values live in metadata.custom_fields — ensure the column exists.
  await sql`alter table if exists inventory_products add column if not exists metadata jsonb`;
  await sql`alter table if exists projects add column if not exists metadata jsonb`;
  await sql`alter table if exists admin_employees add column if not exists metadata jsonb`;
  await sql`alter table if exists sales_orders add column if not exists metadata jsonb`;
  await sql`
    create table if not exists custom_field_defs (
      id text primary key,
      tenant_slug text not null,
      doctype text not null,
      field_name text not null,
      label text not null,
      field_type text not null check (field_type in ('text','number','date','boolean','select')),
      options jsonb,
      required boolean not null default false,
      created_at timestamptz not null default now(),
      unique (tenant_slug, doctype, field_name)
    )
  `;
}

const FIELD_NAME_RE = /^[a-z][a-z0-9_]{0,49}$/;

export async function defineCustomField(
  tenantSlug: string,
  input: {
    doctype: string;
    fieldName: string;
    label: string;
    fieldType: CustomFieldType;
    options?: string[];
    required?: boolean;
  }
): Promise<CustomFieldDef> {
  const sql = SQL;
  await ensureCustomFieldTables(sql);
  if (!CUSTOMIZABLE_DOCTYPES.includes(input.doctype as any)) {
    throw new Error(`"${input.doctype}" is not a customizable doctype`);
  }
  if (!FIELD_NAME_RE.test(input.fieldName)) {
    throw new Error("fieldName must be snake_case (lowercase letters, digits, underscores)");
  }
  if (input.fieldType === "select" && (!input.options || input.options.length === 0)) {
    throw new Error("select fields require options");
  }
  const id = `cfd_${randomUUID().slice(0, 10)}`;
  const [row] = (await sql`
    insert into custom_field_defs (id, tenant_slug, doctype, field_name, label, field_type, options, required, created_at)
    values (${id}, ${tenantSlug}, ${input.doctype}, ${input.fieldName}, ${input.label},
            ${input.fieldType}, ${input.options ? JSON.stringify(input.options) : null},
            ${input.required ?? false}, now())
    on conflict (tenant_slug, doctype, field_name)
    do update set label = excluded.label, field_type = excluded.field_type,
                  options = excluded.options, required = excluded.required
    returning *
  `) as any[];
  return normalize(row);
}

export async function listCustomFields(tenantSlug: string, doctype?: string): Promise<CustomFieldDef[]> {
  const sql = SQL;
  await ensureCustomFieldTables(sql);
  const rows = (await sql`
    select * from custom_field_defs
    where tenant_slug = ${tenantSlug}
      and (${doctype ?? null}::text is null or doctype = ${doctype ?? null})
    order by doctype, field_name
  `) as any[];
  return rows.map(normalize);
}

export async function deleteCustomField(tenantSlug: string, id: string): Promise<boolean> {
  const sql = SQL;
  await ensureCustomFieldTables(sql);
  const rows = (await sql`
    delete from custom_field_defs where id = ${id} and tenant_slug = ${tenantSlug} returning id
  `) as any[];
  return rows.length > 0;
}

/**
 * Validate a custom_fields value object against the tenant's definitions for
 * the doctype. Returns an error string or null.
 */
export async function validateCustomFieldValues(
  tenantSlug: string,
  doctype: string,
  values: Record<string, unknown>
): Promise<string | null> {
  const defs = await listCustomFields(tenantSlug, doctype);
  const byName = new Map(defs.map((d) => [d.fieldName, d]));
  for (const def of defs) {
    if (def.required && (values[def.fieldName] == null || values[def.fieldName] === "")) {
      return `${def.label} is required`;
    }
  }
  for (const [key, value] of Object.entries(values ?? {})) {
    const def = byName.get(key);
    if (!def) return `Unknown custom field "${key}" for ${doctype}`;
    if (value == null) continue;
    switch (def.fieldType) {
      case "number":
        if (typeof value !== "number" || !Number.isFinite(value)) return `${def.label} must be a number`;
        break;
      case "boolean":
        if (typeof value !== "boolean") return `${def.label} must be true/false`;
        break;
      case "date":
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${def.label} must be YYYY-MM-DD`;
        break;
      case "select":
        if (!def.options?.includes(String(value))) return `${def.label} must be one of: ${def.options?.join(", ")}`;
        break;
      default:
        if (typeof value !== "string") return `${def.label} must be text`;
    }
  }
  return null;
}

/**
 * Merge validated custom-field values into a document's metadata.custom_fields.
 * Works for any doctype whose table has a jsonb `metadata` column and an
 * (id, tenant_slug) key — generic, parameterized only by whitelisted doctype.
 */
export async function setCustomFieldValues(
  tenantSlug: string,
  doctype: string,
  recordId: string,
  values: Record<string, unknown>
): Promise<{ error?: string }> {
  if (!CUSTOMIZABLE_DOCTYPES.includes(doctype as any)) {
    return { error: `"${doctype}" is not a customizable doctype` };
  }
  const err = await validateCustomFieldValues(tenantSlug, doctype, values);
  if (err) return { error: err };
  const res = await db.query(
    `update ${doctype}
       set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{custom_fields}', $3::jsonb, true)
     where id::text = $1 and tenant_slug = $2
     returning id::text as id`,
    [recordId, tenantSlug, JSON.stringify(values ?? {})]
  );
  if (!res.rows.length) return { error: `Record ${recordId} not found in ${doctype}` };
  return {};
}

export async function getCustomFieldValues(
  tenantSlug: string,
  doctype: string,
  recordId: string
): Promise<Record<string, unknown> | { error: string }> {
  if (!CUSTOMIZABLE_DOCTYPES.includes(doctype as any)) {
    return { error: `"${doctype}" is not a customizable doctype` };
  }
  const res = await db.query(
    `select metadata -> 'custom_fields' as cf from ${doctype} where id::text = $1 and tenant_slug = $2`,
    [recordId, tenantSlug]
  );
  if (!res.rows.length) return { error: `Record ${recordId} not found in ${doctype}` };
  return ((res.rows[0] as any).cf as Record<string, unknown>) ?? {};
}

function normalize(r: any): CustomFieldDef {
  return {
    id: r.id,
    doctype: r.doctype,
    fieldName: r.field_name,
    label: r.label,
    fieldType: r.field_type,
    options: typeof r.options === "string" ? JSON.parse(r.options) : r.options,
    required: r.required,
    createdAt: r.created_at,
  };
}
