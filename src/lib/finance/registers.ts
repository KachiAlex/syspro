import { randomUUID } from "crypto";
import { db } from "../sql-client";
import { ReportFilters } from "./assets-reports";

/** Append a branch predicate (`column = ANY($n)`) like reports-db.branchFilter. */
function branchFilter(filters: ReportFilters, params: any[], column: string): string {
  const ids = filters.branchIds?.length
    ? filters.branchIds
    : filters.branch
      ? [filters.branch]
      : null;
  if (!ids) return "";
  params.push(ids);
  return ` AND ${column} = ANY($${params.length})`;
}

function toCsv(rows: any[][], headers: string[]): string {
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

// ─── Sales / Purchase Registers ─────────────────────────────────────────────

export interface RegisterRow {
  documentNumber: string;
  documentDate: string;
  party: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  subtotal: number;
  tax: number;
  total: number;
  balanceDue: number;
  status: string;
  currency?: string;
  branchId?: string | null;
}

export interface RegisterReport {
  kind: "sales" | "purchase";
  itemWise: boolean;
  rows: RegisterRow[];
  totals: { subtotal: number; tax: number; total: number; balanceDue: number };
}

export async function generateSalesRegister(
  filters: ReportFilters,
  itemWise = false,
): Promise<RegisterReport> {
  const params: any[] = [filters.tenantSlug];
  let where = `i.tenant_slug = $1 and i.status <> 'void'`;
  if (filters.periodStart) {
    params.push(filters.periodStart);
    where += ` and i.issued_date >= $${params.length}`;
  }
  if (filters.periodEnd) {
    params.push(filters.periodEnd);
    where += ` and i.issued_date <= $${params.length}`;
  }
  where += branchFilter(filters, params, "i.branch_id");

  const { rows } = itemWise
    ? await db.query(
        `select i.invoice_number, i.issued_date, coalesce(i.customer_name,'') party,
                l.description, l.quantity, l.unit_price, l.amount line_total,
                coalesce(l.tax_rate,0) tax_rate, i.amount inv_total, i.balance_due,
                i.status, i.currency, i.branch_id
         from finance_invoices i
         join finance_invoice_lines l on l.invoice_id = i.id
         where ${where}
         order by i.issued_date, i.invoice_number`,
        params,
      )
    : await db.query(
        `select i.invoice_number, i.issued_date, coalesce(i.customer_name,'') party,
                coalesce(i.amount,0) - coalesce(t.tax,0) subtotal,
                coalesce(t.tax,0) tax, i.amount inv_total, i.balance_due,
                i.status, i.currency, i.branch_id
         from finance_invoices i
         left join (
           select invoice_id, sum(amount * coalesce(tax_rate,0) / 100) tax
           from finance_invoice_lines group by invoice_id
         ) t on t.invoice_id = i.id
         where ${where}
         order by i.issued_date, i.invoice_number`,
        params,
      );

  const report: RegisterReport = {
    kind: "sales",
    itemWise,
    rows: [],
    totals: { subtotal: 0, tax: 0, total: 0, balanceDue: 0 },
  };

  for (const r of rows as any[]) {
    const taxAmt = itemWise
      ? (Number(r.line_total) * Number(r.tax_rate)) / 100
      : Number(r.tax);
    const row: RegisterRow = {
      documentNumber: r.invoice_number,
      documentDate: new Date(r.issued_date).toISOString().slice(0, 10),
      party: r.party,
      description: itemWise ? r.description : undefined,
      quantity: itemWise ? Number(r.quantity) : undefined,
      unitPrice: itemWise ? Number(r.unit_price) : undefined,
      subtotal: itemWise ? Number(r.line_total) : Number(r.subtotal),
      tax: taxAmt,
      total: itemWise ? Number(r.line_total) + taxAmt : Number(r.inv_total),
      balanceDue: Number(r.balance_due),
      status: r.status,
      currency: r.currency,
      branchId: r.branch_id,
    };
    report.rows.push(row);
    report.totals.subtotal += row.subtotal;
    report.totals.tax += row.tax;
    report.totals.total += row.total;
    report.totals.balanceDue += row.balanceDue;
  }
  return report;
}

export async function generatePurchaseRegister(
  filters: ReportFilters,
  itemWise = false,
): Promise<RegisterReport> {
  const params: any[] = [filters.tenantSlug];
  let where = `b.tenant_slug = $1 and b.status <> 'cancelled' and b.status <> 'void'`;
  if (filters.periodStart) {
    params.push(filters.periodStart);
    where += ` and b.bill_date >= $${params.length}`;
  }
  if (filters.periodEnd) {
    params.push(filters.periodEnd);
    where += ` and b.bill_date <= $${params.length}`;
  }
  where += branchFilter(filters, params, "b.branch_id");

  const { rows } = itemWise
    ? await db.query(
        `select b.bill_number, b.bill_date,
                coalesce(v.display_name, v.legal_name, b.vendor_id::text) party,
                l.description, l.quantity, l.unit_price, l.line_amount,
                coalesce(l.tax_rate,0) tax_rate, b.subtotal, b.taxes, b.total,
                b.balance_due, b.status, b.currency, b.branch_id
         from bills b
         left join vendors v on v.id = b.vendor_id::text
         join bill_items l on l.bill_id = b.id
         where ${where}
         order by b.bill_date, b.bill_number`,
        params,
      )
    : await db.query(
        `select b.bill_number, b.bill_date,
                coalesce(v.display_name, v.legal_name, b.vendor_id::text) party,
                b.subtotal, b.taxes, b.total, b.balance_due, b.status, b.currency, b.branch_id
         from bills b
         left join vendors v on v.id = b.vendor_id::text
         where ${where}
         order by b.bill_date, b.bill_number`,
        params,
      );

  const report: RegisterReport = {
    kind: "purchase",
    itemWise,
    rows: [],
    totals: { subtotal: 0, tax: 0, total: 0, balanceDue: 0 },
  };

  for (const r of rows as any[]) {
    // bill_items.line_amount is tax-INCLUSIVE (line + tax stored together)
    const lineTotal = Number(r.line_amount);
    const rate = Number(r.tax_rate) / 100;
    const lineNet = rate > 0 ? lineTotal / (1 + rate) : lineTotal;
    const row: RegisterRow = {
      documentNumber: r.bill_number,
      documentDate: new Date(r.bill_date).toISOString().slice(0, 10),
      party: r.party,
      description: itemWise ? r.description : undefined,
      quantity: itemWise ? Number(r.quantity) : undefined,
      unitPrice: itemWise ? Number(r.unit_price) : undefined,
      subtotal: itemWise ? lineNet : Number(r.subtotal),
      tax: itemWise ? lineTotal - lineNet : Number(r.taxes),
      total: itemWise ? lineTotal : Number(r.total),
      balanceDue: Number(r.balance_due),
      status: r.status,
      currency: r.currency,
      branchId: r.branch_id,
    };
    report.rows.push(row);
    report.totals.subtotal += row.subtotal;
    report.totals.tax += row.tax;
    report.totals.total += row.total;
    report.totals.balanceDue += row.balanceDue;
  }
  return report;
}

export function generateRegisterCSV(report: RegisterReport): string {
  const baseHeaders = ["Document", "Date", report.kind === "sales" ? "Customer" : "Vendor"];
  const itemHeaders = report.itemWise ? ["Item", "Qty", "Unit Price"] : [];
  const headers = [...baseHeaders, ...itemHeaders, "Subtotal", "Tax", "Total", "Balance Due", "Status", "Currency", "Branch"];
  const rows = report.rows.map((r) => [
    r.documentNumber,
    r.documentDate,
    r.party,
    ...(report.itemWise ? [r.description, r.quantity, r.unitPrice] : []),
    r.subtotal.toFixed(2),
    r.tax.toFixed(2),
    r.total.toFixed(2),
    r.balanceDue.toFixed(2),
    r.status,
    r.currency ?? "",
    r.branchId ?? "",
  ]);
  rows.push(["TOTAL", "", "", ...(report.itemWise ? ["", "", ""] : []), report.totals.subtotal.toFixed(2), report.totals.tax.toFixed(2), report.totals.total.toFixed(2), report.totals.balanceDue.toFixed(2), "", "", ""]);
  return toCsv(rows, headers);
}

// ─── Customer / Supplier Ledger Summaries ────────────────────────────────────

export interface LedgerSummaryRow {
  partyId: string;
  party: string;
  opening: number;
  invoiced: number;
  paid: number;
  closing: number;
}

export interface LedgerSummaryReport {
  kind: "customer" | "supplier";
  rows: LedgerSummaryRow[];
  totals: { opening: number; invoiced: number; paid: number; closing: number };
}

export async function generateCustomerLedgerSummary(
  filters: ReportFilters,
): Promise<LedgerSummaryReport> {
  const invParams: any[] = [filters.tenantSlug];
  let invWhere = `tenant_slug = $1 and status <> 'void'`;
  if (filters.periodEnd) {
    invParams.push(filters.periodEnd);
    invWhere += ` and issued_date <= $${invParams.length}`;
  }
  invWhere += branchFilter(filters, invParams, "branch_id");

  const startIdx = filters.periodStart ? (invParams.push(filters.periodStart), invParams.length) : 0;

  const { rows } = await db.query(
    `select coalesce(customer_id::text, customer_code, customer_name) party_key,
            coalesce(customer_name, customer_code, 'Unknown') party,
            sum(amount) total_invoiced,
            sum(case when ${startIdx ? `issued_date < $${startIdx}` : "false"} then amount else 0 end) opening_invoiced,
            sum(case when ${startIdx ? `issued_date >= $${startIdx}` : "true"} then amount else 0 end) period_invoiced
     from finance_invoices
     where ${invWhere}
     group by 1, 2`,
    invParams,
  );

  // Payments received against invoices (from payment_applications for accuracy)
  const payParams: any[] = [filters.tenantSlug];
  let payWhere = `i.tenant_slug = $1 and i.status <> 'void'`;
  if (filters.periodEnd) {
    payParams.push(filters.periodEnd);
    payWhere += ` and pa.created_at <= $${payParams.length}::date + interval '1 day'`;
  }
  const payStartIdx = filters.periodStart ? (payParams.push(filters.periodStart), payParams.length) : 0;
  const { rows: payRows } = await db.query(
    `select coalesce(i.customer_id::text, i.customer_code, i.customer_name) party_key,
            sum(pa.amount) total_paid,
            sum(case when ${payStartIdx ? `pa.created_at < $${payStartIdx}::date` : "false"} then pa.amount else 0 end) opening_paid
     from payment_applications pa
     join finance_invoices i on i.id = pa.invoice_id
     where ${payWhere}
     group by 1`,
    payParams,
  );
  const paidByParty = new Map((payRows as any[]).map((r) => [r.party_key, r]));

  const report: LedgerSummaryReport = {
    kind: "customer",
    rows: [],
    totals: { opening: 0, invoiced: 0, paid: 0, closing: 0 },
  };

  for (const r of rows as any[]) {
    const pay = paidByParty.get(r.party_key);
    const opening = Number(r.opening_invoiced) - Number(pay?.opening_paid ?? 0);
    const invoiced = Number(r.period_invoiced);
    const paid = Number(pay?.total_paid ?? 0) - Number(pay?.opening_paid ?? 0);
    const row: LedgerSummaryRow = {
      partyId: r.party_key,
      party: r.party,
      opening,
      invoiced,
      paid,
      closing: opening + invoiced - paid,
    };
    report.rows.push(row);
    report.totals.opening += row.opening;
    report.totals.invoiced += row.invoiced;
    report.totals.paid += row.paid;
    report.totals.closing += row.closing;
  }
  report.rows.sort((a, b) => a.party.localeCompare(b.party));
  return report;
}

export async function generateSupplierLedgerSummary(
  filters: ReportFilters,
): Promise<LedgerSummaryReport> {
  const billParams: any[] = [filters.tenantSlug];
  let billWhere = `b.tenant_slug = $1 and b.status <> 'cancelled' and b.status <> 'void'`;
  if (filters.periodEnd) {
    billParams.push(filters.periodEnd);
    billWhere += ` and b.bill_date <= $${billParams.length}`;
  }
  billWhere += branchFilter(filters, billParams, "b.branch_id");
  const startIdx = filters.periodStart ? (billParams.push(filters.periodStart), billParams.length) : 0;

  const { rows } = await db.query(
    `select b.vendor_id::text party_key,
            coalesce(v.display_name, v.legal_name, b.vendor_id::text) party,
            sum(b.total) total_billed,
            sum(case when ${startIdx ? `b.bill_date < $${startIdx}` : "false"} then b.total else 0 end) opening_billed,
            sum(case when ${startIdx ? `b.bill_date >= $${startIdx}` : "true"} then b.total else 0 end) period_billed
     from bills b
     left join vendors v on v.id = b.vendor_id::text
     where ${billWhere}
     group by 1, 2`,
    billParams,
  );

  const payParams: any[] = [filters.tenantSlug];
  let payWhere = `vp.tenant_slug = $1`;
  if (filters.periodEnd) {
    payParams.push(filters.periodEnd);
    payWhere += ` and vp.payment_date <= $${payParams.length}`;
  }
  const payStartIdx = filters.periodStart ? (payParams.push(filters.periodStart), payParams.length) : 0;
  const { rows: payRows } = await db.query(
    `select vp.vendor_id::text party_key,
            sum(vp.applied_amount) total_paid,
            sum(case when ${payStartIdx ? `vp.payment_date < $${payStartIdx}` : "false"} then vp.applied_amount else 0 end) opening_paid
     from vendor_payments vp
     where ${payWhere}
     group by 1`,
    payParams,
  );
  const paidByParty = new Map((payRows as any[]).map((r) => [r.party_key, r]));

  const report: LedgerSummaryReport = {
    kind: "supplier",
    rows: [],
    totals: { opening: 0, invoiced: 0, paid: 0, closing: 0 },
  };

  for (const r of rows as any[]) {
    const pay = paidByParty.get(r.party_key);
    const opening = Number(r.opening_billed) - Number(pay?.opening_paid ?? 0);
    const invoiced = Number(r.period_billed);
    const paid = Number(pay?.total_paid ?? 0) - Number(pay?.opening_paid ?? 0);
    const row: LedgerSummaryRow = {
      partyId: r.party_key,
      party: r.party,
      opening,
      invoiced,
      paid,
      closing: opening + invoiced - paid,
    };
    report.rows.push(row);
    report.totals.opening += row.opening;
    report.totals.invoiced += row.invoiced;
    report.totals.paid += row.paid;
    report.totals.closing += row.closing;
  }
  report.rows.sort((a, b) => a.party.localeCompare(b.party));
  return report;
}

export function generateLedgerSummaryCSV(report: LedgerSummaryReport): string {
  const partyLabel = report.kind === "customer" ? "Customer" : "Supplier";
  const headers = [partyLabel, "Opening", "Invoiced", "Paid", "Closing"];
  const rows = report.rows.map((r) => [
    r.party,
    r.opening.toFixed(2),
    r.invoiced.toFixed(2),
    r.paid.toFixed(2),
    r.closing.toFixed(2),
  ]);
  rows.push(["TOTAL", report.totals.opening.toFixed(2), report.totals.invoiced.toFixed(2), report.totals.paid.toFixed(2), report.totals.closing.toFixed(2)]);
  return toCsv(rows, headers);
}

// ─── Saved Reports ──────────────────────────────────────────────────────────

export interface SavedReport {
  id: string;
  tenantSlug: string;
  name: string;
  reportKey: string;
  config: Record<string, any>;
  createdBy: string | null;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function ensureSavedReportTables(): Promise<void> {
  await db.query(`
    create table if not exists saved_reports (
      id uuid primary key default gen_random_uuid(),
      tenant_slug text not null,
      name text not null,
      report_key text not null,
      config jsonb not null default '{}'::jsonb,
      created_by text,
      is_shared boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (tenant_slug, name, report_key)
    )
  `);
}

function toSavedReport(r: any): SavedReport {
  return {
    id: r.id,
    tenantSlug: r.tenant_slug,
    name: r.name,
    reportKey: r.report_key,
    config: typeof r.config === "string" ? JSON.parse(r.config) : (r.config ?? {}),
    createdBy: r.created_by,
    isShared: Boolean(r.is_shared),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listSavedReports(
  tenantSlug: string,
  reportKey?: string,
): Promise<SavedReport[]> {
  await ensureSavedReportTables();
  const { rows } = reportKey
    ? await db.query(
        `select * from saved_reports where tenant_slug = $1 and report_key = $2 order by name`,
        [tenantSlug, reportKey],
      )
    : await db.query(
        `select * from saved_reports where tenant_slug = $1 order by report_key, name`,
        [tenantSlug],
      );
  return (rows as any[]).map(toSavedReport);
}

export async function createSavedReport(input: {
  tenantSlug: string;
  name: string;
  reportKey: string;
  config: Record<string, any>;
  createdBy?: string;
  isShared?: boolean;
}): Promise<SavedReport> {
  await ensureSavedReportTables();
  const { rows } = await db.query(
    `insert into saved_reports (id, tenant_slug, name, report_key, config, created_by, is_shared)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (tenant_slug, name, report_key)
     do update set config = excluded.config, is_shared = excluded.is_shared, updated_at = now()
     returning *`,
    [
      randomUUID(),
      input.tenantSlug,
      input.name.trim(),
      input.reportKey,
      JSON.stringify(input.config ?? {}),
      input.createdBy ?? null,
      input.isShared ?? false,
    ],
  );
  return toSavedReport((rows as any[])[0]);
}

export async function updateSavedReport(
  id: string,
  tenantSlug: string,
  updates: { name?: string; config?: Record<string, any>; isShared?: boolean },
): Promise<SavedReport | null> {
  await ensureSavedReportTables();
  const sets: string[] = ["updated_at = now()"];
  const params: any[] = [id, tenantSlug];
  if (updates.name !== undefined) {
    params.push(updates.name.trim());
    sets.push(`name = $${params.length}`);
  }
  if (updates.config !== undefined) {
    params.push(JSON.stringify(updates.config));
    sets.push(`config = $${params.length}`);
  }
  if (updates.isShared !== undefined) {
    params.push(updates.isShared);
    sets.push(`is_shared = $${params.length}`);
  }
  const { rows } = await db.query(
    `update saved_reports set ${sets.join(", ")} where id = $1 and tenant_slug = $2 returning *`,
    params,
  );
  return (rows as any[])[0] ? toSavedReport((rows as any[])[0]) : null;
}

export async function deleteSavedReport(id: string, tenantSlug: string): Promise<boolean> {
  await ensureSavedReportTables();
  const { rowCount } = await db.query(
    `delete from saved_reports where id = $1 and tenant_slug = $2`,
    [id, tenantSlug],
  );
  return (rowCount ?? 0) > 0;
}
