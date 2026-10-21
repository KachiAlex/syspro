import { randomUUID } from "node:crypto";
import { sql as SQL } from "../sql-client";
import { ensureOnce } from "@/lib/ensure-once";

export type ImportEntity = "customers" | "vendors" | "products" | "opening_balances";

export interface ImportResult {
  jobId: string;
  entity: ImportEntity;
  totalRows: number;
  imported: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export function ensureImportTables(...args: Parameters<typeof ensureImportTablesRun>) {
  return ensureOnce("import/csv:ensureImportTables", () => ensureImportTablesRun(...args));
}

async function ensureImportTablesRun(sql = SQL) {
  await sql`
    create table if not exists import_jobs (
      id text primary key,
      tenant_slug text not null,
      entity text not null,
      status text not null default 'completed',
      total_rows integer not null default 0,
      imported integer not null default 0,
      failed integer not null default 0,
      errors jsonb,
      created_by text,
      created_at timestamptz not null default now()
    )
  `;
}

/** Minimal CSV parser — handles quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

function headerMap(header: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  header.forEach((h, i) => {
    map[h.trim().toLowerCase().replace(/[\s-]+/g, "_")] = i;
  });
  return map;
}

const get = (map: Record<string, number>, row: string[], ...names: string[]) => {
  for (const n of names) {
    const idx = map[n];
    if (idx != null && row[idx] != null && row[idx].trim() !== "") return row[idx].trim();
  }
  return undefined;
};

export async function importCsv(
  tenantSlug: string,
  entity: ImportEntity,
  csvText: string,
  opts: { createdBy?: string; dryRun?: boolean } = {}
): Promise<ImportResult> {
  const sql = SQL;
  if (!opts.dryRun) await ensureImportTables(sql);
  const rows = parseCsv(csvText);
  if (rows.length < 2) throw new Error("CSV must contain a header row and at least one data row");
  const map = headerMap(rows[0]);
  const data = rows.slice(1);

  const errors: Array<{ row: number; error: string }> = [];
  const openingLines: Array<{ accountCode: string; debitAmount: number; creditAmount: number }> = [];
  let openingDate = new Date().toISOString().split("T")[0];
  let imported = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNo = i + 2; // 1-based, after header
    try {
      switch (entity) {
        case "customers": {
          const name = get(map, row, "name", "customer_name", "customer");
          if (!name) throw new Error("name is required");
          const code = get(map, row, "code", "customer_code", "customer_id") ?? `C-${rowNo}`;
          if (!opts.dryRun) {
            await sql`
              insert into finance_customers (id, tenant_slug, customer_code, name, credit_limit, metadata, created_at, updated_at)
              values (${randomUUID()}, ${tenantSlug}, ${code}, ${name},
                      ${Number(get(map, row, "credit_limit") ?? 0) || null},
                      ${JSON.stringify({ email: get(map, row, "email") ?? null, phone: get(map, row, "phone") ?? null, imported: true })},
                      now(), now())
              on conflict (tenant_slug, customer_code)
              do update set name = excluded.name, updated_at = now()
            `;
          }
          break;
        }
        case "vendors": {
          const name = get(map, row, "name", "vendor_name", "vendor");
          if (!name) throw new Error("name is required");
          if (!opts.dryRun) {
            await sql`
              insert into vendors (id, tenant_slug, code, name, email, phone, payment_terms, is_active, created_at, updated_at)
              values (${`v_${randomUUID().slice(0, 10)}`}, ${tenantSlug},
                      ${get(map, row, "code", "vendor_code") ?? `V-${rowNo}`},
                      ${name}, ${get(map, row, "email") ?? null}, ${get(map, row, "phone") ?? null},
                      ${get(map, row, "payment_terms") ?? "net30"}, true, now(), now())
              on conflict do nothing
            `;
          }
          break;
        }
        case "products": {
          const name = get(map, row, "name", "product_name", "product");
          const sku = get(map, row, "sku", "code", "product_sku");
          if (!name || !sku) throw new Error("name and sku are required");
          if (!opts.dryRun) {
            await sql`
            insert into inventory_products (id, tenant_slug, name, sku, category, current_stock, min_stock, unit_cost, sale_price, supplier, description, created_at)
            values (${`prod_${Date.now()}_${randomUUID().slice(0, 6)}`}, ${tenantSlug}, ${name}, ${sku},
                    ${get(map, row, "category") ?? "general"},
                    ${Number(get(map, row, "quantity", "current_stock", "stock") ?? 0) || 0},
                    ${Number(get(map, row, "reorder_level", "min_stock") ?? 0) || 0},
                    ${Number(get(map, row, "unit_cost", "cost") ?? 0) || 0},
                    ${Number(get(map, row, "sale_price", "price") ?? 0) || 0},
                    ${get(map, row, "supplier") ?? ""}, ${get(map, row, "description") ?? ""}, now())
            on conflict (tenant_slug, sku)
            do update set name = excluded.name, unit_cost = excluded.unit_cost, sale_price = excluded.sale_price
          `;
          }
          break;
        }
        case "opening_balances": {
          // Each row: account_code, debit, credit, [entry_date] — collected and
          // posted as ONE opening journal after the loop.
          const accountCode = get(map, row, "account_code", "account", "code");
          if (!accountCode) throw new Error("account_code is required");
          const debit = Number(get(map, row, "debit") ?? 0) || 0;
          const credit = Number(get(map, row, "credit") ?? 0) || 0;
          if (debit === 0 && credit === 0) throw new Error("row has no debit or credit");
          openingLines.push({ accountCode, debitAmount: debit, creditAmount: credit });
          const d = get(map, row, "entry_date", "date");
          if (d) openingDate = d;
          break;
        }
        default:
          throw new Error(`Unsupported entity "${entity}"`);
      }
      imported++;
    } catch (err: any) {
      errors.push({ row: rowNo, error: err.message ?? String(err) });
    }
  }

  // Opening balances post as a single balanced journal: each account line
  // against a 3100 Retained Earnings offset.
  if (entity === "opening_balances" && openingLines.length > 0 && !opts.dryRun) {
    const totalDr = openingLines.reduce((s, l) => s + l.debitAmount, 0);
    const totalCr = openingLines.reduce((s, l) => s + l.creditAmount, 0);
    const { postGLEntry } = await import("../finance/gl");
    try {
      await postGLEntry({
        tenantSlug,
        entryDate: openingDate,
        journalType: "SYSTEM",
        referenceType: "opening_balance",
        description: "Opening balances — CSV import",
        status: "POSTED",
        lines: [
          ...openingLines.map((l) => ({ ...l, description: "Opening balance" })),
          {
            accountCode: "3100",
            debitAmount: totalCr,
            creditAmount: totalDr,
            description: "Opening equity offset",
          },
        ],
      });
    } catch (err: any) {
      // The single entry failed — every collected opening line failed with it.
      imported -= openingLines.length;
      errors.push({ row: 0, error: `Opening journal failed: ${err.message}` });
    }
  }

  const jobId = `imp_${randomUUID().slice(0, 12)}`;
  if (!opts.dryRun) {
    await sql`
      insert into import_jobs (id, tenant_slug, entity, status, total_rows, imported, failed, errors, created_by, created_at)
      values (${jobId}, ${tenantSlug}, ${entity}, 'completed', ${data.length}, ${imported},
              ${errors.length}, ${JSON.stringify(errors)}, ${opts.createdBy ?? null}, now())
    `;
  }
  return { jobId: opts.dryRun ? "dry_run" : jobId, entity, totalRows: data.length, imported, failed: errors.length, errors };
}

export async function listImportJobs(tenantSlug: string, limit = 50) {
  const sql = SQL;
  await ensureImportTables(sql);
  const rows = (await sql`
    select * from import_jobs where tenant_slug = ${tenantSlug}
    order by created_at desc limit ${Math.min(limit, 200)}
  `) as any[];
  return rows.map((r) => ({
    id: r.id, entity: r.entity, status: r.status,
    totalRows: r.total_rows, imported: r.imported, failed: r.failed,
    errors: typeof r.errors === "string" ? JSON.parse(r.errors) : r.errors,
    createdAt: r.created_at,
  }));
}
