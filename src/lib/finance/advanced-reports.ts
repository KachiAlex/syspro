import { db } from "@/lib/sql-client";
import { ensureGLTables } from "./gl";

// ---------------------------------------------------------------------------
// Advanced accounting reports (ERPNext report parity, Tranche A).
// All read the canonical GL + subledger tables, tenant_slug scoped.
// ---------------------------------------------------------------------------

export interface AdvReportFilter {
  tenantSlug: string;
  periodStart?: string;
  periodEnd?: string;
  asOfDate?: string;
  branchId?: string;
  financeBook?: string;
}

function esc(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function rowsToCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

function rangeClause(f: AdvReportFilter, col: string, params: any[], open = true) {
  let c = "";
  if (f.periodStart) { params.push(f.periodStart); c += ` and ${col} >= $${params.length}`; }
  if (f.periodEnd) { params.push(f.periodEnd); c += ` and ${col} <= $${params.length}`; }
  if (!open && f.asOfDate) { params.push(f.asOfDate); c += ` and ${col} <= $${params.length}`; }
  return c;
}
function bookClause(f: AdvReportFilter, col: string, params: any[]) {
  if (!f.financeBook) return "";
  params.push(f.financeBook);
  return ` and ${col} = $${params.length}`;
}

// ─── Financial Ratios ───────────────────────────────────────────────────────

export async function financialRatios(f: AdvReportFilter) {
  await ensureGLTables();
  const params: any[] = [f.tenantSlug];
  const where = `e.tenant_slug = $1${rangeClause(f, "e.posting_date", params, false)}${bookClause(f, "e.finance_book", params)}`;
  const { rows } = await db.query(
    `select
       sum(case when a.account_type = 'ASSET' then l.debit - l.credit else 0 end) assets,
       sum(case when a.account_type = 'ASSET' and (a.account_code like '10%' or a.account_code like '11%' or a.account_code like '12%') then l.debit - l.credit else 0 end) current_assets,
       sum(case when a.account_type = 'ASSET' and a.account_code in ('1300','1400','1500') then l.debit - l.credit else 0 end) inventory,
       sum(case when a.account_type = 'ASSET' and a.account_code = '1200' then l.debit - l.credit else 0 end) receivables,
       sum(case when a.account_type = 'LIABILITY' then l.credit - l.debit else 0 end) liabilities,
       sum(case when a.account_type = 'LIABILITY' and a.account_code like '2%' then l.credit - l.debit else 0 end) current_liabilities,
       sum(case when a.account_type = 'EQUITY' then l.credit - l.debit else 0 end) equity,
       sum(case when a.account_type in ('INCOME','REVENUE') then l.credit - l.debit else 0 end) revenue,
       sum(case when a.account_type = 'EXPENSE' and a.account_code = '5000' then l.debit - l.credit else 0 end) cogs,
       sum(case when a.account_type = 'EXPENSE' then l.debit - l.credit else 0 end) expenses
     from journal_entry_lines l
     join journal_entries e on e.id = l.entry_id
     join chart_of_accounts a on a.id = l.account_id
     where ${where} and e.status = 'posted'`,
    params,
  );
  const r = rows[0] ?? {};
  const g = (k: string) => Number(r[k] ?? 0);
  const ca = g("current_assets"), cl = g("current_liabilities");
  const rev = g("revenue"), cogs = g("cogs"), assets = g("assets"), eq = g("equity");
  const gp = rev - cogs, ni = rev - g("expenses");
  return {
    liquidity: {
      currentRatio: cl ? ca / cl : null,
      quickRatio: cl ? (ca - g("inventory")) / cl : null,
      cashRatio: null as number | null, // cash+equivalents subset unavailable w/o account groups
    },
    leverage: {
      debtToEquity: eq ? g("liabilities") / eq : null,
      debtRatio: assets ? g("liabilities") / assets : null,
      equityRatio: assets ? eq / assets : null,
    },
    profitability: {
      grossMarginPct: rev ? (gp / rev) * 100 : null,
      netMarginPct: rev ? (ni / rev) * 100 : null,
      returnOnAssetsPct: assets ? (ni / assets) * 100 : null,
      returnOnEquityPct: eq ? (ni / eq) * 100 : null,
    },
    efficiency: {
      assetTurnover: assets ? rev / assets : null,
      receivablesTurnover: g("receivables") ? rev / g("receivables") : null,
    },
    raw: { assets, liabilities: g("liabilities"), equity: eq, revenue: rev, cogs, expenses: g("expenses") },
  };
}

// ─── Gross Profit ───────────────────────────────────────────────────────────

export async function grossProfit(f: AdvReportFilter) {
  const params: any[] = [f.tenantSlug];
  let where = `i.tenant_slug = $1 and i.status <> 'void'`;
  where += rangeClause(f, "i.issued_date", params);
  const { rows } = await db.query(
    `select i.invoice_number, i.issued_date::text, i.customer_name,
            l.description, l.quantity, l.unit_price, l.amount,
            p.sku, p.unit_cost,
            (l.amount - l.quantity * coalesce(p.unit_cost, 0)) gross_profit,
            case when l.amount > 0 then (l.amount - l.quantity * coalesce(p.unit_cost,0)) / l.amount * 100 else 0 end margin_pct
     from finance_invoices i
     join finance_invoice_lines l on l.invoice_id = i.id
     left join inventory_products p
       on p.tenant_slug = i.tenant_slug and (p.sku = l.description or p.name = l.description)
     where ${where}
     order by i.issued_date desc, i.invoice_number`,
    params,
  );
  const totals = (rows as any[]).reduce(
    (t, r) => ({
      sales: t.sales + Number(r.amount),
      cost: t.cost + Number(r.quantity) * Number(r.unit_cost ?? 0),
      profit: t.profit + Number(r.gross_profit),
    }),
    { sales: 0, cost: 0, profit: 0 },
  );
  return { rows, totals, note: "Cost matched to inventory_products.unit_cost by SKU/name on the line description." };
}

// ─── Trial Balance for Party ────────────────────────────────────────────────

export async function trialBalanceForParty(f: AdvReportFilter) {
  await ensureGLTables();
  const params: any[] = [f.tenantSlug];
  const where = `e.tenant_slug = $1 and l.party_id is not null${rangeClause(f, "e.posting_date", params, false)}${bookClause(f, "e.finance_book", params)}`;
  const { rows } = await db.query(
    `select l.party_type, l.party_id, l.account_code, l.account_name,
            sum(l.debit) debit, sum(l.credit) credit, sum(l.debit - l.credit) balance
     from journal_entry_lines l
     join journal_entries e on e.id = l.entry_id
     where ${where} and e.status = 'posted'
     group by l.party_type, l.party_id, l.account_code, l.account_name
     order by l.party_type, l.party_id, l.account_code`,
    params,
  );
  return rows;
}

// ─── Voucher-wise Balance ───────────────────────────────────────────────────

export async function voucherWiseBalance(f: AdvReportFilter) {
  await ensureGLTables();
  const params: any[] = [f.tenantSlug];
  const where = `e.tenant_slug = $1${rangeClause(f, "e.posting_date", params)}${bookClause(f, "e.finance_book", params)}`;
  const { rows } = await db.query(
    `select e.reference_type voucher_type, coalesce(e.reference_id, e.journal_number) voucher_no,
            l.account_code, l.account_name,
            sum(l.debit) debit, sum(l.credit) credit, sum(l.debit - l.credit) balance
     from journal_entry_lines l
     join journal_entries e on e.id = l.entry_id
     where ${where} and e.status = 'posted'
     group by e.reference_type, coalesce(e.reference_id, e.journal_number), l.account_code, l.account_name
     order by voucher_type, voucher_no, l.account_code`,
    params,
  );
  return rows;
}

// ─── Dimension-wise Accounts Balance ────────────────────────────────────────

export async function dimensionWiseBalance(f: AdvReportFilter & { dimension?: string }) {
  await ensureGLTables();
  const dim = (f.dimension ?? "branch").toLowerCase();
  const builtin: Record<string, string> = {
    branch: "l.branch_id", cost_center: "l.cost_center_id",
    department: "l.department_id", project: "l.project_id",
  };
  const col = builtin[dim] ?? `l.dimensions->>'${dim.replace(/[^a-z0-9_]/g, "")}'`;
  const params: any[] = [f.tenantSlug];
  const where = `e.tenant_slug = $1${rangeClause(f, "e.posting_date", params, false)}${bookClause(f, "e.finance_book", params)}`;
  const { rows } = await db.query(
    `select coalesce(${col}, '(none)') dimension_value, a.account_type,
            l.account_code, l.account_name,
            sum(l.debit) debit, sum(l.credit) credit, sum(l.debit - l.credit) balance
     from journal_entry_lines l
     join journal_entries e on e.id = l.entry_id
     join chart_of_accounts a on a.id = l.account_id
     where ${where} and e.status = 'posted'
     group by 1, a.account_type, l.account_code, l.account_name
     order by 1, a.account_type, l.account_code`,
    params,
  );
  return rows;
}

// ─── Invoice Trends ─────────────────────────────────────────────────────────

export async function invoiceTrends(f: AdvReportFilter & { kind: "sales" | "purchase"; granularity?: "monthly" | "quarterly" | "weekly" }) {
  const isSales = f.kind === "sales";
  const table = isSales ? "finance_invoices" : "bills";
  const dateCol = isSales ? "issued_date" : "bill_date";
  const totalCol = isSales ? "amount" : "total";
  const partyCol = isSales ? "customer_name" : "vendor_id::text";
  const bucket = f.granularity === "quarterly" ? "quarter" : f.granularity === "weekly" ? "week" : "month";
  const params: any[] = [f.tenantSlug];
  const where = `tenant_slug = $1 and status <> 'void'${rangeClause(f, `${dateCol}::date`, params)}`;
  const { rows } = await db.query(
    `select date_trunc('${bucket}', ${dateCol}::date)::text bucket,
            count(*) documents, count(distinct ${partyCol}) parties,
            sum(${totalCol}) total
     from ${table}
     where ${where}
     group by 1 order by 1`,
    params,
  );
  return rows;
}

// ─── Sales Payment Summary ──────────────────────────────────────────────────

export async function salesPaymentSummary(f: AdvReportFilter) {
  const params: any[] = [f.tenantSlug];
  const where = `p.tenant_slug = $1${rangeClause(f, "p.payment_date", params)}`;
  const { rows } = await db.query(
    `select p.method, count(*) payments, sum(p.net_amount) amount
     from finance_payments p
     where ${where}
     group by p.method order by amount desc`,
    params,
  ).catch(() => ({ rows: [] as any[] }));
  const rparams: any[] = [f.tenantSlug];
  const rwhere = `tenant_slug = $1 and direction = 'sales' and status <> 'cancelled'${rangeClause(f, "created_at::date", rparams)}`;
  const { rows: ret } = await db.query(
    `select count(*) returns, sum(total_amount) returned_amount from finance_returns where ${rwhere}`,
    rparams,
  ).catch(() => ({ rows: [{ returns: 0, returned_amount: 0 }] }));
  return { byMethod: rows, returns: ret[0] };
}

// ─── Bank Reconciliation Statement ──────────────────────────────────────────

export async function bankReconciliationStatement(f: AdvReportFilter & { accountCode?: string }) {
  await ensureGLTables();
  const params: any[] = [f.tenantSlug];
  let where = `e.tenant_slug = $1 and a.account_type = 'ASSET' and a.account_code like '1%'`;
  if (f.accountCode) { params.push(f.accountCode); where += ` and a.account_code = $${params.length}`; }
  if (f.asOfDate) { params.push(f.asOfDate); where += ` and e.posting_date <= $${params.length}`; }
  const { rows } = await db.query(
    `select a.account_code, a.account_name,
            sum(l.debit - l.credit) book_balance,
            sum(case when s.reconciled_at is not null then l.debit - l.credit else 0 end) reconciled_balance
     from journal_entry_lines l
     join journal_entries e on e.id = l.entry_id
     join chart_of_accounts a on a.id = l.account_id
     left join reconciliation_items s on s.book_entry_id in (l.id::text, e.id::text) and s.is_reconciled
     where ${where} and e.status = 'posted'
     group by a.account_code, a.account_name
     order by a.account_code`,
    params,
  ).catch(() => ({ rows: [] as any[] }));
  return rows;
}

// ─── Billed Items To Be Received (inverse of GRNI) ─────────────────────────

export async function billedItemsToBeReceived(f: AdvReportFilter) {
  const params: any[] = [f.tenantSlug];
  let where = `b.tenant_slug = $1 and b.po_id is not null and b.status <> 'void'`;
  where += rangeClause(f, "b.bill_date", params);
  const { rows } = await db.query(
    `select po.id po_id, coalesce(po.po_number, po.order_number) po_number,
            po.supplier_name, i.description,
            sum(bi.quantity) billed_qty,
            coalesce(i.received_quantity, 0) received_qty,
            sum(bi.quantity) - coalesce(i.received_quantity,0) pending_qty,
            sum(bi.line_amount) billed_value
     from bills b
     join bill_items bi on bi.bill_id = b.id
     join purchase_orders po on po.id::text = b.po_id::text and po.tenant_slug = b.tenant_slug
     left join purchase_order_items i
       on coalesce(i.purchase_order_id, i.po_id) = po.id
      and (i.description = bi.description or i.sku = bi.description)
     where ${where}
     group by po.id, po.po_number, po.order_number, po.supplier_name, i.description, i.received_quantity
     having sum(bi.quantity) - coalesce(i.received_quantity,0) > 0
     order by po_number`,
    params,
  );
  return rows;
}

// ─── Payment Period Based On Invoice Date ───────────────────────────────────

export async function paymentPeriodByInvoiceDate(f: AdvReportFilter) {
  const params: any[] = [f.tenantSlug];
  const where = `i.tenant_slug = $1 and i.status <> 'void'${rangeClause(f, "i.issued_date", params)}`;
  const { rows } = await db.query(
    `select i.invoice_number, i.issued_date::text, i.customer_name, i.amount,
            pa.applied_amount, p.payment_date::text,
            (p.payment_date - i.issued_date::date) days_to_pay
     from finance_invoices i
     join payment_applications pa on pa.invoice_id = i.id and pa.tenant_slug = i.tenant_slug
     join finance_payments p on p.id = pa.payment_id
     where ${where}
     order by days_to_pay desc`,
    params,
  );
  const arr = rows as any[];
  const avg = arr.length ? arr.reduce((s, r) => s + Number(r.days_to_pay), 0) / arr.length : null;
  return { rows: arr, averageDaysToPay: avg };
}

// ─── POS Register ───────────────────────────────────────────────────────────

export async function posRegister(f: AdvReportFilter) {
  const params: any[] = [f.tenantSlug];
  let where = `tenant_slug = $1 and status = 'completed'`;
  where += rangeClause(f, "created_at::date", params);
  const { rows } = await db.query(
    `select receipt_no, created_at::text, customer_name, payment_method,
            net_amount, tax_amount, total_amount, discount_amount,
            shift_id, register_id, created_by
     from pos_sales
     where ${where}
     order by created_at desc`,
    params,
  ).catch(() => ({ rows: [] as any[] }));
  const totals = (rows as any[]).reduce(
    (t, r) => ({
      net: t.net + Number(r.net_amount), tax: t.tax + Number(r.tax_amount),
      total: t.total + Number(r.total_amount), count: t.count + 1,
    }),
    { net: 0, tax: 0, total: 0, count: 0 },
  );
  return { rows, totals };
}

// ─── Inactive Sales Items ───────────────────────────────────────────────────

export async function inactiveSalesItems(f: AdvReportFilter) {
  const params: any[] = [f.tenantSlug, f.periodStart ?? "1900-01-01", f.periodEnd ?? "2100-01-01"];
  const { rows } = await db.query(
    `select p.sku, p.name, p.category, p.current_stock, p.unit_cost, p.sale_price,
            max(i.issued_date::date)::text last_sale_date
     from inventory_products p
     left join finance_invoice_lines l
       on (l.description = p.sku or l.description = p.name)
      and exists (
        select 1 from finance_invoices i2
        where i2.id = l.invoice_id and i2.tenant_slug = p.tenant_slug and i2.status <> 'void'
      )
     left join finance_invoices i on i.id = l.invoice_id and i.tenant_slug = p.tenant_slug
       and i.issued_date::date between $2::date and $3::date
     where p.tenant_slug = $1
     group by p.sku, p.name, p.category, p.current_stock, p.unit_cost, p.sale_price
     having max(i.issued_date::date) is null
     order by p.name`,
    params,
  );
  return rows;
}

// ─── Invalid Ledger Entries (health report) ────────────────────────────────

export async function invalidLedgerEntries(f: AdvReportFilter) {
  await ensureGLTables();
  const params: any[] = [f.tenantSlug];
  const checks: Record<string, { rows: any[] }> = {};

  checks.linesWithoutAccount = await db.query(
    `select l.id, e.journal_number, e.posting_date::text, l.line_number
     from journal_entry_lines l join journal_entries e on e.id = l.entry_id
     where e.tenant_slug = $1 and l.account_id is null`,
    params,
  );
  checks.unbalancedEntries = await db.query(
    `select e.id, e.journal_number, e.posting_date::text,
            sum(l.debit) debits, sum(l.credit) credits
     from journal_entries e join journal_entry_lines l on l.entry_id = e.id
     where e.tenant_slug = $1 and e.status = 'posted'
     group by e.id, e.journal_number, e.posting_date
     having abs(sum(l.debit) - sum(l.credit)) > 0.01`,
    params,
  );
  checks.entriesWithoutLines = await db.query(
    `select e.id, e.journal_number, e.posting_date::text
     from journal_entries e
     where e.tenant_slug = $1
       and not exists (select 1 from journal_entry_lines l where l.entry_id = e.id)`,
    params,
  );
  checks.negativeAmounts = await db.query(
    `select l.id, e.journal_number, l.line_number, l.debit, l.credit
     from journal_entry_lines l join journal_entries e on e.id = l.entry_id
     where e.tenant_slug = $1 and (l.debit < 0 or l.credit < 0)`,
    params,
  );
  checks.duplicateJournalNumbers = await db.query(
    `select journal_number, count(*) n from journal_entries
     where tenant_slug = $1 group by journal_number having count(*) > 1`,
    params,
  );
  const out: Record<string, any[]> = {};
  for (const [k, v] of Object.entries(checks)) out[k] = v.rows;
  return out;
}

// ─── Custom Financial Statement (user-defined report templates) ─────────────

export interface FinancialStatementTemplate {
  id: string;
  name: string;
  rows: Array<{
    label: string;
    /** account code prefixes, e.g. ["11","12"] or ["4000","4100"] */
    include: string[];
    /** 'debit-credit' (assets/expenses) or 'credit-debit' (liab/equity/income) */
    sign: "debit-credit" | "credit-debit";
    indent?: number;
    isSubtotal?: boolean;
  }>;
}

export async function customFinancialStatement(
  f: AdvReportFilter,
  template: FinancialStatementTemplate["rows"],
) {
  await ensureGLTables();
  const params: any[] = [f.tenantSlug];
  const where = `e.tenant_slug = $1${rangeClause(f, "e.posting_date", params, false)}${bookClause(f, "e.finance_book", params)}`;
  const { rows } = await db.query(
    `select l.account_code, sum(l.debit) debit, sum(l.credit) credit
     from journal_entry_lines l
     join journal_entries e on e.id = l.entry_id
     where ${where} and e.status = 'posted'
     group by l.account_code`,
    params,
  );
  const byCode = rows as any[];
  return template.map((row) => {
    const matched = byCode.filter((a) => row.include.some((p) => String(a.account_code).startsWith(p)));
    const debit = matched.reduce((s, a) => s + Number(a.debit), 0);
    const credit = matched.reduce((s, a) => s + Number(a.credit), 0);
    return {
      label: row.label,
      indent: row.indent ?? 0,
      isSubtotal: Boolean(row.isSubtotal),
      amount: row.sign === "credit-debit" ? credit - debit : debit - credit,
      debit, credit,
    };
  });
}
