import { randomUUID } from "crypto";

import { db, sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { postGLEntry, GL_ACCOUNTS } from "./gl";

// ---------------------------------------------------------------------------
// Receivable-side credit control: payment terms & schedules, credit limits,
// dunning notices, and customer statements built on the GL party subledger.
// ---------------------------------------------------------------------------

export function ensureCreditTables() {
  return ensureOnce("finance/credit:ensureTables", ensureCreditTablesRun);
}

async function ensureCreditTablesRun() {
  const sql = SQL;
  await sql`create table if not exists payment_terms (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    name text not null,
    terms jsonb not null,
    is_default boolean not null default false,
    created_at timestamptz not null default now()
  )`;
  await sql`create table if not exists invoice_payment_schedule (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    invoice_id text not null,
    due_date date not null,
    amount numeric not null,
    paid_amount numeric not null default 0,
    created_at timestamptz not null default now()
  )`;
  await sql`create table if not exists finance_customers (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    customer_code text not null,
    name text not null,
    credit_limit numeric,
    credit_hold boolean not null default false,
    payment_term_id uuid,
    default_currency text,
    metadata jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;
  await sql`alter table if exists finance_customers add column if not exists email text`;
  await sql`create table if not exists dunning_notices (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    invoice_id text not null,
    level integer not null,
    issue_date date not null,
    method text not null default 'letter',
    fee_amount numeric not null default 0,
    journal_entry_id uuid,
    detail jsonb,
    created_at timestamptz not null default now()
  )`;
  await sql`alter table finance_invoices add column if not exists payment_term_id uuid`;
  await sql`alter table finance_invoices add column if not exists customer_id uuid`;
}

// ---------------------------------------------------------------------------
// Payment terms
// ---------------------------------------------------------------------------
export type PaymentTermRow = { days: number; portion: number };

export async function listPaymentTerms(tenantSlug: string) {
  await ensureCreditTables();
  return (await db.query<any>(
    `select * from payment_terms where tenant_slug = $1 order by name`,
    [tenantSlug]
  )).rows;
}

export async function createPaymentTerm(input: {
  tenantSlug: string;
  name: string;
  terms: PaymentTermRow[];
  isDefault?: boolean;
}) {
  await ensureCreditTables();
  const total = input.terms.reduce((s, t) => s + Number(t.portion), 0);
  if (Math.abs(total - 100) > 0.01)
    throw new Error(`Term portions must sum to 100 (got ${total})`);
  const id = randomUUID();
  await db.query(
    `insert into payment_terms (id, tenant_slug, name, terms, is_default)
     values ($1,$2,$3,$4,$5)`,
    [id, input.tenantSlug, input.name, JSON.stringify(input.terms), !!input.isDefault]
  );
  return { id };
}

async function getPaymentTerm(tenantSlug: string, id?: string | null) {
  const rows = id
    ? (await db.query<any>(`select * from payment_terms where id = $1 and tenant_slug = $2`, [id, tenantSlug])).rows
    : (await db.query<any>(`select * from payment_terms where tenant_slug = $1 and is_default limit 1`, [tenantSlug])).rows;
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Invoice payment schedule — built when an invoice is issued.
// Falls back to the invoice's own due_date when no term template applies.
// ---------------------------------------------------------------------------
export async function buildInvoiceSchedule(input: {
  tenantSlug: string;
  invoiceId: string;
  issueDate: string;
  amount: number;
  paymentTermId?: string | null;
  dueDate?: string;
}) {
  await ensureCreditTables();
  const term = await getPaymentTerm(input.tenantSlug, input.paymentTermId);
  const issue = new Date(input.issueDate);

  const rows: { dueDate: string; amount: number }[] = [];
  if (term) {
    const terms: PaymentTermRow[] = Array.isArray(term.terms)
      ? term.terms : JSON.parse(term.terms);
    let allocated = 0;
    terms.forEach((t, i) => {
      const amount = i === terms.length - 1
        ? Math.round((input.amount - allocated) * 100) / 100
        : Math.round(input.amount * (t.portion / 100) * 100) / 100;
      allocated += amount;
      const d = new Date(issue);
      d.setUTCDate(d.getUTCDate() + t.days);
      rows.push({ dueDate: d.toISOString().slice(0, 10), amount });
    });
  } else {
    rows.push({ dueDate: input.dueDate ?? input.issueDate, amount: input.amount });
  }

  await db.query(
    `delete from invoice_payment_schedule where invoice_id = $1`, [input.invoiceId]
  );
  for (const r of rows) {
    await db.query(
      `insert into invoice_payment_schedule (id, tenant_slug, invoice_id, due_date, amount)
       values ($1,$2,$3,$4,$5)`,
      [randomUUID(), input.tenantSlug, input.invoiceId, r.dueDate, r.amount]
    );
  }
  return rows;
}

export async function getInvoiceSchedule(tenantSlug: string, invoiceId: string) {
  await ensureCreditTables();
  return (await db.query<any>(
    `select * from invoice_payment_schedule where invoice_id = $1 and tenant_slug = $2
     order by due_date`,
    [invoiceId, tenantSlug]
  )).rows;
}

// Mark schedule rows paid as cash is received (called after receive-payment).
export async function markSchedulePaid(tenantSlug: string, invoiceId: string, amount: number) {
  await ensureCreditTables();
  const rows = await getInvoiceSchedule(tenantSlug, invoiceId);
  let remaining = amount;
  for (const r of rows) {
    const due = Number(r.amount) - Number(r.paid_amount);
    if (due <= 0) continue;
    const pay = Math.min(due, remaining);
    await db.query(
      `update invoice_payment_schedule set paid_amount = paid_amount + $1 where id = $2`,
      [pay, r.id]
    );
    remaining -= pay;
    if (remaining <= 0) break;
  }
}

// ---------------------------------------------------------------------------
// Customers & credit limits
// ---------------------------------------------------------------------------
export async function upsertCustomer(input: {
  tenantSlug: string;
  customerCode: string;
  name: string;
  email?: string | null;
  creditLimit?: number | null;
  creditHold?: boolean;
  paymentTermId?: string | null;
  defaultCurrency?: string;
}) {
  await ensureCreditTables();
  const prior = (await db.query<any>(
    `select credit_hold from finance_customers where tenant_slug = $1 and customer_code = $2`,
    [input.tenantSlug, input.customerCode]
  )).rows[0];
  await db.query(
    `insert into finance_customers (id, tenant_slug, customer_code, name,
       email, credit_limit, credit_hold, payment_term_id, default_currency)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict (tenant_slug, customer_code) do update set
       name = excluded.name,
       email = coalesce(excluded.email, finance_customers.email),
       credit_limit = coalesce(excluded.credit_limit, finance_customers.credit_limit),
       credit_hold = excluded.credit_hold,
       payment_term_id = coalesce(excluded.payment_term_id, finance_customers.payment_term_id),
       default_currency = coalesce(excluded.default_currency, finance_customers.default_currency),
       updated_at = now()`,
    [randomUUID(), input.tenantSlug, input.customerCode, input.name,
     input.email ?? null, input.creditLimit ?? null, input.creditHold ?? false,
     input.paymentTermId ?? null, input.defaultCurrency ?? null]
  );

  // Notify on the transition into credit hold — that's the actionable moment.
  if (input.creditHold && !prior?.credit_hold) {
    try {
      const { emitEvent } = await import("@/lib/notify");
      void emitEvent({
        tenantSlug: input.tenantSlug,
        eventType: "customer.credit_hold",
        sourceModule: "finance",
        sourceRecordId: input.customerCode,
        dedupeKey: `credithold:${input.customerCode}:${Date.now()}`,
        payload: { customerCode: input.customerCode, customerName: input.name },
      });
    } catch (err) {
      console.error("Failed to emit customer.credit_hold:", err);
    }
  }
}

export async function getCustomer(tenantSlug: string, customerCode: string) {
  await ensureCreditTables();
  const rows = (await db.query<any>(
    `select * from finance_customers where tenant_slug = $1 and customer_code = $2`,
    [tenantSlug, customerCode]
  )).rows;
  return rows[0] ?? null;
}

export async function listCustomers(tenantSlug: string) {
  await ensureCreditTables();
  return (await db.query<any>(
    `select * from finance_customers where tenant_slug = $1 order by name`,
    [tenantSlug]
  )).rows;
}

// Open AR for a customer: unpaid balance on issued invoices + unallocated
// payment credit. Used for credit-limit enforcement.
export async function customerOpenBalance(tenantSlug: string, customerCode: string) {
  const rows = (await db.query<{ open: number }>(
    `select coalesce(sum(balance_due), 0)::float as open
     from finance_invoices
     where tenant_slug = $1 and customer_code = $2
       and status in ('sent','partially_paid','overdue')`,
    [tenantSlug, customerCode]
  )).rows;
  return rows[0]?.open ?? 0;
}

// Throws when issuing `amount` would breach the customer's credit terms.
export async function assertCreditAvailable(
  tenantSlug: string, customerCode: string, amount: number
) {
  const { getFinanceSettings } = await import("./settings");
  const settings = await getFinanceSettings(tenantSlug).catch(() => null);
  if (settings?.creditCheckMode === "off") return { ok: true };
  const cust = await getCustomer(tenantSlug, customerCode);
  if (!cust) return { ok: true };
  if (cust.credit_hold)
    throw new Error(`Customer ${customerCode} is on credit hold`);
  if (cust.credit_limit == null) return { ok: true };
  const open = await customerOpenBalance(tenantSlug, customerCode);
  if (open + amount > Number(cust.credit_limit)) {
    if (settings?.creditCheckMode === "warn") {
      return {
        ok: true,
        warning: `Credit limit exceeded for ${customerCode}: open AR ${open.toFixed(2)} + ` +
          `new ${amount.toFixed(2)} > limit ${Number(cust.credit_limit).toFixed(2)}`,
        open,
        limit: Number(cust.credit_limit),
      };
    }
    throw new Error(
      `Credit limit exceeded for ${customerCode}: open AR ${open.toFixed(2)} + ` +
      `new ${amount.toFixed(2)} > limit ${Number(cust.credit_limit).toFixed(2)}`
    );
  }
  return { ok: true, open, limit: Number(cust.credit_limit) };
}

// ---------------------------------------------------------------------------
// Dunning: overdue invoices get escalating notices; optional fee posts to GL.
// ---------------------------------------------------------------------------
export async function listDunningCandidates(tenantSlug: string, asOf?: string) {
  await ensureCreditTables();
  const rows = (await db.query<any>(
    `select i.id, i.invoice_number, i.customer_name, i.customer_code,
            i.due_date, i.amount::float, i.balance_due::float,
            coalesce(max(d.level), 0) as current_level,
            ($1::date - i.due_date) as days_overdue
     from finance_invoices i
     left join dunning_notices d on d.invoice_id = i.id and d.tenant_slug = i.tenant_slug
     where i.tenant_slug = $2
       and i.status in ('sent','partially_paid','overdue')
       and i.due_date < $1::date
     group by i.id
     order by i.due_date`,
    [asOf ?? new Date().toISOString().slice(0, 10), tenantSlug]
  )).rows;
  return rows;
}

// Level escalation: L1 >= 1 day, L2 >= 15, L3 >= 30, L4 >= 45.
function levelFor(daysOverdue: number) {
  if (daysOverdue >= 45) return 4;
  if (daysOverdue >= 30) return 3;
  if (daysOverdue >= 15) return 2;
  return 1;
}

export async function issueDunningNotice(input: {
  tenantSlug: string;
  invoiceId: string;
  method?: string;
  feeAmount?: number;
  issueDate: string;
  userId?: string;
}) {
  await ensureCreditTables();
  const inv = (await db.query<any>(
    `select * from finance_invoices where id = $1 and tenant_slug = $2`,
    [input.invoiceId, input.tenantSlug]
  )).rows[0];
  if (!inv) throw new Error(`Invoice ${input.invoiceId} not found`);

  const asOf = input.issueDate;
  const daysOverdue = Math.floor(
    (Date.parse(asOf) - Date.parse(String(inv.due_date).slice(0, 10))) / 86400000
  );
  if (daysOverdue < 1) throw new Error("Invoice is not overdue");

  const target = levelFor(daysOverdue);
  const existing = (await db.query<any>(
    `select coalesce(max(level),0) l from dunning_notices
     where invoice_id = $1 and tenant_slug = $2`,
    [input.invoiceId, input.tenantSlug]
  )).rows[0];
  const level = Math.min(target, Number(existing.l) + 1);
  if (level <= existing.l)
    throw new Error(`Dunning level ${target} already issued for this invoice`);

  // Optional dunning fee: Dr AR / Cr dunning fee income.
  let jeId: string | null = null;
  const fee = input.feeAmount ?? 0;
  if (fee > 0) {
    const je = await postGLEntry({
      tenantSlug: input.tenantSlug,
      entryDate: input.issueDate,
      journalType: "SYSTEM",
      referenceType: "dunning_fee",
      referenceId: input.invoiceId,
      description: `Dunning fee L${level} - invoice ${inv.invoice_number}`,
      createdBy: input.userId,
      lines: [
        { accountCode: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE, debitAmount: fee,
          partyType: "customer", partyId: inv.customer_code ?? inv.customer_name,
          description: "Dunning fee" },
        { accountCode: GL_ACCOUNTS.DUNNING_FEE_INCOME, creditAmount: fee,
          description: "Dunning fee income" },
      ],
    });
    jeId = je.id;
    await db.query(
      `update finance_invoices set amount = amount + $1, balance_due = balance_due + $1,
        updated_at = now() where id = $2`,
      [fee, input.invoiceId]
    );
  }

  const id = randomUUID();
  await db.query(
    `insert into dunning_notices (id, tenant_slug, invoice_id, level, issue_date,
       method, fee_amount, journal_entry_id, detail)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, input.tenantSlug, input.invoiceId, level, input.issueDate,
     input.method ?? "letter", fee, jeId,
     JSON.stringify({ daysOverdue, balance: Number(inv.balance_due) })]
  );

  try {
    const { emitEvent } = await import("@/lib/notify");
    void emitEvent({
      tenantSlug: input.tenantSlug,
      eventType: "dunning.issued",
      sourceModule: "finance",
      sourceRecordId: id,
      dedupeKey: `dunning:${id}`,
      payload: {
        invoiceNumber: inv.invoice_number,
        invoiceId: input.invoiceId,
        customerName: inv.customer_name,
        customerId: inv.customer_id,
        customerCode: inv.customer_code,
        partyEmail: inv.customer_email,
        level,
        daysOverdue,
        balanceDue: Number(inv.balance_due) + fee,
        feeAmount: fee,
        method: input.method ?? "letter",
      },
    });
  } catch (err) {
    console.error("Failed to emit dunning.issued:", err);
  }

  return { id, level, daysOverdue, journalEntryId: jeId };
}

