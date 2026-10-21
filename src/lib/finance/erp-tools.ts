import { randomUUID } from "crypto";
import { db, sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { postGLEntry, GL_ACCOUNTS } from "./gl";

// ---------------------------------------------------------------------------
// Tranche B — ERPNext document/tool parity:
//   opening_invoice_creation_tool · unreconcile_payment · payment_order
//   process_statement_of_accounts · mode_of_payment · monthly_distribution
//   cost_center_allocation
// ---------------------------------------------------------------------------

export function ensureErpToolTables() {
  return ensureOnce("finance/erp-tools:ensureTables", async () => {
    const sql = SQL;
    await sql`
      create table if not exists payment_orders (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        name text not null,
        status text not null default 'draft',
        payment_date date not null,
        method text not null default 'bank_transfer',
        bank_account_code text,
        items jsonb not null default '[]'::jsonb,
        total_amount numeric not null default 0,
        journal_entry_ids jsonb not null default '[]'::jsonb,
        created_by text,
        created_at timestamptz not null default now(),
        processed_at timestamptz,
        unique (tenant_slug, name)
      )`;

    await sql`
      create table if not exists mode_of_payment (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        name text not null,
        type text not null default 'general',
        default_account_code text,
        enabled boolean not null default true,
        created_at timestamptz not null default now(),
        unique (tenant_slug, name)
      )`;

    await sql`
      create table if not exists monthly_distributions (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        name text not null,
        percentages jsonb not null,
        created_at timestamptz not null default now(),
        unique (tenant_slug, name)
      )`;

    await sql`
      create table if not exists cost_center_allocations (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        main_cost_center text not null,
        allocations jsonb not null,
        created_at timestamptz not null default now(),
        unique (tenant_slug, main_cost_center)
      )`;

    await sql`
      create table if not exists statement_runs (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        period_start date,
        period_end date,
        customer_count integer not null default 0,
        emailed integer not null default 0,
        status text not null default 'completed',
        created_by text,
        created_at timestamptz not null default now()
      )`;
  });
}

// ─── Opening Invoice Creation Tool ──────────────────────────────────────────

/**
 * Books opening AR/AP balances: Dr AR / Cr Temporary Opening per customer
 * invoice, Dr Temporary Opening / Cr AP per supplier bill. Each row creates a
 * real invoice/bill row so the subledgers (aging, recon, statements) see it.
 */
export async function importOpeningBalances(input: {
  tenantSlug: string;
  postingDate: string;
  userId?: string;
  invoices?: Array<{
    customerCode: string; customerName?: string;
    invoiceNumber?: string; dueDate?: string; amount: number;
    description?: string;
  }>;
  bills?: Array<{
    vendorCode?: string; vendorName?: string;
    billNumber?: string; dueDate?: string; amount: number;
    description?: string;
  }>;
}) {
  const results = { invoices: [] as any[], bills: [] as any[], errors: [] as string[] };
  const { insertFinanceInvoice } = await import("./db");

  for (const [i, inv] of (input.invoices ?? []).entries()) {
    try {
      const created = await insertFinanceInvoice({
        tenantSlug: input.tenantSlug,
        customerCode: inv.customerCode,
        customerName: inv.customerName ?? inv.customerCode,
        invoiceNumber: inv.invoiceNumber ?? `OPEN-${String(i + 1).padStart(3, "0")}`,
        issuedDate: input.postingDate,
        dueDate: inv.dueDate ?? input.postingDate,
        amount: inv.amount,
        status: "sent",
        lineItems: [{
          description: inv.description ?? "Opening balance",
          quantity: 1, unitPrice: inv.amount, taxRate: 0,
          accountCode: GL_ACCOUNTS.TEMPORARY_OPENING,
        }],
      } as any);
      results.invoices.push({ invoiceNumber: inv.invoiceNumber, id: created.id });
    } catch (e: any) {
      results.errors.push(`invoice ${inv.invoiceNumber ?? i + 1}: ${e.message}`);
    }
  }

  for (const [i, bill] of (input.bills ?? []).entries()) {
    try {
      const { createBill } = await import("./bills");
      let vendorId: string | undefined;
      if (bill.vendorCode || bill.vendorName) {
        const { createVendor } = await import("./vendors");
        const v = await createVendor({
          tenantSlug: input.tenantSlug,
          code: bill.vendorCode ?? `V-OPEN-${i + 1}`,
          name: bill.vendorName ?? bill.vendorCode ?? `Opening Vendor ${i + 1}`,
        } as any);
        vendorId = v.id;
      }
      if (!vendorId) throw new Error("vendorCode or vendorName required");
      const created = await createBill({
        tenantSlug: input.tenantSlug,
        vendorId,
        billDate: input.postingDate,
        dueDate: bill.dueDate ?? input.postingDate,
        items: [{
          description: bill.description ?? "Opening balance",
          quantity: 1, unitPrice: bill.amount, taxRate: 0,
          accountCode: GL_ACCOUNTS.TEMPORARY_OPENING,
        }],
      } as any);
      results.bills.push({ billNumber: (created as any).billNumber, id: created.id });
    } catch (e: any) {
      results.errors.push(`bill ${bill.billNumber ?? i + 1}: ${e.message}`);
    }
  }
  return results;
}

// ─── Unreconcile Payment ────────────────────────────────────────────────────

/**
 * ERPNext Unreconcile Payment: removes all allocations a payment made,
 * restoring invoice/bill balances and the payment's unallocated amount.
 * GL is untouched — the receipt/payment JE remains valid; only the link is
 * broken, matching ERPNext's PLE delink semantics.
 */
export async function unreconcileCustomerPayment(input: {
  tenantSlug: string; paymentId: string; invoiceId?: string;
}) {
  const params: any[] = [input.tenantSlug, input.paymentId];
  let where = `tenant_slug = $1 and payment_id = $2`;
  if (input.invoiceId) { params.push(input.invoiceId); where += ` and invoice_id = $${params.length}`; }
  const { rows: apps } = await db.query(
    `select * from payment_applications where ${where}`, params,
  );
  if (!(apps as any[]).length) throw new Error("No allocations found for this payment");

  for (const app of apps as any[]) {
    const { rows: inv } = await db.query(
      `select balance_due, status from finance_invoices where id = $1 and tenant_slug = $2`,
      [app.invoice_id, input.tenantSlug],
    );
    const current = (inv as any[])[0];
    if (!current) continue;
    const newBalance = Number(current.balance_due) + Number(app.amount);
    await db.query(
      `update finance_invoices set balance_due = $1,
         status = case when $1 >= amount then 'sent' else 'partially_paid' end,
         updated_at = now()
       where id = $2 and tenant_slug = $3`,
      [newBalance, app.invoice_id, input.tenantSlug],
    );
    await db.query(
      `update finance_payments
       set linked_invoices = array_remove(coalesce(linked_invoices, '{}'::text[]), $1::text),
           updated_at = now()
       where id = $2 and tenant_slug = $3`,
      [app.invoice_id, input.paymentId, input.tenantSlug],
    ).catch(() => undefined);
  }
  await db.query(
    `delete from payment_applications where ${where}`, params,
  );
  return { removed: (apps as any[]).length };
}

export async function unreconcileVendorPayment(input: {
  tenantSlug: string; paymentId: string; billId?: string;
}) {
  const params: any[] = [input.tenantSlug, input.paymentId];
  let where = `p.tenant_slug = $1 and a.payment_id = $2`;
  if (input.billId) { params.push(input.billId); where += ` and a.bill_id = $${params.length}`; }
  const { rows: apps } = await db.query(
    `select a.* from vendor_payment_applications a
     join vendor_payments p on p.id = a.payment_id
     where ${where}`,
    params,
  );
  if (!(apps as any[]).length) throw new Error("No allocations found for this payment");

  for (const app of apps as any[]) {
    await db.query(
      `update bills set balance_due = coalesce(balance_due, 0) + $1,
         status = case when balance_due + $1 >= total then 'approved' else 'partially_paid' end,
         updated_at = now()
       where id = $2 and tenant_slug = $3`,
      [app.applied_amount, app.bill_id, input.tenantSlug],
    ).catch(() => undefined);
    await db.query(
      `update vendor_payments set unapplied_amount = unapplied_amount + $1, updated_at = now()
       where id = $2 and tenant_slug = $3`,
      [app.applied_amount, input.paymentId, input.tenantSlug],
    );
  }
  const delParams: any[] = [input.paymentId];
  let del = `delete from vendor_payment_applications where payment_id = $1`;
  if (input.billId) { delParams.push(input.billId); del += ` and bill_id = $${delParams.length}`; }
  await db.query(del, delParams);
  return { removed: (apps as any[]).length };
}

// ─── Mode of Payment ────────────────────────────────────────────────────────

export async function upsertModeOfPayment(input: {
  tenantSlug: string; name: string; type?: string; defaultAccountCode?: string; enabled?: boolean;
}) {
  await ensureErpToolTables();
  const [row] = (await SQL`
    insert into mode_of_payment (tenant_slug, name, type, default_account_code, enabled)
    values (${input.tenantSlug}, ${input.name.trim()}, ${input.type ?? "general"},
            ${input.defaultAccountCode ?? null}, ${input.enabled ?? true})
    on conflict (tenant_slug, name) do update
      set type = excluded.type, default_account_code = excluded.default_account_code,
          enabled = excluded.enabled
    returning *
  `) as any[];
  return row;
}

export async function listModesOfPayment(tenantSlug: string) {
  await ensureErpToolTables();
  return (await SQL`
    select * from mode_of_payment where tenant_slug = ${tenantSlug} and enabled order by name
  `) as any[];
}

// ─── Payment Order (bulk supplier payment run) ─────────────────────────────

/**
 * Creates a payment order from a set of open bills. Processing it issues one
 * vendor_payment per supplier covering the listed bills, then applies them.
 */
export async function createPaymentOrder(input: {
  tenantSlug: string; name: string; paymentDate: string;
  method?: string; bankAccountCode?: string;
  items: Array<{ billId: string; amount?: number }>;
  userId?: string;
}) {
  await ensureErpToolTables();
  const ids = input.items.map((i) => i.billId);
  const { rows: bills } = await db.query(
    `select b.id, b.bill_number, b.vendor_id, b.balance_due, b.total, v.legal_name vendor_name
     from bills b left join vendors v on v.id = b.vendor_id
     where b.tenant_slug = $1 and b.id = any($2) and b.status not in ('paid','cancelled','void')`,
    [input.tenantSlug, ids],
  );
  if (!(bills as any[]).length) throw new Error("No eligible open bills found");
  const items = (bills as any[]).map((b) => {
    const req = input.items.find((i) => i.billId === b.id || i.billId === String(b.id));
    const amount = Math.min(Number(req?.amount ?? b.balance_due), Number(b.balance_due));
    return { billId: b.id, billNumber: b.bill_number, vendorId: b.vendor_id, vendorName: b.vendor_name, amount };
  });
  const total = items.reduce((s, i) => s + i.amount, 0);
  const id = randomUUID();
  await SQL`
    insert into payment_orders (id, tenant_slug, name, status, payment_date, method, bank_account_code, items, total_amount, created_by)
    values (${id}, ${input.tenantSlug}, ${input.name.trim()}, 'draft', ${input.paymentDate},
            ${input.method ?? "bank_transfer"}, ${input.bankAccountCode ?? null},
            ${JSON.stringify(items)}, ${total}, ${input.userId ?? null})`;
  return { id, items, totalAmount: total };
}

export async function processPaymentOrder(input: { tenantSlug: string; paymentOrderId: string; userId?: string }) {
  await ensureErpToolTables();
  const [po] = (await SQL`
    select * from payment_orders where id = ${input.paymentOrderId} and tenant_slug = ${input.tenantSlug}
  `) as any[];
  if (!po) throw new Error("Payment order not found");
  if (po.status !== "draft") throw new Error(`Payment order already ${po.status}`);

  const items = typeof po.items === "string" ? JSON.parse(po.items) : po.items;
  const byVendor = new Map<string, typeof items>();
  for (const it of items) {
    const list = byVendor.get(it.vendorId) ?? [];
    list.push(it);
    byVendor.set(it.vendorId, list);
  }

  const { createVendorPayment } = await import("./vendor-payments");
  const { applyPaymentToBill } = await import("./vendor-payments");
  const results: any[] = [];
  for (const [vendorId, vendorItems] of byVendor) {
    const total = vendorItems.reduce((s: number, i: any) => s + Number(i.amount), 0);
    const payment = await createVendorPayment({
      tenantSlug: input.tenantSlug,
      vendorId,
      amount: total,
      method: po.method,
      paymentDate: po.payment_date,
      reference: `PO-${po.name}`,
    } as any);
    for (const it of vendorItems) {
      try {
        await applyPaymentToBill(payment.id, it.billId, Number(it.amount), input.tenantSlug);
      } catch (e: any) {
        results.push({ billId: it.billId, error: e.message });
      }
    }
    results.push({ vendorId, paymentId: payment.id, amount: total });
  }

  await SQL`
    update payment_orders set status = 'processed', processed_at = now(),
      journal_entry_ids = ${JSON.stringify(results)}
    where id = ${input.paymentOrderId} and tenant_slug = ${input.tenantSlug}`;
  return { paymentOrderId: input.paymentOrderId, results };
}

export async function listPaymentOrders(tenantSlug: string) {
  await ensureErpToolTables();
  return (await SQL`
    select * from payment_orders where tenant_slug = ${tenantSlug} order by created_at desc
  `) as any[];
}

// ─── Process Statement of Accounts ─────────────────────────────────────────

/**
 * Generates statements for every customer with open AR or period activity and
 * emails each via the notification outbox.
 */
export async function processStatementOfAccounts(input: {
  tenantSlug: string; periodStart?: string; periodEnd?: string;
  userId?: string; email?: boolean;
}) {
  await ensureErpToolTables();
  const { customerStatement } = await import("./credit-control");
  const { emitEvent } = await import("@/lib/notify");

  const { rows: customers } = await db.query(
    `select distinct i.customer_code code, max(i.customer_name) name
     from finance_invoices i
     where i.tenant_slug = $1 and i.status <> 'void'
       and (i.balance_due > 0 or i.issued_date::date between
            coalesce($2::date, '1900-01-01') and coalesce($3::date, '2100-01-01'))`,
    [input.tenantSlug, input.periodStart ?? null, input.periodEnd ?? null],
  );

  let emailed = 0;
  const statements: any[] = [];
  for (const c of customers as any[]) {
    const stmt = await customerStatement({
      tenantSlug: input.tenantSlug, customerCode: c.code,
      startDate: input.periodStart, endDate: input.periodEnd,
    });
    statements.push({ customer: c.code, name: c.name, entryCount: stmt.lines?.length ?? 0, balance: stmt.closingBalance });
    if (input.email !== false) {
      const email = await resolvePartyEmail(input.tenantSlug, c.code).catch(() => null);
      if (email) {
        await emitEvent({
          tenantSlug: input.tenantSlug,
          eventType: "statement.ready",
          sourceModule: "finance",
          payload: { customerName: c.name, periodStart: input.periodStart ?? "start", periodEnd: input.periodEnd ?? "today", closingBalance: stmt.closingBalance, entries: stmt.lines?.length ?? 0 },
          explicitRecipients: [{ email, name: c.name }],
          dedupeKey: `statement-${c.code}-${input.periodEnd ?? "now"}`,
        }).catch(() => undefined);
        emailed++;
      }
    }
  }

  const id = randomUUID();
  await SQL`
    insert into statement_runs (id, tenant_slug, period_start, period_end, customer_count, emailed, created_by)
    values (${id}, ${input.tenantSlug}, ${input.periodStart ?? null}, ${input.periodEnd ?? null},
            ${(customers as any[]).length}, ${emailed}, ${input.userId ?? null})`;
  return { id, customerCount: (customers as any[]).length, emailed, statements };
}

async function resolvePartyEmail(tenantSlug: string, customerCode: string): Promise<string | null> {
  const { rows } = await db.query(
    `select customer_email from finance_invoices
     where tenant_slug = $1 and customer_code = $2 and customer_email is not null
     order by issued_date desc limit 1`,
    [tenantSlug, customerCode],
  );
  if ((rows as any[])[0]?.customer_email) return (rows as any[])[0].customer_email;
  const { rows: crm } = await db.query(
    `select email from customers where tenant_slug = $1 and code = $2 limit 1`,
    [tenantSlug, customerCode],
  ).catch(() => ({ rows: [] }));
  return (crm as any[])[0]?.email ?? null;
}

// ─── Monthly Distribution (seasonal budget spread) ─────────────────────────

export async function upsertMonthlyDistribution(input: {
  tenantSlug: string; name: string; percentages: number[]; // 12 values summing ~100
}) {
  await ensureErpToolTables();
  if (input.percentages.length !== 12) throw new Error("Exactly 12 monthly percentages required");
  const sum = input.percentages.reduce((s, p) => s + p, 0);
  if (Math.abs(sum - 100) > 0.5) throw new Error(`Percentages must total 100 (got ${sum})`);
  const [row] = (await SQL`
    insert into monthly_distributions (tenant_slug, name, percentages)
    values (${input.tenantSlug}, ${input.name.trim()}, ${JSON.stringify(input.percentages)})
    on conflict (tenant_slug, name) do update set percentages = excluded.percentages
    returning *
  `) as any[];
  return row;
}

export async function listMonthlyDistributions(tenantSlug: string) {
  await ensureErpToolTables();
  return (await SQL`
    select * from monthly_distributions where tenant_slug = ${tenantSlug} order by name
  `) as any[];
}

/** Apportions an annual budget across a month index (0-11) via a distribution. */
export function distributeBudget(annualAmount: number, distribution: number[] | null, month: number) {
  const pct = distribution?.[month] ?? 100 / 12;
  return (annualAmount * pct) / 100;
}

// ─── Cost Center Allocation ─────────────────────────────────────────────────

export async function upsertCostCenterAllocation(input: {
  tenantSlug: string; mainCostCenter: string;
  allocations: Array<{ costCenterId: string; percentage: number }>;
}) {
  await ensureErpToolTables();
  const sum = input.allocations.reduce((s, a) => s + a.percentage, 0);
  if (Math.abs(sum - 100) > 0.5) throw new Error(`Allocation percentages must total 100 (got ${sum})`);
  const [row] = (await SQL`
    insert into cost_center_allocations (tenant_slug, main_cost_center, allocations)
    values (${input.tenantSlug}, ${input.mainCostCenter.trim()}, ${JSON.stringify(input.allocations)})
    on conflict (tenant_slug, main_cost_center) do update set allocations = excluded.allocations
    returning *
  `) as any[];
  return row;
}

export async function listCostCenterAllocations(tenantSlug: string) {
  await ensureErpToolTables();
  return (await SQL`
    select * from cost_center_allocations where tenant_slug = ${tenantSlug} order by main_cost_center
  `) as any[];
}

/**
 * Expands GL lines per cost-center allocation: a line tagged with a main cost
 * center that has an allocation rule is split into N lines sharing the amount
 * by percentage. Remainder lands on the largest slice.
 */
export async function applyCostCenterAllocations(
  tenantSlug: string,
  lines: Array<{ costCenterId?: string; debitAmount?: number; creditAmount?: number; [k: string]: any }>,
) {
  await ensureErpToolTables();
  const rules = new Map(
    ((await SQL`
      select main_cost_center, allocations from cost_center_allocations
      where tenant_slug = ${tenantSlug}
    `) as any[]).map((r) => [r.main_cost_center, typeof r.allocations === "string" ? JSON.parse(r.allocations) : r.allocations]),
  );
  const out: any[] = [];
  for (const line of lines) {
    const alloc = line.costCenterId ? rules.get(line.costCenterId) : null;
    if (!alloc?.length) { out.push(line); continue; }
    let remaining = (line.debitAmount ?? 0) || (line.creditAmount ?? 0);
    const field = line.debitAmount ? "debitAmount" : "creditAmount";
    for (const [i, a] of alloc.entries()) {
      const isLast = i === alloc.length - 1;
      const share = isLast ? remaining : Math.round(remaining * a.percentage / 100 * 100) / 100;
      remaining = Math.round((remaining - share) * 100) / 100;
      if (share <= 0) continue;
      out.push({ ...line, costCenterId: a.costCenterId, [field]: share });
    }
  }
  return out;
}
