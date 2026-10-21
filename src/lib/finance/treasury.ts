import { randomUUID } from "crypto";
import { db, sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { postGLEntry, GL_ACCOUNTS } from "./gl";
import { upsertExchangeRate, ensureCurrencyTables } from "./currency";

// ---------------------------------------------------------------------------
// Treasury (ERPNext parity): bank reconciliation rules, bank guarantees,
// invoice discounting, subscription engine, automatic exchange-rate fetch.
// ---------------------------------------------------------------------------

export function ensureTreasuryTables() {
  return ensureOnce("finance/treasury:ensureTables", async () => {
    const sql = SQL;
    await sql`
      create table if not exists bank_recon_rules (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        name text not null,
        priority integer not null default 0,
        match_field text not null default 'description' check (match_field in ('description','reference')),
        pattern text not null,
        account_code text,
        party_type text check (party_type in ('customer','vendor')),
        party_id text,
        amount_tolerance numeric,
        active boolean not null default true,
        created_at timestamptz not null default now()
      )`;
    await sql`create index if not exists bank_recon_rules_idx on bank_recon_rules (tenant_slug, priority)`;

    await sql`
      create table if not exists bank_guarantees (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        direction text not null check (direction in ('issued','received')),
        beneficiary text not null,
        bank text not null,
        amount numeric not null,
        currency text not null default 'NGN',
        start_date date not null,
        end_date date not null,
        margin_amount numeric not null default 0,
        status text not null default 'open' check (status in ('open','claimed','released','expired')),
        journal_entry_id text,
        notes text,
        created_at timestamptz not null default now()
      )`;

    await sql`
      create table if not exists invoice_discountings (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        invoice_id text not null,
        bank text not null,
        loan_amount numeric not null,
        disbursement_date date not null,
        period_days integer not null default 90,
        status text not null default 'sanctioned' check (status in ('sanctioned','settled','closed')),
        journal_entry_id text,
        settled_date date,
        created_at timestamptz not null default now()
      )`;

    await sql`
      create table if not exists subscription_plans (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        name text not null,
        item text not null,
        unit_price numeric not null,
        qty numeric not null default 1,
        interval text not null default 'monthly' check (interval in ('daily','weekly','monthly','quarterly','yearly')),
        revenue_account_code text,
        active boolean not null default true,
        created_at timestamptz not null default now(),
        unique (tenant_slug, name)
      )`;
    await sql`
      create table if not exists subscriptions (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        customer_id text not null,
        plan_id uuid not null references subscription_plans (id) on delete cascade,
        start_date date not null,
        end_date date,
        next_invoice_date date not null,
        status text not null default 'active' check (status in ('active','paused','cancelled','ended')),
        party_account_code text,
        bank_account_code text,
        created_at timestamptz not null default now()
      )`;
    await sql`create index if not exists subscriptions_due_idx
      on subscriptions (tenant_slug, status, next_invoice_date)`;
    await sql`
      create table if not exists subscription_invoices (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        subscription_id uuid not null references subscriptions (id) on delete cascade,
        invoice_id text not null,
        period_start date not null,
        period_end date not null,
        amount numeric not null,
        created_at timestamptz not null default now(),
        unique (subscription_id, period_start)
      )`;

    await sql`alter table if exists exchange_rates add column if not exists source text not null default 'manual'`;
  });
}

// ─── Bank reconciliation rules ──────────────────────────────────────────────

export async function upsertBankReconRule(input: {
  tenantSlug: string; name: string; priority?: number;
  matchField?: "description" | "reference" | "counterparty"; pattern: string;
  accountCode?: string; partyType?: "customer" | "vendor"; partyId?: string;
  amountTolerance?: number; active?: boolean;
}) {
  await ensureTreasuryTables();
  const [row] = (await SQL`
    insert into bank_recon_rules (tenant_slug, name, priority, match_field, pattern, account_code, party_type, party_id, amount_tolerance, active)
    values (${input.tenantSlug}, ${input.name.trim()}, ${input.priority ?? 0}, ${input.matchField ?? "description"},
            ${input.pattern}, ${input.accountCode ?? null}, ${input.partyType ?? null}, ${input.partyId ?? null},
            ${input.amountTolerance ?? null}, ${input.active ?? true})
    returning *
  `) as any[];
  return row;
}

export async function listBankReconRules(tenantSlug: string) {
  await ensureTreasuryTables();
  return (await SQL`
    select * from bank_recon_rules where tenant_slug = ${tenantSlug} order by priority desc, created_at
  `) as any[];
}

/**
 * Applies reconciliation rules to unmatched statement lines. A rule whose
 * pattern matches the configured field yields a suggested account/party;
 * lines within amount_tolerance of an open document auto-match. Returns
 * per-line suggestions — callers still post via matchStatementLine.
 */
export async function applyReconRules(input: {
  tenantSlug: string; bankAccountCode?: string;
}): Promise<Array<{ lineId: string; rule: string; suggestion: any }>> {
  await ensureTreasuryTables();
  const rules = await listBankReconRules(input.tenantSlug);
  if (!rules.length) return [];

  const params: any[] = [input.tenantSlug];
  let where = `tenant_slug = $1 and status = 'unmatched'`;
  if (input.bankAccountCode) { params.push(input.bankAccountCode); where += ` and bank_account_code = $2`; }
  const { rows: lines } = await db.query(
    `select * from bank_statement_lines where ${where}`, params,
  );

  const out: Array<{ lineId: string; rule: string; suggestion: any }> = [];
  for (const line of lines as any[]) {
    for (const rule of rules) {
      const field = String(line[rule.match_field] ?? "");
      let re: RegExp;
      try { re = new RegExp(rule.pattern, "i"); } catch { continue; }
      if (!re.test(field)) continue;
      const suggestion: any = { matchedBy: rule.name };
      if (rule.account_code) suggestion.accountCode = rule.account_code;
      if (rule.party_id) suggestion.partyType = rule.party_type, suggestion.partyId = rule.party_id;

      // Amount-based document match within tolerance
      if (rule.party_type && rule.party_id) {
        const tol = Number(rule.amount_tolerance ?? 0);
        if (rule.party_type === "customer") {
          const { rows: docs } = await db.query(
            `select id, invoice_number doc_no, balance_due from finance_invoices
             where tenant_slug = $1 and (customer_id::text = $2 or customer_code = $2)
               and balance_due > 0 and status <> 'void'
               and abs(balance_due - $3) <= $4 order by issued_date limit 1`,
            [input.tenantSlug, rule.party_id, Math.abs(Number(line.amount)), tol],
          );
          if (docs[0]) suggestion.document = { type: "invoice", id: docs[0].id, docNo: docs[0].doc_no };
        } else {
          const { rows: docs } = await db.query(
            `select id, bill_number doc_no, balance_due from bills
             where tenant_slug = $1 and (vendor_id::text = $2 or vendor_name = $2)
               and balance_due > 0 and status <> 'void'
               and abs(balance_due - $3) <= $4 order by bill_date limit 1`,
            [input.tenantSlug, rule.party_id, Math.abs(Number(line.amount)), tol],
          );
          if (docs[0]) suggestion.document = { type: "bill", id: docs[0].id, docNo: docs[0].doc_no };
        }
      }
      out.push({ lineId: line.id, rule: rule.name, suggestion });
      break; // first matching rule wins
    }
  }
  return out;
}

// ─── Bank guarantees ────────────────────────────────────────────────────────

export async function issueBankGuarantee(input: {
  tenantSlug: string; direction: "issued" | "received";
  beneficiary: string; bank: string; amount: number; currency?: string;
  startDate: string; endDate: string; marginAmount?: number; notes?: string;
  userId?: string;
}) {
  await ensureTreasuryTables();
  let jeId: string | null = null;
  // Margin deposit for issued guarantees: Dr margin asset / Cr bank
  if (input.direction === "issued" && (input.marginAmount ?? 0) > 0) {
    const je = await postGLEntry({
      tenantSlug: input.tenantSlug,
      entryDate: input.startDate,
      journalType: "SYSTEM",
      referenceType: "bank_guarantee",
      referenceId: input.beneficiary,
      description: `Bank guarantee margin — ${input.bank} for ${input.beneficiary}`,
      createdBy: input.userId,
      lines: [
        { accountCode: "1560", debitAmount: input.marginAmount!, description: "Guarantee margin deposit" },
        { accountCode: GL_ACCOUNTS.BANK, creditAmount: input.marginAmount!, description: "Margin paid" },
      ],
    });
    jeId = je.id;
  }
  const [row] = (await SQL`
    insert into bank_guarantees (tenant_slug, direction, beneficiary, bank, amount, currency, start_date, end_date, margin_amount, journal_entry_id, notes)
    values (${input.tenantSlug}, ${input.direction}, ${input.beneficiary}, ${input.bank},
            ${input.amount}, ${input.currency ?? "NGN"}, ${input.startDate}, ${input.endDate},
            ${input.marginAmount ?? 0}, ${jeId}, ${input.notes ?? null})
    returning *
  `) as any[];
  return row;
}

export async function updateBankGuaranteeStatus(input: {
  tenantSlug: string; id: string; status: "open" | "claimed" | "released" | "expired";
}) {
  await ensureTreasuryTables();
  await SQL`
    update bank_guarantees set status = ${input.status}
    where id = ${input.id} and tenant_slug = ${input.tenantSlug}`;
}

export async function listBankGuarantees(tenantSlug: string, status?: string) {
  await ensureTreasuryTables();
  return (await SQL`
    select *, case when status = 'open' and end_date < current_date then true else false end expired
    from bank_guarantees
    where tenant_slug = ${tenantSlug}
      ${status ? SQL`and status = ${status}` : SQL``}
    order by end_date
  `) as any[];
}

// ─── Invoice discounting ────────────────────────────────────────────────────

/** Sanctions a short-term loan against an invoice: Dr Bank / Cr Short-term loan. */
export async function sanctionInvoiceDiscounting(input: {
  tenantSlug: string; invoiceId: string; bank: string; loanAmount: number;
  disbursementDate: string; periodDays?: number; userId?: string;
}) {
  await ensureTreasuryTables();
  const [inv] = (await SQL`
    select invoice_number, amount, balance_due from finance_invoices
    where id = ${input.invoiceId} and tenant_slug = ${input.tenantSlug}
  `) as any[];
  if (!inv) throw new Error("Invoice not found");
  if (input.loanAmount > Number(inv.amount)) {
    throw new Error("Loan exceeds invoice value");
  }
  const je = await postGLEntry({
    tenantSlug: input.tenantSlug,
    entryDate: input.disbursementDate,
    journalType: "SYSTEM",
    referenceType: "invoice_discounting",
    referenceId: input.invoiceId,
    description: `Invoice discounting ${inv.invoice_number} — ${input.bank}`,
    createdBy: input.userId,
    lines: [
      { accountCode: GL_ACCOUNTS.BANK, debitAmount: input.loanAmount, description: "Loan disbursement" },
      { accountCode: "2300", creditAmount: input.loanAmount, description: "Short-term loan payable" },
    ],
  });
  const [row] = (await SQL`
    insert into invoice_discountings (tenant_slug, invoice_id, bank, loan_amount, disbursement_date, period_days, journal_entry_id)
    values (${input.tenantSlug}, ${input.invoiceId}, ${input.bank}, ${input.loanAmount},
            ${input.disbursementDate}, ${input.periodDays ?? 90}, ${je.id})
    returning *
  `) as any[];
  return row;
}

/** Settles a discounted invoice facility (invoice paid → loan closed): Dr Loan / Cr Bank. */
export async function settleInvoiceDiscounting(input: {
  tenantSlug: string; id: string; settledDate: string; userId?: string;
}) {
  await ensureTreasuryTables();
  const [d] = (await SQL`
    select * from invoice_discountings where id = ${input.id} and tenant_slug = ${input.tenantSlug}
  `) as any[];
  if (!d) throw new Error("Discounting record not found");
  if (d.status !== "sanctioned") throw new Error("Facility already settled");
  await postGLEntry({
    tenantSlug: input.tenantSlug,
    entryDate: input.settledDate,
    journalType: "SYSTEM",
    referenceType: "invoice_discounting",
    referenceId: input.id,
    description: `Settle invoice discounting ${d.id} — ${d.bank}`,
    createdBy: input.userId,
    lines: [
      { accountCode: "2300", debitAmount: Number(d.loan_amount), description: "Loan principal repaid" },
      { accountCode: GL_ACCOUNTS.BANK, creditAmount: Number(d.loan_amount), description: "Repayment" },
    ],
  });
  await SQL`
    update invoice_discountings set status = 'settled', settled_date = ${input.settledDate}
    where id = ${input.id} and tenant_slug = ${input.tenantSlug}`;
}

export async function listInvoiceDiscountings(tenantSlug: string, status?: string) {
  await ensureTreasuryTables();
  return (await SQL`
    select d.*, i.invoice_number, i.amount invoice_amount
    from invoice_discountings d
    join finance_invoices i on i.id::text = d.invoice_id and i.tenant_slug = d.tenant_slug
    where d.tenant_slug = ${tenantSlug}
      ${status ? SQL`and d.status = ${status}` : SQL``}
    order by d.disbursement_date desc
  `) as any[];
}

// ─── Subscription engine ────────────────────────────────────────────────────

export async function upsertSubscriptionPlan(input: {
  tenantSlug: string; name: string; item: string; unitPrice: number; qty?: number;
  interval?: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  revenueAccountCode?: string; active?: boolean;
}) {
  await ensureTreasuryTables();
  const [row] = (await SQL`
    insert into subscription_plans (tenant_slug, name, item, unit_price, qty, interval, revenue_account_code, active)
    values (${input.tenantSlug}, ${input.name.trim()}, ${input.item}, ${input.unitPrice},
            ${input.qty ?? 1}, ${input.interval ?? "monthly"}, ${input.revenueAccountCode ?? null}, ${input.active ?? true})
    on conflict (tenant_slug, name) do update set
      item = excluded.item, unit_price = excluded.unit_price, qty = excluded.qty,
      interval = excluded.interval, revenue_account_code = excluded.revenue_account_code, active = excluded.active
    returning *
  `) as any[];
  return row;
}

export async function listSubscriptionPlans(tenantSlug: string) {
  await ensureTreasuryTables();
  return (await SQL`
    select * from subscription_plans where tenant_slug = ${tenantSlug} order by name
  `) as any[];
}

function addInterval(date: string, interval: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  switch (interval) {
    case "daily": d.setUTCDate(d.getUTCDate() + 1); break;
    case "weekly": d.setUTCDate(d.getUTCDate() + 7); break;
    case "monthly": d.setUTCMonth(d.getUTCMonth() + 1); break;
    case "quarterly": d.setUTCMonth(d.getUTCMonth() + 3); break;
    case "yearly": d.setUTCFullYear(d.getUTCFullYear() + 1); break;
  }
  return d.toISOString().slice(0, 10);
}

export async function createSubscription(input: {
  tenantSlug: string; customerId: string; planId: string; startDate: string; endDate?: string;
  partyAccountCode?: string; bankAccountCode?: string;
}) {
  await ensureTreasuryTables();
  const [row] = (await SQL`
    insert into subscriptions (tenant_slug, customer_id, plan_id, start_date, end_date, next_invoice_date, party_account_code, bank_account_code)
    values (${input.tenantSlug}, ${input.customerId}, ${input.planId}, ${input.startDate},
            ${input.endDate ?? null}, ${input.startDate}, ${input.partyAccountCode ?? null}, ${input.bankAccountCode ?? null})
    returning *
  `) as any[];
  return row;
}

export async function listSubscriptions(tenantSlug: string, status?: string) {
  await ensureTreasuryTables();
  return (await SQL`
    select s.*, p.name plan_name, p.interval, c.name customer_name
    from subscriptions s
    join subscription_plans p on p.id = s.plan_id
    left join finance_customers c on c.id::text = s.customer_id and c.tenant_slug = s.tenant_slug
    where s.tenant_slug = ${tenantSlug}
      ${status ? SQL`and s.status = ${status}` : SQL``}
    order by s.next_invoice_date
  `) as any[];
}

/**
 * Generates invoices for all subscriptions due on/before `asOf` — each posts
 * Dr AR / Cr revenue through the canonical GL and advances next_invoice_date.
 * Idempotent per period via the unique (subscription, period_start) key.
 */
export async function generateSubscriptionInvoices(input: {
  tenantSlug: string; asOf?: string; userId?: string;
}) {
  await ensureTreasuryTables();
  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);
  const due = (await SQL`
    select s.*, s.next_invoice_date::text next_invoice_date_txt, s.end_date::text end_date_txt,
           p.item, p.unit_price, p.qty, p.interval, p.revenue_account_code, p.name plan_name,
           c.name customer_name, c.customer_code, c.email customer_email
    from subscriptions s
    join subscription_plans p on p.id = s.plan_id
    left join finance_customers c on c.id::text = s.customer_id and c.tenant_slug = s.tenant_slug
    where s.tenant_slug = ${input.tenantSlug} and s.status = 'active'
      and s.next_invoice_date <= ${asOf}
      and (s.end_date is null or s.next_invoice_date <= s.end_date)
  `) as any[];

  const results: Array<{ subscriptionId: string; invoiceId: string; period: string; amount: number }> = [];
  const errors: Array<{ subscriptionId: string; error: string }> = [];
  for (const sub of due) {
    const periodStart = sub.next_invoice_date_txt;
    const periodEnd = addInterval(periodStart, sub.interval);
    const amount = Math.round(Number(sub.unit_price) * Number(sub.qty) * 100) / 100;
    try {
      const { insertFinanceInvoice } = await import("./db");
      const invoice = await insertFinanceInvoice({
        tenantSlug: input.tenantSlug,
        customerName: sub.customer_name ?? sub.customer_id,
        customerCode: sub.customer_code ?? undefined,
        customerId: sub.customer_id,
        customerEmail: sub.customer_email ?? undefined,
        invoiceNumber: `INV-SUB-${sub.id.slice(0, 8).toUpperCase()}-${periodStart.replace(/-/g, "")}`,
        issuedDate: periodStart,
        dueDate: periodEnd,
        amount,
        currency: "₦",
        status: "sent",
        lineItems: [{
          description: `${sub.plan_name} — ${periodStart} to ${periodEnd}`,
          quantity: Number(sub.qty),
          unitPrice: Number(sub.unit_price),
          accountCode: sub.revenue_account_code ?? undefined,
        }],
      });
      await SQL`
        insert into subscription_invoices (tenant_slug, subscription_id, invoice_id, period_start, period_end, amount)
        values (${input.tenantSlug}, ${sub.id}, ${invoice.id}, ${periodStart}, ${periodEnd}, ${amount})
        on conflict (subscription_id, period_start) do nothing`;
      const next = sub.end_date_txt && periodEnd > sub.end_date_txt ? null : periodEnd;
      await SQL`
        update subscriptions
        set next_invoice_date = ${next ?? periodEnd},
            status = ${next ? "active" : "ended"}
        where id = ${sub.id} and tenant_slug = ${input.tenantSlug}`;
      results.push({ subscriptionId: sub.id, invoiceId: invoice.id, period: periodStart, amount });
    } catch (e: any) {
      errors.push({ subscriptionId: sub.id, error: e?.message ?? String(e) });
    }
  }
  return { generated: results.length, invoices: results, errors };
}