/**
 * Automated dunning run — scans overdue invoices and issues the next
 * escalation level for each. Level fees come from
 * settings.creditControl.dunningFees ({ "1": 0, "2": 500, "3": 1000, "4": 2000 });
 * settings.creditControl.autoHoldLevel places the customer on credit hold at
 * that level and above. Idempotent: issueDunningNotice skips already-issued
 * levels, and a candidate only gets one notice per level.
 */
export async function runDunningCycle(input: {
  tenantSlug: string;
  asOf?: string;
  method?: string;
  userId?: string;
}) {
  await ensureCreditTables();
  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);
  const settingsRow = (await db.query<any>(
    `select settings from tenants where slug = $1`, [input.tenantSlug]
  )).rows[0];
  const cfg = (settingsRow?.settings as any)?.creditControl ?? {};
  const fees: Record<string, number> = cfg.dunningFees ?? {};
  const autoHoldLevel: number | null = cfg.autoHoldLevel ?? null;

  const candidates = await listDunningCandidates(input.tenantSlug, asOf);
  const issued: Array<{ invoiceId: string; invoiceNumber: string; level: number }> = [];
  const held: string[] = [];
  const errors: Array<{ invoiceId: string; error: string }> = [];

  for (const c of candidates) {
    const target = levelFor(Number(c.days_overdue));
    if (Number(c.current_level) >= target) continue; // already at/beyond target
    try {
      const out = await issueDunningNotice({
        tenantSlug: input.tenantSlug,
        invoiceId: c.id,
        method: input.method ?? "letter",
        feeAmount: fees[String(target)] ?? 0,
        issueDate: asOf,
        userId: input.userId,
      });
      issued.push({ invoiceId: c.id, invoiceNumber: c.invoice_number, level: out.level });

      if (autoHoldLevel !== null && out.level >= autoHoldLevel && c.customer_code) {
        await db.query(
          `update finance_customers set credit_hold = true, updated_at = now()
           where tenant_slug = $1 and customer_code = $2`,
          [input.tenantSlug, c.customer_code]
        );
        held.push(c.customer_code);
      }
    } catch (err: any) {
      errors.push({ invoiceId: c.id, error: err?.message ?? String(err) });
    }
  }
  return { examined: candidates.length, issued, held, errors };
}

