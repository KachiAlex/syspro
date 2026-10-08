import { sql as SQL } from "../sql-client";

export interface ReportDataset {
  columns: string[];
  rows: any[][];
}

/**
 * Executes a report definition against live tenant data and returns a
 * tabular dataset. Module is read from definition.module (set by the
 * generate endpoint); report_type selects the query within the module.
 */
export async function executeReport(
  tenantSlug: string,
  report: { reportType?: string; report_type?: string; definition?: any; filters?: any }
): Promise<ReportDataset> {
  const definition = report.definition ?? {};
  const moduleKey = String(definition.module ?? report.reportType ?? report.report_type ?? "").toLowerCase();
  const type = String(report.reportType ?? report.report_type ?? definition.reportType ?? "summary").toLowerCase();

  switch (moduleKey) {
    case "finance":
      return financeDataset(tenantSlug, type);
    case "crm":
      return crmDataset(tenantSlug, type);
    case "people":
    case "hr":
      return peopleDataset(tenantSlug, type);
    case "sales":
      return salesDataset(tenantSlug);
    case "itsupport":
    case "support":
      return supportDataset(tenantSlug, type);
    case "inventory":
      return inventoryDataset(tenantSlug);
    default:
      return genericDataset(tenantSlug);
  }
}

async function genericDataset(tenantSlug: string): Promise<ReportDataset> {
  const sql = SQL;
  const rows = (await sql`
    select 'employees' as metric, count(*)::text as value from admin_employees where tenant_slug = ${tenantSlug}
    union all select 'crm leads', count(*)::text from crm_leads where tenant_slug = ${tenantSlug}
    union all select 'crm deals', count(*)::text from crm_deals where tenant_slug = ${tenantSlug}
    union all select 'invoices', count(*)::text from finance_invoices where tenant_slug = ${tenantSlug}
    union all select 'support tickets', count(*)::text from support_tickets where tenant_slug = ${tenantSlug}
  `) as any[];
  return { columns: ["metric", "value"], rows: rows.map((m: any) => [m.metric, m.value]) };
}

async function financeDataset(tenantSlug: string, type: string): Promise<ReportDataset> {
  const sql = SQL;
  if (type.includes("receivable") || type.includes("invoice")) {
    const rows = (await sql`
      select invoice_number, customer_name, status, amount::text, balance_due::text, issued_date::text, due_date::text
      from finance_invoices where tenant_slug = ${tenantSlug}
      order by issued_date desc limit 500
    `) as any[];
    return { columns: ["invoice_number", "customer", "status", "amount", "balance_due", "issued", "due"], rows: rows.map((r) => [r.invoice_number, r.customer_name, r.status, r.amount, r.balance_due, r.issued_date, r.due_date]) };
  }
  if (type.includes("payable") || type.includes("bill")) {
    const rows = (await sql`
      select b.bill_number, v.name as vendor, b.status, b.total::text, b.balance_due::text, b.bill_date::text, b.due_date::text
      from bills b left join vendors v on v.id = b.vendor_id and v.tenant_slug = b.tenant_slug
      where b.tenant_slug = ${tenantSlug}
      order by b.bill_date desc limit 500
    `) as any[];
    return { columns: ["bill_number", "vendor", "status", "total", "balance_due", "bill_date", "due"], rows: rows.map((r) => [r.bill_number, r.vendor, r.status, r.total, r.balance_due, r.bill_date, r.due_date]) };
  }
  const [row] = (await sql`
    select
      (select coalesce(sum(amount),0)::text from finance_invoices where tenant_slug = ${tenantSlug} and status != 'void') as invoiced,
      (select coalesce(sum(balance_due),0)::text from finance_invoices where tenant_slug = ${tenantSlug}) as receivable,
      (select coalesce(sum(total),0)::text from bills where tenant_slug = ${tenantSlug}) as billed,
      (select coalesce(sum(balance_due),0)::text from bills where tenant_slug = ${tenantSlug}) as payable
  `) as any[];
  return {
    columns: ["metric", "value"],
    rows: [["invoiced_total", row.invoiced], ["receivable_open", row.receivable], ["billed_total", row.billed], ["payable_open", row.payable]],
  };
}