// ─── Automatic exchange-rate fetch ─────────────────────────────────────────

const RATE_PROVIDER_URL =
  "https://open.er-api.com/v6/latest";

/**
 * Fetches rates from a free provider and upserts them into exchange_rates.
 * Provider returns foreign units per base unit — the same convention as
 * exchange_rates/toBase — so provider values are stored directly. Rows are
 * marked source='auto' to distinguish from manual overrides.
 */
export async function fetchAndStoreExchangeRates(input: {
  tenantSlug: string; baseCurrency?: string; currencies: string[];
  providerUrl?: string; fetchImpl?: typeof fetch;
}): Promise<{ stored: number; rates: Record<string, number>; errors: string[] }> {
  await ensureTreasuryTables();
  await ensureCurrencyTables();
  const base = (input.baseCurrency ?? "NGN").toUpperCase();
  const fetcher = input.fetchImpl ?? fetch;
  const url = `${input.providerUrl ?? RATE_PROVIDER_URL}/${base}`;
  const res = await fetcher(url);
  if (!res.ok) throw new Error(`Rate provider returned ${res.status}`);
  const payload = await res.json();
  const providerRates: Record<string, number> = payload?.rates ?? payload?.conversion_rates ?? {};
  if (!Object.keys(providerRates).length) throw new Error("Rate provider returned no rates");

  const stored: Record<string, number> = {};
  const errors: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  for (const cur of input.currencies.map((c) => c.toUpperCase())) {
    if (cur === base) continue;
    const rate = providerRates[cur];
    if (!rate) { errors.push(`${base}→${cur}: not in provider response`); continue; }
    await upsertExchangeRate({
      tenantSlug: input.tenantSlug,
      currency: cur,
      rateDate: today,
      rate,
    });
    stored[`${base}/${cur}`] = rate;
  }
  await SQL`
    update exchange_rates set source = 'auto'
    where tenant_slug = ${input.tenantSlug} and rate_date = ${today}`;
  return { stored: Object.keys(stored).length, rates: stored, errors };
}
