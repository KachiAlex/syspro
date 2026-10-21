import { randomUUID } from "crypto";

import { db } from "@/lib/sql-client";

// Generic CSV data-import tool: upload → map → validate → insert → error report.

type EntitySpec = {
  table: string;
  required: string[];
  fields: string[];              // importable columns
  numeric?: string[];
  booleans?: string[];
  uniqueCheck?: { column: string; label: string };
};

const ENTITIES: Record<string, EntitySpec> = {
  customers: {
    table: "finance_customers",
    required: ["name", "customer_code"],
    fields: ["customer_code", "name", "email", "credit_limit", "default_currency"],
    numeric: ["credit_limit"],
    uniqueCheck: { column: "customer_code", label: "customer code" },
  },
  suppliers: {
    table: "vendors",
    required: ["vendor_code", "legal_name"],
    fields: ["vendor_code", "legal_name", "display_name", "vendor_type", "tax_id", "default_currency", "default_payment_terms"],
    uniqueCheck: { column: "vendor_code", label: "vendor code" },
  },
  items: {
    table: "inventory_products",
    required: ["sku", "name"],
    fields: ["sku", "name", "description", "category", "unit_cost", "sale_price", "min_stock", "supplier"],
    numeric: ["unit_cost", "sale_price", "min_stock"],
    uniqueCheck: { column: "sku", label: "SKU" },
  },
  employees: {
    table: "admin_employees",
    required: ["name"],
    fields: ["name", "email", "phone", "designation", "department_id", "employment_type", "hire_date"],
    uniqueCheck: { column: "email", label: "email" },
  },
  accounts: {
    table: "chart_of_accounts",
    required: ["code", "name", "type"],
    fields: ["code", "name", "type", "account_code", "account_name", "account_type", "currency"],
    uniqueCheck: { column: "code", label: "account code" },
  },
};

export const IMPORTABLE_ENTITIES = Object.keys(ENTITIES);

export function entitySpec(entity: string) {
  return ENTITIES[entity] ?? null;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur = "", row: string[] = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); if (row.some((v) => v !== "")) rows.push(row); }
  return rows;
}

export async function createImport(input: {
  tenantSlug: string; entity: string; fileName?: string;
  columnMap: Record<string, string>; createdBy?: string;
}) {
  if (!ENTITIES[input.entity]) throw new Error(`Unknown entity '${input.entity}'`);
  return (await db.query<any>(
    `insert into data_imports (tenant_slug, entity, file_name, column_map, created_by)
     values ($1,$2,$3,$4,$5) returning *`,
    [input.tenantSlug, input.entity, input.fileName ?? null,
     JSON.stringify(input.columnMap), input.createdBy ?? null]
  )).rows[0];
}

/**
 * Validate + insert CSV rows. `columnMap` maps CSV header → entity field.
 * Returns per-row errors; imported rows are committed one-by-one so a bad row
 * doesn't abort the batch (report surfaces the failures).
 */
export async function runImport(input: {
  tenantSlug: string;
  importId: string;
  csvText: string;
}) {
  const imp = (await db.query<any>(
    `select * from data_imports where id = $1 and tenant_slug = $2`,
    [input.importId, input.tenantSlug]
  )).rows[0];
  if (!imp) throw new Error("Import not found");
  const spec = ENTITIES[imp.entity];
  const columnMap = imp.column_map as Record<string, string>;

  const rows = parseCsv(input.csvText);
  if (rows.length < 2) throw new Error("CSV must have a header row and at least one data row");
  const headers = rows[0].map((h) => h.trim());
  const errors: { row: number; message: string }[] = [];
  let imported = 0;

  for (let i = 1; i < rows.length; i++) {
    const rec: Record<string, any> = {};
    for (let c = 0; c < headers.length; c++) {
      const field = columnMap[headers[c]];
      if (field && spec.fields.includes(field)) rec[field] = rows[i][c]?.trim() ?? "";
    }
    const missing = spec.required.filter((f) => !rec[f]);
    if (missing.length) {
      errors.push({ row: i + 1, message: `Missing required: ${missing.join(", ")}` });
      continue;
    }
    // Coerce types.
    for (const f of spec.numeric ?? [])
      if (rec[f] !== "" && rec[f] != null) {
        const n = Number(rec[f]);
        if (Number.isNaN(n)) { errors.push({ row: i + 1, message: `'${f}' not numeric` }); rec.__bad = true; }
        else rec[f] = n;
      }
    if (rec.__bad) { delete rec.__bad; continue; }
    for (const f of spec.booleans ?? [])
      if (rec[f] != null) rec[f] = ["true", "1", "yes", "y"].includes(String(rec[f]).toLowerCase());

    if (spec.uniqueCheck && rec[spec.uniqueCheck.column]) {
      const dup = await db.query(
        `select 1 from ${spec.table} where tenant_slug = $1 and ${spec.uniqueCheck.column} = $2 limit 1`,
        [input.tenantSlug, rec[spec.uniqueCheck.column]]
      );
      if (dup.rows.length) {
        errors.push({ row: i + 1, message: `Duplicate ${spec.uniqueCheck.label} '${rec[spec.uniqueCheck.column]}'` });
        continue;
      }
    }

    const cols = Object.keys(rec);
    const vals = cols.map((c) => rec[c] === "" ? null : rec[c]);
    try {
      await db.query(
        `insert into ${spec.table} (id, tenant_slug, ${cols.join(", ")})
         values ($1, $2, ${cols.map((_, j) => `$${j + 3}`).join(", ")})`,
        [randomUUID(), input.tenantSlug, ...vals]
      );
      imported++;
    } catch (err) {
      errors.push({ row: i + 1, message: err instanceof Error ? err.message : String(err) });
    }
  }

  const status = errors.length && !imported ? "failed" : "imported";
  const updated = (await db.query<any>(
    `update data_imports set status=$1, total_rows=$2, imported_rows=$3,
       failed_rows=$4, errors=$5, completed_at=now()
     where id=$6 returning *`,
    [status, rows.length - 1, imported, errors.length, JSON.stringify(errors.slice(0, 200)), input.importId]
  )).rows[0];
  return { import: updated, imported, errors: errors.slice(0, 50) };
}

export async function listImports(tenantSlug: string, limit = 50) {
  return (await db.query<any>(
    `select id, entity, file_name, status, total_rows, imported_rows, failed_rows,
       created_at, completed_at
     from data_imports where tenant_slug = $1 order by created_at desc limit $2`,
    [tenantSlug, limit]
  )).rows;
}

export async function getImport(tenantSlug: string, id: string) {
  return (await db.query<any>(
    `select * from data_imports where id = $1 and tenant_slug = $2`,
    [id, tenantSlug]
  )).rows[0] ?? null;
}
