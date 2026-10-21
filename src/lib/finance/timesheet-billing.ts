import { sql as SQL } from "../sql-client";
import { insertFinanceInvoice } from "./db";
import { ensureOnce } from "@/lib/ensure-once";

export function ensureTimesheetBillingColumns(...args: Parameters<typeof ensureColsRun>) {
  return ensureOnce("finance/timesheet-billing:ensureCols", () => ensureColsRun(...args));
}

async function ensureColsRun(sql = SQL) {
  await sql`alter table if exists time_logs add column if not exists invoice_id text`;
  await sql`alter table if exists projects add column if not exists customer_name text`;
  await sql`alter table if exists projects add column if not exists customer_id text`;
  await sql`alter table if exists projects add column if not exists billing_rate numeric`;
}

export interface BillableProjectSummary {
  projectId: string;
  projectName: string;
  customerName: string | null;
  billingRate: number | null;
  totalHours: number;
  entries: number;
  periodStart: string;
  periodEnd: string;
}

/**
 * Billable, approved, not-yet-invoiced time — grouped by project.
 */
export async function billableTimeSummary(
  tenantSlug: string,
  opts: { projectId?: string; to?: string } = {}
): Promise<BillableProjectSummary[]> {
  const sql = SQL;
  await ensureTimesheetBillingColumns(sql);
  const rows = (await sql`
    select tl.project_id,
           coalesce(p.name, tl.project_id::text) as project_name,
           p.customer_name, p.billing_rate,
           sum(tl.hours_logged) as hours,
           count(*)::int as entries,
           min(tl.log_date) as period_start,
           max(tl.log_date) as period_end
    from time_logs tl
    left join projects p on p.id = tl.project_id
    where tl.tenant_slug = ${tenantSlug}
      and tl.billable = true
      and tl.invoice_id is null
      and lower(coalesce(tl.approval_status, 'APPROVED')) in ('approved','submitted')
      and (${opts.projectId ?? null}::uuid is null or tl.project_id = ${opts.projectId ?? null}::uuid)
      and (${opts.to ?? null}::date is null or tl.log_date <= ${opts.to ?? null}::date)
    group by tl.project_id, p.name, p.customer_name, p.billing_rate
    order by project_name
  `) as any[];
  return rows.map((r) => ({
    projectId: r.project_id,
    projectName: r.project_name,
    customerName: r.customer_name,
    billingRate: r.billing_rate == null ? null : Number(r.billing_rate),
    totalHours: Number(r.hours),
    entries: r.entries,
    periodStart: String(r.period_start).slice(0, 10),
    periodEnd: String(r.period_end).slice(0, 10),
  }));
}

/**
 * Generate a sales invoice for all uninvoiced billable time on a project.
 * Rate resolution: explicit `rate` arg → project.billing_rate → error.
 * Marks each time_log with the generated invoice id so it can't be billed twice.
 */
export async function generateTimesheetInvoice(
  tenantSlug: string,
  input: {
    projectId: string;
    rate?: number;
    customerName?: string;
    customerCode?: string;
    issuedDate?: string;
    dueDate?: string;
    currency?: string;
  }
): Promise<{ invoiceId: string; invoiceNumber: string; hours: number; amount: number }> {
  const sql = SQL;
  await ensureTimesheetBillingColumns(sql);

  const project = (await sql`
    select id, name, customer_name, customer_id, billing_rate
    from projects where id = ${input.projectId}::uuid and tenant_slug = ${tenantSlug}
  `) as any[];
  const proj = project[0];
  if (!proj) throw new Error(`Project ${input.projectId} not found`);

  const rate = input.rate ?? (proj.billing_rate == null ? null : Number(proj.billing_rate));
  if (!rate || rate <= 0) {
    throw new Error("No billing rate — pass rate or set billing_rate on the project");
  }
  const customerName = input.customerName ?? proj.customer_name;
  if (!customerName) {
    throw new Error("No customer — pass customerName or set customer_name on the project");
  }

  const logs = (await sql`
    select id, hours_logged, log_date, description, activity_type
    from time_logs
    where tenant_slug = ${tenantSlug}
      and project_id = ${input.projectId}::uuid
      and billable = true
      and invoice_id is null
      and lower(coalesce(approval_status, 'APPROVED')) in ('approved','submitted')
    order by log_date
  `) as any[];
  if (!logs.length) throw new Error("No uninvoiced billable time on this project");

  const hours = logs.reduce((s: number, l: any) => s + Number(l.hours_logged), 0);
  const amount = Math.round(hours * rate * 100) / 100;
  const today = new Date().toISOString().split("T")[0];
  const periodStart = String(logs[0].log_date).slice(0, 10);
  const periodEnd = String(logs[logs.length - 1].log_date).slice(0, 10);

  const invoice = await insertFinanceInvoice({
    tenantSlug,
    customerName,
    customerCode: input.customerCode ?? proj.customer_id ?? undefined,
    invoiceNumber: `INV-TS-${String(proj.name).replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
    issuedDate: input.issuedDate ?? today,
    dueDate: input.dueDate ?? today,
    currency: input.currency ?? "NGN",
    status: "sent",
    notes: `Billable time ${periodStart} → ${periodEnd}`,
    lineItems: [{
      description: `Professional services — ${proj.name} (${hours.toFixed(2)} hrs @ ${rate})`,
      quantity: hours,
      unitPrice: rate,
      amount,
      accountCode: "4100",
    }],
    amount,
    balanceDue: amount,
  } as any);

  const ids = logs.map((l: any) => l.id);
  await sql`
    update time_logs set invoice_id = ${invoice.id}
    where tenant_slug = ${tenantSlug} and id = any(${ids}::uuid[])
  `;
  return { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, hours, amount };
}

export async function setProjectBilling(
  tenantSlug: string,
  projectId: string,
  input: { customerName?: string; customerId?: string; billingRate?: number }
): Promise<void> {
  const sql = SQL;
  await ensureTimesheetBillingColumns(sql);
  await sql`
    update projects
    set customer_name = coalesce(${input.customerName ?? null}, customer_name),
        customer_id = coalesce(${input.customerId ?? null}, customer_id),
        billing_rate = coalesce(${input.billingRate ?? null}, billing_rate)
    where id = ${projectId}::uuid and tenant_slug = ${tenantSlug}
  `;
}