async function crmDataset(tenantSlug: string, type: string): Promise<ReportDataset> {
  const sql = SQL;
  if (type.includes("deal") || type.includes("pipeline")) {
    const rows = (await sql`
      select name, stage, status, value::text, currency, expected_close::text, created_at::text
      from crm_deals where tenant_slug = ${tenantSlug} order by created_at desc limit 500
    `) as any[];
    return { columns: ["deal", "stage", "status", "value", "currency", "expected_close", "created"], rows: rows.map((r) => [r.name, r.stage, r.status, r.value, r.currency, r.expected_close, r.created_at]) };
  }
  const rows = (await sql`
    select company_name, contact_name, contact_email, stage, source, score::text, created_at::text
    from crm_leads where tenant_slug = ${tenantSlug} order by created_at desc limit 500
  `) as any[];
  return { columns: ["company", "contact", "email", "stage", "source", "score", "created"], rows: rows.map((r) => [r.company_name, r.contact_name, r.contact_email, r.stage, r.source, r.score, r.created_at]) };
}

async function peopleDataset(tenantSlug: string, type: string): Promise<ReportDataset> {
  const sql = SQL;
  if (type.includes("attendance")) {
    const rows = (await sql`
      select work_date::text, attendance_status, count(*)::text
      from attendance_records where tenant_id = ${tenantSlug}
      group by work_date, attendance_status order by work_date desc limit 500
    `) as any[];
    return { columns: ["date", "status", "count"], rows: rows.map((r) => [r.work_date, r.attendance_status, r.count]) };
  }
  const rows = (await sql`
    select name, email, status, job_title, department_id::text
    from admin_employees where tenant_slug = ${tenantSlug} order by created_at desc limit 500
  `) as any[];
  return { columns: ["name", "email", "status", "job_title", "department_id"], rows: rows.map((r) => [r.name, r.email, r.status, r.job_title, r.department_id]) };
}

async function salesDataset(tenantSlug: string): Promise<ReportDataset> {
  const sql = SQL;
  const rows = (await sql`
    select order_number, customer_name, status, total::text, order_date::text
    from sales_orders where tenant_slug = ${tenantSlug} order by order_date desc limit 500
  `) as any[];
  return { columns: ["order", "customer", "status", "total", "date"], rows: rows.map((r) => [r.order_number, r.customer_name, r.status, r.total, r.order_date]) };
}

async function supportDataset(tenantSlug: string, type: string): Promise<ReportDataset> {
  const sql = SQL;
  const rows = (await sql`
    select status, priority, count(*)::text from support_tickets
    where tenant_slug = ${tenantSlug} group by status, priority order by status, priority
  `) as any[];
  return { columns: ["status", "priority", "count"], rows: rows.map((r) => [r.status, r.priority, r.count]) };
}

async function inventoryDataset(tenantSlug: string): Promise<ReportDataset> {
  const sql = SQL;
  const rows = (await sql`
    select sku, name, category, current_stock::text, unit_cost::text, (current_stock * unit_cost)::text as value
    from inventory_products where tenant_slug = ${tenantSlug} order by category, name limit 500
  `) as any[];
  return { columns: ["sku", "name", "category", "stock", "unit_cost", "value"], rows: rows.map((r) => [r.sku, r.name, r.category, r.current_stock, r.unit_cost, r.value]) };
}

export function datasetToCsv(ds: ReportDataset): string {
  const esc = (v: any) => JSON.stringify(v == null ? "" : String(v));
  return [ds.columns.map(esc).join(","), ...ds.rows.map((r) => r.map(esc).join(","))].join("\n");
}