export async function listDunningNotices(tenantSlug: string, invoiceId?: string) {
  await ensureCreditTables();
  return (await db.query<any>(
    `select * from dunning_notices where tenant_slug = $1
     ${invoiceId ? "and invoice_id = $2" : ""} order by issue_date desc`,
    invoiceId ? [tenantSlug, invoiceId] : [tenantSlug]
  )).rows;
}

// ---------------------------------------------------------------------------
// Customer statement — party subledger from canonical GL lines plus document
// detail (invoices/payments), with running balance.
// ---------------------------------------------------------------------------
export async function customerStatement(input: {
  tenantSlug: string;
  customerCode: string;
  startDate?: string;
  endDate?: string;
}) {
  const rows = (await db.query<any>(
    `select je.entry_date::date as entry_date,
            coalesce(je.journal_number, je.entry_number) as journal_number,
            je.id as entry_id, jel.description,
            coalesce(jel.debit_amount, jel.debit, 0)::float as debit,
            coalesce(jel.credit_amount, jel.credit, 0)::float as credit,
            je.reference_type, je.reference_id::text as reference_id
     from journal_entry_lines jel
     join journal_entries je
       on je.id = coalesce(jel.journal_entry_id, jel.entry_id)
     join chart_of_accounts coa
       on (jel.account_id is not null and coa.id::text = jel.account_id::text)
          or (jel.account_id is null
              and (coa.account_code = jel.account_code or coa.code = jel.account_code)
              and (coa.tenant_slug = je.tenant_slug or coa.tenant_slug is null))
     where je.tenant_slug = $1
       and coa.type in ('ASSET','asset')
       and coalesce(jel.party_type, '') = 'customer'
       and jel.party_id = $2
       and coalesce(je.approval_status, je.status, 'POSTED') not in ('DRAFT','REJECTED')
       and ($3::date is null or je.entry_date >= $3::date)
       and ($4::date is null or je.entry_date <= $4::date)
     order by je.entry_date, je.created_at`,
    [input.tenantSlug, input.customerCode,
     input.startDate ?? null, input.endDate ?? null]
  )).rows;

  let balance = 0;
  const lines = rows.map((r: any) => {
    balance += r.debit - r.credit;
    return { ...r, runningBalance: balance };
  });

  // Documents for context.
  const docs = (await db.query<any>(
    `select id, invoice_number, issued_date, due_date, amount::float,
            balance_due::float, status
     from finance_invoices
     where tenant_slug = $1 and customer_code = $2
     order by issued_date`,
    [input.tenantSlug, input.customerCode]
  )).rows;

  return {
    customerCode: input.customerCode,
    lines,
    closingBalance: balance,
    invoices: docs,
    openBalance: docs.reduce((s: number, d: any) =>
      s + (["sent", "partially_paid", "overdue"].includes(d.status) ? d.balance_due : 0), 0),
  };
}
