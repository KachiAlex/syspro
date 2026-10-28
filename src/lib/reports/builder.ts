import { randomUUID } from "crypto";
import { sql as SQL, db } from "../sql-client";

/**
 * User report builder — saved, parameterized, read-only reports over an
 * allowlisted set of tables and columns. No raw SQL ever reaches the DB:
 * table/column/operator names resolve against a server-side whitelist and
 * every value binds as a parameter. Shared reports are visible to anyone
 * in the tenant with finance:read.
 */

export async function ensureReportTables(sql: any = SQL) {
  await sql`
    create table if not exists custom_reports (
      id text primary key,
      tenant_slug text not null,
      name text not null,
      description text,
      table_name text not null,
      columns jsonb not null default '[]',
      filters jsonb not null default '[]',
      sort jsonb,
      row_limit int not null default 500,
      is_shared boolean not null default false,
      created_by text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
}

/** Allowlisted reporting surface — table → permitted columns. Any column
 *  not listed here is invisible to the builder (secrets, tokens, hashes
 *  never leak through a report). */
const REPORT_TABLES: Record<string, { label: string; columns: string[] }> = {
  finance_invoices: {
    label: "Sales Invoices",
    columns: ["invoice_number", "customer_name", "customer_code", "issued_date", "due_date", "status", "amount", "balance_due", "currency", "created_at"],
  },
  bills: {
    label: "Vendor Bills",
    columns: ["bill_number", "vendor_id", "bill_date", "due_date", "status", "total", "balance_due", "currency", "created_at"],
  },
  finance_customers: {
    label: "Customers",
    columns: ["customer_code", "name", "email", "credit_limit", "credit_hold", "created_at"],
  },
  vendors: {
    label: "Vendors",
    columns: ["name", "email", "phone", "vendor_type", "status", "created_at"],
  },
  sales_orders: {
    label: "Sales Orders",
    columns: ["order_number", "customer_name", "order_date", "due_date", "status", "quantity", "total", "created_at"],
  },
  purchase_orders: {
    label: "Purchase Orders",
    columns: ["order_number", "supplier_name", "issued_date", "expected_date", "status", "total_amount", "created_at"],
  },
  inventory_products: {
    label: "Products",
    columns: ["sku", "name", "category", "location", "current_stock", "min_stock", "unit_cost", "sale_price", "stock_uom", "created_at"],
  },
  stock_movements: {
    label: "Stock Movements",
    columns: ["product_sku", "product_name", "movement_type", "quantity", "unit_cost", "cogs_amount", "reference_type", "created_at"],
  },
  admin_employees: {
    label: "Employees",
    columns: ["employee_id", "first_name", "last_name", "email", "job_title", "status", "hire_date", "created_at"],
  },
  expenses: {
    label: "Expenses",
    columns: ["category", "description", "amount", "status", "expense_date", "created_at"],
  },
  finance_payments: {
    label: "Customer Payments",
    columns: ["payment_number", "customer_id", "payment_date", "amount", "method", "status", "created_at"],
  },
  vendor_payments: {
    label: "Vendor Payments",
    columns: ["payment_number", "vendor_id", "payment_date", "amount", "method", "status", "created_at"],
  },
  delivery_notes: {
    label: "Delivery Notes",
    columns: ["note_number", "customer_name", "delivery_date", "status", "total_amount", "driver", "vehicle", "created_at"],
  },
  purchase_receipts: {
    label: "Purchase Receipts",
    columns: ["receipt_number", "vendor_name", "received_date", "status", "total_amount", "created_at"],
  },
  approvals: {
    label: "Approvals",
    columns: ["entity_type", "status", "requested_by", "created_at", "decided_at", "current_step"],
  },
};

const OPS: Record<string, string> = {
  "=": "=", "!=": "<>", ">": ">", "<": "<", ">=": ">=", "<=": "<=",
  like: "ilike", is_null: "is null", is_not_null: "is not null",
};

export function listReportTables() {
  return Object.entries(REPORT_TABLES).map(([name, t]) => ({ name, label: t.label, columns: t.columns }));
}

function validate(input: {
  tableName: string;
  columns: string[];
  filters?: { field: string; op: string; value?: any }[];
  sort?: { field: string; dir?: string };
  limit?: number;
}) {
  const table = REPORT_TABLES[input.tableName];
  if (!table) throw new Error(`Table "${input.tableName}" is not available for reports`);
  const badCol = input.columns.find((c) => !table.columns.includes(c));
  if (badCol) throw new Error(`Column "${badCol}" is not available on ${input.tableName}`);
  if (!input.columns.length) input.columns = table.columns.slice(0, 8);
  for (const f of input.filters ?? []) {
    if (!table.columns.includes(f.field)) throw new Error(`Filter field "${f.field}" not available`);
    if (!OPS[f.op]) throw new Error(`Operator "${f.op}" not supported`);
  }
  if (input.sort && !table.columns.includes(input.sort.field)) {
    throw new Error(`Sort field "${input.sort.field}" not available`);
  }
  return input;
}

export async function saveCustomReport(input: {
  tenantSlug: string; name: string; description?: string;
  tableName: string; columns: string[];
  filters?: { field: string; op: string; value?: any }[];
  sort?: { field: string; dir?: string };
  limit?: number; isShared?: boolean; createdBy?: string;
}) {
  const sql = SQL;
  await ensureReportTables(sql);
  validate(input);
  const id = `rpt_${randomUUID().slice(0, 12)}`;
  await sql`
    insert into custom_reports
      (id, tenant_slug, name, description, table_name, columns, filters, sort, row_limit, is_shared, created_by)
    values (${id}, ${input.tenantSlug}, ${input.name}, ${input.description ?? null},
            ${input.tableName}, ${JSON.stringify(input.columns)},
            ${JSON.stringify(input.filters ?? [])},
            ${input.sort ? JSON.stringify(input.sort) : null},
            ${Math.min(Math.max(input.limit ?? 500, 1), 5000)},
            ${input.isShared ?? false}, ${input.createdBy ?? null})
  `;
  return { id, name: input.name };
}

export async function listCustomReports(tenantSlug: string) {
  const sql = SQL;
  await ensureReportTables(sql);
  return (await sql`
    select * from custom_reports where tenant_slug = ${tenantSlug}
    order by created_at desc
  `) as any[];
}

export async function getCustomReport(tenantSlug: string, id: string) {
  const sql = SQL;
  await ensureReportTables(sql);
  const [r] = (await sql`
    select * from custom_reports where id = ${id} and tenant_slug = ${tenantSlug}
  `) as any[];
  return r ?? null;
}

export async function deleteCustomReport(tenantSlug: string, id: string) {
  const sql = SQL;
  await sql`delete from custom_reports where id = ${id} and tenant_slug = ${tenantSlug}`;
}

/** Runs a saved report (or an ad-hoc def) — parameterized values only. */
export async function runCustomReport(input: {
  tenantSlug: string;
  tableName: string;
  columns: string[];
  filters?: { field: string; op: string; value?: any }[];
  sort?: { field: string; dir?: string };
  limit?: number;
}) {
  validate(input as any);
  const table = REPORT_TABLES[input.tableName];
  const cols = input.columns.join(", ");
  const params: any[] = [input.tenantSlug];
  const where: string[] = [`tenant_slug = $1`];
  for (const f of input.filters ?? []) {
    if (f.op === "is_null") { where.push(`${f.field} is null`); continue; }
    if (f.op === "is_not_null") { where.push(`${f.field} is not null`); continue; }
    params.push(f.value);
    where.push(`${f.field} ${OPS[f.op]} $${params.length}`);
  }
  const order = input.sort
    ? ` order by ${input.sort.field} ${input.sort.dir === "desc" ? "desc" : "asc"}`
    : "";
  const limit = Math.min(Math.max(input.limit ?? 500, 1), 5000);
  const res = await db.query<any>(
    `select ${cols} from ${input.tableName} where ${where.join(" and ")}${order} limit ${limit}`,
    params
  );
  return { table: input.tableName, label: table.label, columns: input.columns, rows: res.rows };
}
