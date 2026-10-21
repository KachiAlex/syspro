import { randomUUID } from "node:crypto";
import { sql as SQL } from "../sql-client";
import { insertFinanceInvoice } from "./db";
import { ensureOnce } from "@/lib/ensure-once";

export type RecurringFrequency = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export interface RecurringInvoiceTemplate {
  id: string;
  customerName: string;
  customerCode: string | null;
  frequency: RecurringFrequency;
  nextRunDate: string;
  endDate: string | null;
  status: "active" | "paused" | "completed";
  template: {
    lineItems: Array<{ description: string; quantity: number; unitPrice: number; taxRate?: number; accountCode?: string }>;
    currency?: string;
    paymentTerms?: string;
    notes?: string;
  };
  lastInvoiceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function ensureRecurringTables(...args: Parameters<typeof ensureRecurringTablesRun>) {
  return ensureOnce("finance/recurring:ensureRecurringTables", () => ensureRecurringTablesRun(...args));
}

async function ensureRecurringTablesRun(sql = SQL) {
  await sql`
    create table if not exists recurring_invoices (
      id text primary key,
      tenant_slug text not null,
      customer_name text not null,
      customer_code text,
      frequency text not null,
      next_run_date date not null,
      end_date date,
      status text not null default 'active',
      template jsonb not null,
      last_invoice_id text,
      created_by text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
}

function addFrequency(dateStr: string, freq: RecurringFrequency): string {
  const d = new Date(dateStr + "T00:00:00Z");
  switch (freq) {
    case "daily": d.setUTCDate(d.getUTCDate() + 1); break;
    case "weekly": d.setUTCDate(d.getUTCDate() + 7); break;
    case "monthly": d.setUTCMonth(d.getUTCMonth() + 1); break;
    case "quarterly": d.setUTCMonth(d.getUTCMonth() + 3); break;
    case "yearly": d.setUTCFullYear(d.getUTCFullYear() + 1); break;
  }
  return d.toISOString().slice(0, 10);
}

export async function createRecurringTemplate(
  tenantSlug: string,
  input: {
    customerName: string;
    customerCode?: string;
    frequency: RecurringFrequency;
    startDate: string;
    endDate?: string;
    template: RecurringInvoiceTemplate["template"];
    createdBy?: string;
  }
): Promise<RecurringInvoiceTemplate> {
  const sql = SQL;
  await ensureRecurringTables(sql);
  if (!input.template?.lineItems?.length) throw new Error("Template requires at least one line item");
  const id = `rinv_${randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();
  await sql`
    insert into recurring_invoices (
      id, tenant_slug, customer_name, customer_code, frequency, next_run_date,
      end_date, status, template, created_by, created_at, updated_at
    ) values (
      ${id}, ${tenantSlug}, ${input.customerName}, ${input.customerCode ?? null},
      ${input.frequency}, ${input.startDate}, ${input.endDate ?? null},
      'active', ${JSON.stringify(input.template)}, ${input.createdBy ?? null}, ${now}, ${now}
    )
  `;
  return (await getRecurringTemplate(tenantSlug, id))!;
}

export async function getRecurringTemplate(
  tenantSlug: string,
  id: string
): Promise<RecurringInvoiceTemplate | null> {
  const sql = SQL;
  const rows = (await sql`
    select * from recurring_invoices where id = ${id} and tenant_slug = ${tenantSlug}
  `) as any[];
  return rows[0] ? normalize(rows[0]) : null;
}

export async function listRecurringTemplates(
  tenantSlug: string,
  opts: { status?: string } = {}
): Promise<RecurringInvoiceTemplate[]> {
  const sql = SQL;
  await ensureRecurringTables(sql);
  const rows = (await sql`
    select * from recurring_invoices
    where tenant_slug = ${tenantSlug}
      and (${opts.status ?? null}::text is null or status = ${opts.status ?? null})
    order by next_run_date asc
  `) as any[];
  return rows.map(normalize);
}

export async function setRecurringStatus(
  tenantSlug: string,
  id: string,
  status: "active" | "paused" | "completed"
): Promise<void> {
  const sql = SQL;
  await sql`
    update recurring_invoices set status = ${status}, updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug}
  `;
}

/**
 * Generate invoices for every active template whose next_run_date is due.
 * Loops the date forward so catching up on missed periods creates the right
 * number of invoices. Returns the generated invoice ids.
 */
export async function generateDueInvoices(
  tenantSlug: string,
  asOfDate?: string
): Promise<{ generated: Array<{ templateId: string; invoiceId: string; runDate: string }> }> {
  const sql = SQL;
  await ensureRecurringTables(sql);
  const asOf = asOfDate ?? new Date().toISOString().split("T")[0];
  const due = (await sql`
    select * from recurring_invoices
    where tenant_slug = ${tenantSlug} and status = 'active' and next_run_date <= ${asOf}
    order by next_run_date asc
  `) as any[];

  const generated: Array<{ templateId: string; invoiceId: string; runDate: string }> = [];
  for (const t of due) {
    const template = typeof t.template === "string" ? JSON.parse(t.template) : t.template;
    const toDay = (v: any) =>
      v instanceof Date
        ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`
        : String(v).slice(0, 10);
    let runDate = toDay(t.next_run_date);
    const endDate = t.end_date ? toDay(t.end_date) : null;
    let lastId: string | null = null;
    // Catch up on any missed runs up to (and including) the as-of date.
    while (runDate <= asOf && (!endDate || runDate <= endDate)) {
      const lines = template.lineItems ?? [];
      const subtotal = lines.reduce(
        (s: number, l: any) => s + Number(l.quantity) * Number(l.unitPrice), 0
      );
      const taxTotal = lines.reduce(
        (s: number, l: any) =>
          s + (Number(l.quantity) * Number(l.unitPrice) * Number(l.taxRate ?? 0)) / 100, 0
      );
      const amount = Math.round((subtotal + taxTotal) * 100) / 100;
      const due30 = addFrequency(runDate, "monthly");
      const invoice = await insertFinanceInvoice({
        tenantSlug,
        customerName: t.customer_name,
        customerCode: t.customer_code ?? undefined,
        invoiceNumber: `INV-REC-${t.id.slice(-6)}-${runDate.replace(/-/g, "")}`,
        issuedDate: runDate,
        dueDate: due30,
        currency: template.currency ?? "NGN",
        status: "sent",
        paymentTerms: template.paymentTerms,
        notes: template.notes,
        lineItems: lines.map((l: any) => ({
          description: l.description,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          amount: Number(l.quantity) * Number(l.unitPrice),
          taxRate: l.taxRate ?? null,
          accountCode: l.accountCode ?? null,
        })),
        amount,
        balanceDue: amount,
      } as any);
      lastId = invoice.id;
      generated.push({ templateId: t.id, invoiceId: invoice.id, runDate });
      runDate = addFrequency(runDate, t.frequency);
    }
    const completed = endDate && runDate > endDate;
    await sql`
      update recurring_invoices
      set next_run_date = ${runDate},
          last_invoice_id = ${lastId ?? t.last_invoice_id},
          status = ${completed ? "completed" : "active"},
          updated_at = now()
      where id = ${t.id} and tenant_slug = ${tenantSlug}
    `;
  }
  return { generated };
}

function normalize(r: any): RecurringInvoiceTemplate {
  return {
    id: r.id,
    customerName: r.customer_name,
    customerCode: r.customer_code,
    frequency: r.frequency,
    nextRunDate: r.next_run_date instanceof Date
      ? r.next_run_date.toISOString().slice(0, 10)
      : String(r.next_run_date).slice(0, 10),
    endDate: r.end_date
      ? r.end_date instanceof Date
        ? r.end_date.toISOString().slice(0, 10)
        : String(r.end_date).slice(0, 10)
      : null,
    status: r.status,
    template: typeof r.template === "string" ? JSON.parse(r.template) : r.template,
    lastInvoiceId: r.last_invoice_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
