/**
 * Canonical General Ledger posting service.
 *
 * Single write path for ALL journal entries. Every poster (bills, payments,
 * invoices, payroll, stock, manufacturing, manual entries) goes through
 * postGLEntry(), which:
 *   - resolves the fiscal period for the posting date and refuses closed periods
 *   - validates double-entry balance
 *   - assigns a sequential, per-tenant journal number
 *   - writes BOTH the legacy columns (entry_number/entry_date/account_code) and
 *     the accounting-core columns (journal_number/posting_date/account_id) so
 *     every existing reader sees consistent data
 *   - maintains account_balances rollups
 *   - writes an audit record
 *   - runs inside a real DB transaction when the pg pool is available
 *
 * Schema is consolidated by db/migrations/20261016_gl_consolidation.sql; the
 * ensure function below is a defensive fallback for DBs that have not run it.
 */

import { randomUUID } from "crypto";
import { db, sql as SQL, SqlClient } from "../sql-client";
import { getPool } from "../db";
import { ensureOnce } from "@/lib/ensure-once";

export type GLAccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export const GL_ACCOUNTS = {
  CASH: "1110",
  BANK: "1100",
  CORPORATE_CARD: "1120",
  ACCOUNTS_RECEIVABLE: "1200",
  WIP_INVENTORY: "1300",
  FINISHED_GOODS: "1400",
  RAW_MATERIALS: "1500",
  PREPAID_EXPENSES: "1600",
  ACCOUNTS_PAYABLE: "2100",
  VAT_INPUT: "2200",
  VAT_OUTPUT: "2205",
  WHT_PAYABLE: "2210",
  PAYROLL_PAYABLE: "2300",
  PAYROLL_DEDUCTIONS: "2310",
  PAYE_PAYABLE: "2320",
  PENSION_PAYABLE: "2330",
  NHF_PAYABLE: "2340",
  LOYALTY_LIABILITY: "2350",
  GRNI: "2410",
  RETAINED_EARNINGS: "3100",
  SALES_REVENUE: "4000",
  SERVICE_REVENUE: "4100",
  COGS: "5000",
  GENERAL_EXPENSE: "6100",
  MATERIAL_VARIANCE: "6200",
  SALARIES_WAGES: "6300",
  PETTY_CASH: "1040",
  STAFF_ADVANCES: "1210",
  INTEREST_INCOME: "4500",
  DUNNING_FEE_INCOME: "4600",
  BANK_CHARGES: "6810",
  EXCHANGE_GAIN_LOSS: "7700",
  SALES_RETURNS: "4900",
  POS_OVERAGE: "4700",
  POS_SHORTAGE: "6210",
  LOYALTY_EXPENSE: "6830",
  INTERCO_RECEIVABLE: "1250",
  INTERCO_PAYABLE: "2150",
  ACCUMULATED_DEPRECIATION: "1700",
  CAPITAL_WIP: "1750",
  DEFERRED_EXPENSE: "1800",
  DEFERRED_REVENUE: "2400",
  REVALUATION_RESERVE: "3200",
  TEMPORARY_OPENING: "3300",
  DEPRECIATION_EXPENSE: "6400",
  REPAIRS_MAINTENANCE: "6450",
  GAIN_LOSS_DISPOSAL: "7600",
} as const;

const DEFAULT_GL_ACCOUNTS: Record<string, { code: string; name: string; type: GLAccountType }> = {
  [GL_ACCOUNTS.BANK]: { code: GL_ACCOUNTS.BANK, name: "Bank Account", type: "asset" },
  [GL_ACCOUNTS.CASH]: { code: GL_ACCOUNTS.CASH, name: "Cash", type: "asset" },
  [GL_ACCOUNTS.CORPORATE_CARD]: { code: GL_ACCOUNTS.CORPORATE_CARD, name: "Corporate Card", type: "liability" },
  [GL_ACCOUNTS.ACCOUNTS_RECEIVABLE]: { code: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE, name: "Accounts Receivable", type: "asset" },
  [GL_ACCOUNTS.WIP_INVENTORY]: { code: GL_ACCOUNTS.WIP_INVENTORY, name: "Work In Progress", type: "asset" },
  [GL_ACCOUNTS.FINISHED_GOODS]: { code: GL_ACCOUNTS.FINISHED_GOODS, name: "Finished Goods Inventory", type: "asset" },
  [GL_ACCOUNTS.RAW_MATERIALS]: { code: GL_ACCOUNTS.RAW_MATERIALS, name: "Raw Materials Inventory", type: "asset" },
  [GL_ACCOUNTS.PREPAID_EXPENSES]: { code: GL_ACCOUNTS.PREPAID_EXPENSES, name: "Prepaid Expenses", type: "asset" },
  [GL_ACCOUNTS.ACCOUNTS_PAYABLE]: { code: GL_ACCOUNTS.ACCOUNTS_PAYABLE, name: "Accounts Payable", type: "liability" },
  [GL_ACCOUNTS.VAT_INPUT]: { code: GL_ACCOUNTS.VAT_INPUT, name: "VAT Input Tax", type: "asset" },
  [GL_ACCOUNTS.VAT_OUTPUT]: { code: GL_ACCOUNTS.VAT_OUTPUT, name: "VAT Output Tax", type: "liability" },
  [GL_ACCOUNTS.WHT_PAYABLE]: { code: GL_ACCOUNTS.WHT_PAYABLE, name: "Withholding Tax Payable", type: "liability" },
  [GL_ACCOUNTS.PAYROLL_PAYABLE]: { code: GL_ACCOUNTS.PAYROLL_PAYABLE, name: "Payroll Payable", type: "liability" },
  [GL_ACCOUNTS.PAYROLL_DEDUCTIONS]: { code: GL_ACCOUNTS.PAYROLL_DEDUCTIONS, name: "Payroll Deductions Payable", type: "liability" },
  [GL_ACCOUNTS.PAYE_PAYABLE]: { code: GL_ACCOUNTS.PAYE_PAYABLE, name: "PAYE Tax Payable", type: "liability" },
  [GL_ACCOUNTS.PENSION_PAYABLE]: { code: GL_ACCOUNTS.PENSION_PAYABLE, name: "Pension Contributions Payable", type: "liability" },
  [GL_ACCOUNTS.NHF_PAYABLE]: { code: GL_ACCOUNTS.NHF_PAYABLE, name: "NHF Contributions Payable", type: "liability" },
  [GL_ACCOUNTS.LOYALTY_LIABILITY]: { code: GL_ACCOUNTS.LOYALTY_LIABILITY, name: "Loyalty Points Liability", type: "liability" },
  [GL_ACCOUNTS.GRNI]: { code: GL_ACCOUNTS.GRNI, name: "Goods Received Not Invoiced", type: "liability" },
  [GL_ACCOUNTS.LOYALTY_EXPENSE]: { code: GL_ACCOUNTS.LOYALTY_EXPENSE, name: "Loyalty Discount Expense", type: "expense" },
  [GL_ACCOUNTS.RETAINED_EARNINGS]: { code: GL_ACCOUNTS.RETAINED_EARNINGS, name: "Retained Earnings", type: "equity" },
  [GL_ACCOUNTS.SALES_REVENUE]: { code: GL_ACCOUNTS.SALES_REVENUE, name: "Sales Revenue", type: "revenue" },
  [GL_ACCOUNTS.SERVICE_REVENUE]: { code: GL_ACCOUNTS.SERVICE_REVENUE, name: "Service Revenue", type: "revenue" },
  [GL_ACCOUNTS.COGS]: { code: GL_ACCOUNTS.COGS, name: "Cost of Goods Sold", type: "expense" },
  [GL_ACCOUNTS.GENERAL_EXPENSE]: { code: GL_ACCOUNTS.GENERAL_EXPENSE, name: "General Expenses", type: "expense" },
  [GL_ACCOUNTS.MATERIAL_VARIANCE]: { code: GL_ACCOUNTS.MATERIAL_VARIANCE, name: "Material Variance", type: "expense" },
  [GL_ACCOUNTS.SALARIES_WAGES]: { code: GL_ACCOUNTS.SALARIES_WAGES, name: "Salaries & Wages", type: "expense" },
  [GL_ACCOUNTS.PETTY_CASH]: { code: GL_ACCOUNTS.PETTY_CASH, name: "Petty Cash / Imprest", type: "asset" },
  [GL_ACCOUNTS.STAFF_ADVANCES]: { code: GL_ACCOUNTS.STAFF_ADVANCES, name: "Staff Advances", type: "asset" },
  [GL_ACCOUNTS.INTEREST_INCOME]: { code: GL_ACCOUNTS.INTEREST_INCOME, name: "Interest Income", type: "revenue" },
  [GL_ACCOUNTS.DUNNING_FEE_INCOME]: { code: GL_ACCOUNTS.DUNNING_FEE_INCOME, name: "Dunning & Fee Income", type: "revenue" },
  [GL_ACCOUNTS.BANK_CHARGES]: { code: GL_ACCOUNTS.BANK_CHARGES, name: "Bank Charges & Fees", type: "expense" },
  [GL_ACCOUNTS.EXCHANGE_GAIN_LOSS]: { code: GL_ACCOUNTS.EXCHANGE_GAIN_LOSS, name: "Realized Exchange Gain/Loss", type: "expense" },
  [GL_ACCOUNTS.SALES_RETURNS]: { code: GL_ACCOUNTS.SALES_RETURNS, name: "Sales Returns & Allowances", type: "revenue" },
  [GL_ACCOUNTS.POS_OVERAGE]: { code: GL_ACCOUNTS.POS_OVERAGE, name: "POS Cash Overage", type: "revenue" },
  [GL_ACCOUNTS.POS_SHORTAGE]: { code: GL_ACCOUNTS.POS_SHORTAGE, name: "POS Cash Shortage", type: "expense" },
  [GL_ACCOUNTS.INTERCO_RECEIVABLE]: { code: GL_ACCOUNTS.INTERCO_RECEIVABLE, name: "Intercompany Receivable", type: "asset" },
  [GL_ACCOUNTS.INTERCO_PAYABLE]: { code: GL_ACCOUNTS.INTERCO_PAYABLE, name: "Intercompany Payable", type: "liability" },
  [GL_ACCOUNTS.ACCUMULATED_DEPRECIATION]: { code: GL_ACCOUNTS.ACCUMULATED_DEPRECIATION, name: "Accumulated Depreciation", type: "asset" },
  [GL_ACCOUNTS.CAPITAL_WIP]: { code: GL_ACCOUNTS.CAPITAL_WIP, name: "Capital Work In Progress", type: "asset" },
  [GL_ACCOUNTS.DEFERRED_EXPENSE]: { code: GL_ACCOUNTS.DEFERRED_EXPENSE, name: "Deferred Expense (Prepaid Costs)", type: "asset" },
  [GL_ACCOUNTS.DEFERRED_REVENUE]: { code: GL_ACCOUNTS.DEFERRED_REVENUE, name: "Deferred Revenue (Unearned Income)", type: "liability" },
  [GL_ACCOUNTS.REVALUATION_RESERVE]: { code: GL_ACCOUNTS.REVALUATION_RESERVE, name: "Revaluation Reserve", type: "equity" },
  [GL_ACCOUNTS.TEMPORARY_OPENING]: { code: GL_ACCOUNTS.TEMPORARY_OPENING, name: "Temporary Opening", type: "equity" },
  [GL_ACCOUNTS.DEPRECIATION_EXPENSE]: { code: GL_ACCOUNTS.DEPRECIATION_EXPENSE, name: "Depreciation Expense", type: "expense" },
  [GL_ACCOUNTS.REPAIRS_MAINTENANCE]: { code: GL_ACCOUNTS.REPAIRS_MAINTENANCE, name: "Repairs & Maintenance", type: "expense" },
  [GL_ACCOUNTS.GAIN_LOSS_DISPOSAL]: { code: GL_ACCOUNTS.GAIN_LOSS_DISPOSAL, name: "Gain/Loss on Asset Disposal", type: "expense" },
};

export type GLPartyType = "customer" | "vendor" | "employee" | "other";

export type GLLineInput = {
  accountCode?: string;
  accountId?: string;
  debitAmount?: number;
  creditAmount?: number;
  description?: string;
  partyType?: GLPartyType;
  partyId?: string;
  branchId?: string;
  departmentId?: string;
  projectId?: string;
  costCenterId?: string;
  /** Tenant-defined custom dimensions (see accounting_dimensions). */
  dimensions?: Record<string, string>;
};

export type GLJournalType = "MANUAL" | "SYSTEM" | "ADJUSTMENT" | "REVERSING" | "CLOSING";

export type PostGLEntryInput = {
  tenantSlug: string;
  entryDate: string | Date;
  journalType?: GLJournalType;
  referenceType?: string;
  referenceId?: string;
  description: string;
  notes?: string;
  status?: "POSTED" | "DRAFT";
  createdBy?: string;
  metadata?: Record<string, unknown>;
  /** Document-level branch: applied to lines that don't set their own. */
  branchId?: string;
  /** Parallel ledger book (ERPNext "Finance Book"); default 'main'. */
  financeBook?: string;
  lines: GLLineInput[];
};

export type GLEntryResult = {
  id: string;
  journalNumber: string;
  entryNumber: string;
  entryDate: string;
  journalType: GLJournalType;
  referenceType?: string;
  referenceId?: string;
  description: string;
  totalDebit: number;
  totalCredit: number;
  status: string;
  fiscalPeriodId?: string;
  lines: Array<{
    id: string;
    accountId: string | null;
    accountCode: string | null;
    accountName: string | null;
    debitAmount: number;
    creditAmount: number;
    description?: string;
  }>;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Lightweight ensure — defensive fallback; canonical schema lives in
// db/migrations/20261016_gl_consolidation.sql
// ---------------------------------------------------------------------------
export function ensureGLTables() {
  return ensureOnce("finance/gl:ensureGLTables", ensureGLTablesRun);
}

async function ensureGLTablesRun() {
  const sql = SQL;
  try {
    await sql`create table if not exists journal_entries (
      id uuid primary key default gen_random_uuid(),
      tenant_slug text,
      journal_number text,
      entry_number text,
      journal_type text default 'SYSTEM',
      fiscal_period_id uuid,
      posting_date date,
      entry_date date,
      reference_type text,
      reference_id text,
      description text,
      notes text,
      metadata jsonb,
      status text,
      approval_status text,
      total_debit numeric(18,2) not null default 0,
      total_credit numeric(18,2) not null default 0,
      is_reversing boolean not null default false,
      reversed_entry_id uuid,
      created_by text,
      posted_at timestamptz,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )`;
    await sql`alter table if exists journal_entries add column if not exists tenant_slug text`;
    await sql`alter table if exists journal_entries add column if not exists journal_number text`;
    await sql`alter table if exists journal_entries add column if not exists entry_number text`;
    await sql`alter table if exists journal_entries add column if not exists posting_date date`;
    await sql`alter table if exists journal_entries add column if not exists entry_date date`;
    await sql`alter table if exists journal_entries add column if not exists journal_type text`;
    await sql`alter table if exists journal_entries add column if not exists fiscal_period_id uuid`;
    await sql`alter table if exists journal_entries add column if not exists approval_status text`;
    await sql`alter table if exists journal_entries add column if not exists status text`;
    await sql`alter table if exists journal_entries add column if not exists total_debit numeric(18,2) default 0`;
    await sql`alter table if exists journal_entries add column if not exists total_credit numeric(18,2) default 0`;
    await sql`alter table if exists journal_entries add column if not exists is_reversing boolean default false`;
    await sql`alter table if exists journal_entries add column if not exists reversed_entry_id uuid`;
    await sql`alter table if exists journal_entries add column if not exists posted_at timestamptz`;
    try {
      // Legacy reference_id / created_by columns are uuid; canonical callers pass text
      await sql`alter table if exists journal_entries alter column reference_id type text using reference_id::text`;
    } catch {
      /* column missing or already text */
    }
    try {
      await sql`alter table if exists journal_entries alter column created_by type text using created_by::text`;
    } catch {
      /* column missing or already text */
    }
    try {
      await sql`alter table if exists journal_entries drop constraint if exists journal_entries_reference_type_check`;
      await sql`alter table if exists journal_entries drop constraint if exists journal_entries_journal_type_check`;
      await sql`alter table if exists journal_entries drop constraint if exists journal_entries_approval_status_check`;
      await sql`alter table if exists fiscal_periods drop constraint if exists fiscal_periods_status_check`;
      await sql`alter table if exists fiscal_periods drop constraint if exists fiscal_periods_period_number_check`;
    } catch {
      /* constraints absent */
    }

    await sql`create table if not exists journal_entry_lines (
      id uuid primary key default gen_random_uuid(),
      entry_id uuid,
      account_code text,
      account_name text,
      debit_amount numeric(18,2) not null default 0,
      credit_amount numeric(18,2) not null default 0,
      description text,
      metadata jsonb,
      created_at timestamptz not null default now()
    )`;
    await sql`alter table if exists journal_entry_lines add column if not exists journal_entry_id uuid`;
    await sql`alter table if exists journal_entry_lines add column if not exists line_number integer`;
    await sql`alter table if exists journal_entry_lines add column if not exists account_id uuid`;
    await sql`alter table if exists journal_entry_lines add column if not exists debit numeric(18,2) default 0`;
    await sql`alter table if exists journal_entry_lines add column if not exists credit numeric(18,2) default 0`;
    await sql`alter table if exists journal_entry_lines add column if not exists party_type text`;
    await sql`alter table if exists journal_entry_lines add column if not exists party_id text`;
    await sql`alter table if exists journal_entry_lines add column if not exists branch_id text`;
    await sql`alter table if exists journal_entry_lines add column if not exists department_id text`;
    await sql`alter table if exists journal_entry_lines add column if not exists project_id text`;
    await sql`alter table if exists journal_entry_lines add column if not exists cost_center_id text`;
    try {
      // Dimension columns are uuid on some schema generations; callers pass
      // arbitrary text ids (branches, cost centers), so normalize to text.
      for (const col of ["branch_id", "department_id", "project_id", "cost_center_id"]) {
        await db.query(
          `alter table journal_entry_lines alter column ${col} type text using ${col}::text`
        ).catch(() => undefined);
      }
    } catch {
      /* columns missing or already text */
    }

    await sql`create table if not exists fiscal_periods (
      id uuid primary key default gen_random_uuid(),
      tenant_slug text,
      fiscal_year integer,
      period_number integer,
      period_name text,
      name text,
      period_type text default 'month',
      start_date date,
      end_date date,
      status text default 'open',
      allow_posting boolean default true,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )`;
    await sql`alter table if exists fiscal_periods add column if not exists allow_posting boolean default true`;
    await sql`alter table if exists fiscal_periods add column if not exists closed_at timestamptz`;

    await sql`create table if not exists account_balances (
      id uuid primary key default gen_random_uuid(),
      tenant_slug text,
      account_id uuid,
      fiscal_period_id uuid,
      opening_balance numeric(18,2) not null default 0,
      period_debit numeric(18,2) not null default 0,
      period_credit numeric(18,2) not null default 0,
      last_updated timestamptz default now()
    )`;
    await sql`alter table if exists account_balances add column if not exists tenant_slug text`;
    try {
      await sql`create unique index if not exists account_balances_account_period_uq on account_balances (account_id, fiscal_period_id)`;
    } catch {
      /* duplicates exist; fall through */
    }

    await sql`alter table if exists journal_entries add column if not exists finance_book text not null default 'main'`;

    // Tenant-defined accounting dimensions (ERPNext Accounting Dimension):
    // arbitrary analytical tags validated on posting when marked required for
    // a voucher type. Values ride in journal_entry_lines.dimensions.
    await sql`create table if not exists accounting_dimensions (
      id uuid primary key default gen_random_uuid(),
      tenant_slug text not null,
      dimension_key text not null,
      label text not null,
      required_for jsonb not null default '[]'::jsonb,
      allowed_values jsonb,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      unique (tenant_slug, dimension_key)
    )`;
    await sql`alter table if exists journal_entry_lines add column if not exists dimensions jsonb`;

    await sql`create table if not exists journal_sequences (
      tenant_slug text not null,
      prefix text not null,
      fiscal_year integer not null,
      last_number integer not null default 0,
      updated_at timestamptz not null default now(),
      primary key (tenant_slug, prefix, fiscal_year)
    )`;

    await sql`create table if not exists accounting_audit_log (
      id uuid primary key default gen_random_uuid(),
      tenant_slug text,
      entity_type text not null,
      entity_id text,
      action text not null,
      changed_fields jsonb,
      old_values jsonb,
      new_values jsonb,
      user_id text,
      timestamp timestamptz default now()
    )`;

    await sql`create table if not exists payment_applications (
      id uuid primary key default gen_random_uuid(),
      tenant_slug text not null,
      payment_id text not null,
      invoice_id text not null,
      amount numeric(18,2) not null,
      created_at timestamptz not null default now()
    )`;
    await sql`create index if not exists payment_applications_payment_idx on payment_applications (payment_id)`;
    await sql`create index if not exists payment_applications_invoice_idx on payment_applications (invoice_id)`;

    // Branch master (canonical schema: 20261102_tenant_branches.sql)
    await sql`create table if not exists tenant_branches (
      id text primary key,
      tenant_slug text not null,
      code text,
      name text not null,
      kind text not null default 'branch',
      parent_branch_id text,
      status text not null default 'active',
      org_node_id text,
      metadata jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`;
  } catch (error) {
    console.error("ensureGLTables failed:", error);
  }
}

// ---------------------------------------------------------------------------
// Executor: transaction over the pg pool, best-effort sequential fallback
// ---------------------------------------------------------------------------
type QueryFn = (text: string, params?: any[]) => Promise<any[]>;

async function withTransaction<T>(fn: (q: QueryFn) => Promise<T>): Promise<T> {
  const pool = getPool();
  if (!pool) {
    const q: QueryFn = async (text, params) => (await db.query(text, params)).rows;
    return fn(q);
  }
  const client = await pool.connect();
  const q: QueryFn = async (text, params) => (await client.query(text, params || [])).rows;
  try {
    await client.query("BEGIN");
    const result = await fn(q);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* connection may be broken */
    }
    throw error;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Account resolution
// ---------------------------------------------------------------------------
export type ResolvedAccount = {
  id: string;
  code: string;
  name: string;
  type: GLAccountType;
};

function guessAccountType(code: string): GLAccountType {
  const first = code.charAt(0);
  if (first === "1") return "asset";
  if (first === "2") return "liability";
  if (first === "3") return "equity";
  if (first === "4") return "revenue";
  return "expense";
}

async function ensureGLAccount(
  q: QueryFn,
  tenantSlug: string,
  code: string
): Promise<ResolvedAccount> {
  const found = await q(
    `select id, coalesce(code, account_code) as code, coalesce(name, account_name) as name,
            coalesce(lower(type), lower(account_type)) as type
     from chart_of_accounts
     where coalesce(code, account_code) = $1
       and (tenant_slug = $2 or tenant_slug is null)
     order by tenant_slug nulls first
     limit 1`,
    [code, tenantSlug]
  );
  if (found.length) {
    return {
      id: found[0].id,
      code: found[0].code,
      name: found[0].name,
      type: found[0].type === "income" ? "revenue" : found[0].type,
    };
  }

  const known = DEFAULT_GL_ACCOUNTS[code];
  const name = known?.name ?? `Account ${code}`;
  const type = known?.type ?? guessAccountType(code);
  const accountTypeUpper = type === "revenue" ? "INCOME" : type.toUpperCase();
  const id = randomUUID();

  let currency = "NGN";
  try {
    const t = await q(
      `select coalesce(settings->>'baseCurrency', settings->>'currency') as c
       from tenants where slug = $1`,
      [tenantSlug]
    );
    if (t[0]?.c) currency = t[0].c;
  } catch {
    /* tenants table unreadable — fall back to NGN */
  }

  await q(
    `insert into chart_of_accounts (
       id, tenant_slug, code, name, type,
       account_code, account_name, account_type,
       currency, is_active, is_system_account, created_at, updated_at
     ) values ($1, null, $2, $3, $4, $2, $3, $5, $6, true, true, now(), now())
     on conflict do nothing`,
    [id, code, name, type, accountTypeUpper, currency]
  );

  return { id, code, name, type };
}

async function resolveAccounts(
  q: QueryFn,
  tenantSlug: string,
  lines: GLLineInput[]
): Promise<Map<number, ResolvedAccount>> {
  const map = new Map<number, ResolvedAccount>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.accountId) {
      const rows = await q(
        `select id, coalesce(code, account_code) as code, coalesce(name, account_name) as name,
                coalesce(lower(type), lower(account_type)) as type
         from chart_of_accounts where id::text = $1 limit 1`,
        [line.accountId]
      );
      if (rows.length) {
        map.set(i, {
          id: rows[0].id,
          code: rows[0].code,
          name: rows[0].name,
          type: rows[0].type === "income" ? "revenue" : rows[0].type,
        });
        continue;
      }
    }
    if (!line.accountCode) {
      throw new Error(`Journal line ${i + 1} has no accountCode or accountId`);
    }
    map.set(i, await ensureGLAccount(q, tenantSlug, line.accountCode));
  }
  return map;
}

// ---------------------------------------------------------------------------
// Branch dimension: resolve line/document branch references to canonical
// tenant_branches ids, validate them, and apply the tenant default.
// ---------------------------------------------------------------------------
async function resolveLineBranches(
  q: QueryFn,
  tenantSlug: string,
  lines: GLLineInput[],
  documentBranchId?: string
): Promise<Array<string | null>> {
  const { resolveBranchIds, getDefaultBranchId } = await import("./branches");
  const raw = lines.map((l) => l.branchId ?? documentBranchId ?? null);
  const resolved = await resolveBranchIds(tenantSlug, raw, q);
  const defaultBranch = await getDefaultBranchId(tenantSlug, q);
  return raw.map((_, i) => resolved.get(i) ?? defaultBranch);
}

// ---------------------------------------------------------------------------
// Fiscal periods
// ---------------------------------------------------------------------------
type FiscalPeriodRow = {
  id: string;
  status: string | null;
  allow_posting: boolean | null;
};

function toDateString(d: string | Date): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return d.slice(0, 10);
}

async function resolveFiscalPeriod(
  q: QueryFn,
  tenantSlug: string,
  postingDate: string
): Promise<FiscalPeriodRow> {
  const existing = await q(
    `select id, status, allow_posting from fiscal_periods
     where tenant_slug = $1 and start_date <= $2 and end_date >= $2
     order by start_date desc limit 1`,
    [tenantSlug, postingDate]
  );

  if (existing.length) {
    const p = existing[0];
    const status = (p.status || "open").toUpperCase();
    if (status === "CLOSED" || status === "LOCKED" || p.allow_posting === false) {
      throw new Error(
        `Cannot post to fiscal period covering ${postingDate}: period is ${status.toLowerCase()}`
      );
    }
    return p;
  }

  // Auto-create the monthly period covering the posting date
  const d = new Date(postingDate);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
  const id = randomUUID();

  await q(
    `insert into fiscal_periods (
       id, tenant_slug, fiscal_year, period_number, period_name, name,
       period_type, start_date, end_date, status, allow_posting, created_at, updated_at
     ) values ($1, $2, $3, $4, $5, $5, 'month', $6, $7, 'open', true, now(), now())`,
    [id, tenantSlug, year, month + 1, `FY${year}-P${month + 1}`, start, end]
  );

  return { id, status: "open", allow_posting: true };
}

// ---------------------------------------------------------------------------
// Journal numbering
// ---------------------------------------------------------------------------
async function nextJournalNumber(
  q: QueryFn,
  tenantSlug: string,
  prefix: string,
  fiscalYear: number
): Promise<string> {
  const rows = await q(
    `insert into journal_sequences (tenant_slug, prefix, fiscal_year, last_number, updated_at)
     values ($1, $2, $3, 1, now())
     on conflict (tenant_slug, prefix, fiscal_year)
     do update set last_number = journal_sequences.last_number + 1, updated_at = now()
     returning last_number`,
    [tenantSlug, prefix, fiscalYear]
  );
  const seq = rows[0]?.last_number ?? 1;
  return `${prefix}-${fiscalYear}-${String(seq).padStart(5, "0")}`;
}

// ---------------------------------------------------------------------------
// Core poster
// ---------------------------------------------------------------------------
export async function postGLEntry(input: PostGLEntryInput): Promise<GLEntryResult> {
  await ensureGLTables();

  const status = input.status ?? "POSTED";
  const journalType = input.journalType ?? "SYSTEM";
  const postingDate = toDateString(input.entryDate);

  const totalDebit = input.lines.reduce((s, l) => s + (l.debitAmount ?? 0), 0);
  const totalCredit = input.lines.reduce((s, l) => s + (l.creditAmount ?? 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(
      `Journal entry must balance. Debits: ${totalDebit}, Credits: ${totalCredit}`
    );
  }
  if (!input.lines.length) {
    throw new Error("Journal entry requires at least one line");
  }

  // Accounts-frozen cutoff (finance_settings): postings dated on/before the
  // frozen boundary are rejected even inside open fiscal periods.
  {
    const { rows: fs } = await db.query(
      `select accounts_frozen_until from finance_settings where tenant_slug = $1`,
      [input.tenantSlug],
    ).catch(() => ({ rows: [] }));
    const frozen = (fs as any[])[0]?.accounts_frozen_until;
    if (frozen && postingDate <= new Date(frozen).toISOString().slice(0, 10)) {
      throw new Error(
        `Books are frozen until ${new Date(frozen).toISOString().slice(0, 10)} — posting date ${postingDate} is closed`,
      );
    }
  }

  // Tenant-defined dimension enforcement: dimensions marked required for this
  // voucher type must be present (and within allowed_values) on every line.
  if (input.referenceType) {
    const { rows: dims } = await db.query(
      `select dimension_key, label, allowed_values from accounting_dimensions
       where tenant_slug = $1 and active and required_for @> $2::jsonb`,
      [input.tenantSlug, JSON.stringify([input.referenceType])],
    ).catch(() => ({ rows: [] }));
    for (const dim of dims as any[]) {
      const allowed = Array.isArray(dim.allowed_values) ? dim.allowed_values.map(String) : null;
      input.lines.forEach((line, i) => {
        const v = line.dimensions?.[dim.dimension_key];
        if (v === undefined || v === null || v === "") {
          throw new Error(
            `Line ${i + 1}: required accounting dimension "${dim.label}" (${dim.dimension_key}) is missing`,
          );
        }
        if (allowed && !allowed.includes(String(v))) {
          throw new Error(
            `Line ${i + 1}: value "${v}" is not allowed for dimension "${dim.label}"`,
          );
        }
      });
    }
  }

  // Cost center allocation: lines tagged with a cost center that has a split
  // rule are expanded into per-center shares before posting.
  try {
    const { applyCostCenterAllocations } = await import("./erp-tools");
    input = { ...input, lines: await applyCostCenterAllocations(input.tenantSlug, input.lines) };
  } catch { /* allocation rules optional */ }

  return withTransaction(async (q) => {
    const period = await resolveFiscalPeriod(q, input.tenantSlug, postingDate);
    const accountMap = await resolveAccounts(q, input.tenantSlug, input.lines);
    const branchIds = await resolveLineBranches(q, input.tenantSlug, input.lines, input.branchId);
    const fiscalYear = new Date(postingDate).getUTCFullYear();
    const journalNumber = await nextJournalNumber(q, input.tenantSlug, "JV", fiscalYear);
    const entryId = randomUUID();

    await q(
      `insert into journal_entries (
         id, tenant_slug, journal_number, entry_number, journal_type,
         fiscal_period_id, posting_date, entry_date,
         reference_type, reference_id, total_debit, total_credit,
         description, notes, metadata, approval_status, status,
         created_by, finance_book, created_at, updated_at, posted_at
       ) values (
         $1, $2, $3, $3, $4, $5, $6, $6,
         $7, $8, $9, $10,
         $11, $12, $13, $14, lower($14),
         $15, $16, now(), now(), case when $14 = 'POSTED' then now() else null end
       )`,
      [
        entryId,
        input.tenantSlug,
        journalNumber,
        journalType,
        period.id,
        postingDate,
        input.referenceType ?? "manual",
        input.referenceId ?? null,
        totalDebit,
        totalCredit,
        input.description,
        input.notes ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
        status,
        input.createdBy ?? null,
        input.financeBook ?? "main",
      ]
    );

    const resultLines: GLEntryResult["lines"] = [];
    for (let i = 0; i < input.lines.length; i++) {
      const line = input.lines[i];
      const account = accountMap.get(i)!;
      const lineId = randomUUID();
      const debit = line.debitAmount ?? 0;
      const credit = line.creditAmount ?? 0;

      await q(
        `insert into journal_entry_lines (
           id, entry_id, journal_entry_id, line_number,
           account_id, account_code, account_name,
           debit_amount, credit_amount, debit, credit,
           party_type, party_id,
           branch_id, department_id, project_id, cost_center_id,
           dimensions, description, created_at
         ) values (
           $1, $2, $2, $3,
           $4, $5, $6,
           $7, $8, $7, $8,
           $9, $10,
           $11, $12, $13, $14,
           $15, $16, now()
         )`,
        [
          lineId,
          entryId,
          i + 1,
          account.id,
          account.code,
          account.name,
          debit,
          credit,
          line.partyType ?? null,
          line.partyId ?? null,
          branchIds[i],
          line.departmentId ?? null,
          line.projectId ?? null,
          line.costCenterId ?? null,
          line.dimensions ? JSON.stringify(line.dimensions) : null,
          line.description ?? null,
        ]
      );

      resultLines.push({
        id: lineId,
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        debitAmount: debit,
        creditAmount: credit,
        description: line.description,
      });

      if (status === "POSTED") {
        await updateAccountBalance(q, input.tenantSlug, account.id, period.id, debit, credit);
      }
    }

    await q(
      `insert into accounting_audit_log (
         id, tenant_slug, entity_type, entity_id, action, new_values, user_id, timestamp
       ) values ($1, $2, 'JOURNAL_ENTRY', $3, 'POST', $4, $5, now())`,
      [
        randomUUID(),
        input.tenantSlug,
        entryId,
        JSON.stringify({ journalNumber, journalType, totalDebit, totalCredit, status }),
        input.createdBy ?? null,
      ]
    );

    return {
      id: entryId,
      journalNumber,
      entryNumber: journalNumber,
      entryDate: postingDate,
      journalType,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      description: input.description,
      totalDebit,
      totalCredit,
      status,
      fiscalPeriodId: period.id,
      lines: resultLines,
      createdAt: new Date().toISOString(),
    };
  });
}

async function updateAccountBalance(
  q: QueryFn,
  tenantSlug: string,
  accountId: string,
  periodId: string,
  debit: number,
  credit: number
): Promise<void> {
  const existing = await q(
    `select id from account_balances where account_id = $1 and fiscal_period_id = $2 limit 1`,
    [accountId, periodId]
  );
  if (existing.length) {
    await q(
      `update account_balances
       set period_debit = period_debit + $2,
           period_credit = period_credit + $3,
           last_updated = now()
       where id = $1`,
      [existing[0].id, debit, credit]
    );
  } else {
    await q(
      `insert into account_balances (id, tenant_slug, account_id, fiscal_period_id, opening_balance, period_debit, period_credit, last_updated)
       values ($1, $2, $3, $4, 0, $5, $6, now())`,
      [randomUUID(), tenantSlug, accountId, periodId, debit, credit]
    );
  }
}

// ---------------------------------------------------------------------------
// Reversal
// ---------------------------------------------------------------------------
export async function reverseGLEntry(
  entryId: string,
  reason: string,
  userId?: string
): Promise<GLEntryResult> {
  await ensureGLTables();

  const entries = (await db.query<any>(
    `select * from journal_entries where id = $1`,
    [entryId]
  )).rows;
  if (!entries.length) {
    throw new Error(`Journal entry ${entryId} not found`);
  }
  const original = entries[0];
  if (original.is_reversing || original.reversed_entry_id) {
    throw new Error(`Journal entry ${entryId} has already been reversed`);
  }

  const lines = (await db.query<any>(
    `select * from journal_entry_lines where entry_id = $1 order by line_number nulls last, created_at`,
    [entryId]
  )).rows;

  const reversal = await postGLEntry({
    tenantSlug: original.tenant_slug,
    entryDate: new Date(),
    journalType: "REVERSING",
    referenceType: original.reference_type ?? "reversal",
    referenceId: entryId,
    description: `Reversal of ${original.journal_number ?? original.entry_number ?? entryId}`,
    notes: reason,
    status: "POSTED",
    createdBy: userId,
    metadata: { reversalOf: entryId },
    lines: lines.map((l: any) => ({
      accountId: l.account_id ?? undefined,
      accountCode: l.account_code ?? undefined,
      debitAmount: Number(l.credit_amount ?? l.credit ?? 0),
      creditAmount: Number(l.debit_amount ?? l.debit ?? 0),
      partyType: l.party_type ?? undefined,
      partyId: l.party_id ?? undefined,
      branchId: l.branch_id ?? undefined,
      departmentId: l.department_id ?? undefined,
      projectId: l.project_id ?? undefined,
      costCenterId: l.cost_center_id ?? undefined,
      description: `Reversal: ${l.description ?? ""}`,
    })),
  });

  await db.query(
    `update journal_entries set is_reversing = true, reversed_entry_id = $2, updated_at = now() where id = $1`,
    [entryId, reversal.id]
  );

  return reversal;
}

// ---------------------------------------------------------------------------
// Period close: move P&L to retained earnings, carry opening balances
// forward into the next fiscal period.
// ---------------------------------------------------------------------------
export async function closeFiscalPeriod(
  periodId: string,
  userId?: string
): Promise<{ closingEntryId: string | null; carriedAccounts: number }> {
  await ensureGLTables();

  const periods = (await db.query<any>(
    `select * from fiscal_periods where id = $1`,
    [periodId]
  )).rows;
  if (!periods.length) throw new Error(`Fiscal period ${periodId} not found`);
  const period = periods[0];
  if ((period.status || "").toUpperCase() === "CLOSED") {
    throw new Error("Fiscal period is already closed");
  }

  const tenantSlug: string = period.tenant_slug;
  const start = toDateString(period.start_date);
  const end = toDateString(period.end_date);
  const retainedEarnings = await withTransaction((q) =>
    ensureGLAccount(q, tenantSlug, GL_ACCOUNTS.RETAINED_EARNINGS)
  );

  // Net balances of income/expense accounts inside the period window
  const balances = (await db.query<any>(
    `select coalesce(coa.code, jel.account_code) as code,
            coalesce(coa.name, jel.account_name) as name,
            coalesce(lower(coa.type), 'expense') as type,
            sum(jel.debit_amount) as debits,
            sum(jel.credit_amount) as credits
     from journal_entry_lines jel
     join journal_entries je on jel.entry_id = je.id
     left join chart_of_accounts coa
       on coa.id = jel.account_id or coa.code = jel.account_code
     where je.tenant_slug = $1
       and coalesce(je.posting_date, je.entry_date) between $2 and $3
       and coalesce(upper(je.approval_status), 'POSTED') in ('POSTED', 'APPROVED')
       and (coa.type in ('revenue', 'expense') or coa.account_type in ('INCOME', 'EXPENSE'))
     group by 1, 2, 3`,
    [tenantSlug, start, end]
  )).rows;

  let closingEntryId: string | null = null;
  const closingLines: GLLineInput[] = [];

  for (const b of balances) {
    const net = Number(b.credits) - Number(b.debits); // credit-normal view
    if (Math.abs(net) < 0.005) continue;
    if (b.type === "revenue" || b.type === "INCOME") {
      // Debit revenue to zero it out
      closingLines.push({
        accountCode: b.code,
        debitAmount: net,
        creditAmount: 0,
        description: `Period close: ${b.name}`,
      });
    } else {
      // Expense accounts carry debit balances; credit them to zero
      closingLines.push({
        accountCode: b.code,
        debitAmount: 0,
        creditAmount: -net,
        description: `Period close: ${b.name}`,
      });
    }
  }

  if (closingLines.length) {
    const totalDebit = closingLines.reduce((s, l) => s + (l.debitAmount ?? 0), 0);
    const totalCredit = closingLines.reduce((s, l) => s + (l.creditAmount ?? 0), 0);
    closingLines.push({
      accountCode: retainedEarnings.code,
      debitAmount: totalCredit > totalDebit ? totalCredit - totalDebit : 0,
      creditAmount: totalDebit > totalCredit ? totalDebit - totalCredit : 0,
      description: "Net income transferred to retained earnings",
    });

    const closing = await postGLEntry({
      tenantSlug,
      entryDate: end,
      journalType: "CLOSING",
      referenceType: "period_close",
      referenceId: periodId,
      description: `Closing entries for period ${period.period_name ?? period.name ?? periodId}`,
      status: "POSTED",
      createdBy: userId,
      lines: closingLines,
    });
    closingEntryId = closing.id;
  }

  // Carry forward opening balances for balance-sheet accounts
  const nextPeriod = (await db.query<any>(
    `select id from fiscal_periods
     where tenant_slug = $1 and start_date > $2
     order by start_date asc limit 1`,
    [tenantSlug, end]
  )).rows[0];

  let carriedAccounts = 0;
  if (nextPeriod) {
    const bsBalances = (await db.query<any>(
      `select jel.account_id,
              sum(jel.debit_amount - jel.credit_amount) as net
       from journal_entry_lines jel
       join journal_entries je on jel.entry_id = je.id
       join chart_of_accounts coa on coa.id = jel.account_id or coa.code = jel.account_code
       where je.tenant_slug = $1
         and coalesce(je.posting_date, je.entry_date) <= $2
         and coalesce(upper(je.approval_status), 'POSTED') in ('POSTED', 'APPROVED')
         and (coa.type in ('asset', 'liability', 'equity') or coa.account_type in ('ASSET', 'LIABILITY', 'EQUITY'))
       group by jel.account_id`,
      [tenantSlug, end]
    )).rows;

    for (const b of bsBalances) {
      if (!b.account_id) continue;
      const existing = (await db.query<any>(
        `select id from account_balances where account_id = $1 and fiscal_period_id = $2`,
        [b.account_id, nextPeriod.id]
      )).rows;
      if (existing.length) {
        await db.query(
          `update account_balances set opening_balance = $3, last_updated = now() where id = $1`,
          [existing[0].id, nextPeriod.id, b.net]
        );
      } else {
        await db.query(
          `insert into account_balances (id, tenant_slug, account_id, fiscal_period_id, opening_balance, period_debit, period_credit, last_updated)
           values ($1, $2, $3, $4, $5, 0, 0, now())`,
          [randomUUID(), tenantSlug, b.account_id, nextPeriod.id, b.net]
        );
      }
      carriedAccounts++;
    }
  }

  // Snapshot per-account closing balances (ERPNext Account Closing Balance):
  // immutable per-period record used by fast-report paths and health checks.
  try {
    await db.query(`create table if not exists account_closing_balance (
      id uuid primary key default gen_random_uuid(),
      tenant_slug text not null,
      fiscal_period_id uuid not null,
      account_id uuid,
      account_code text,
      account_name text,
      debit numeric(18,2) not null default 0,
      credit numeric(18,2) not null default 0,
      closing_balance numeric(18,2) not null default 0,
      finance_book text not null default 'main',
      created_at timestamptz not null default now(),
      unique (tenant_slug, fiscal_period_id, account_id, finance_book)
    )`);
    await db.query(
      `insert into account_closing_balance
         (tenant_slug, fiscal_period_id, account_id, account_code, account_name, debit, credit, closing_balance, finance_book)
       select $1, $2, jel.account_id, coalesce(coa.code, jel.account_code), coalesce(coa.name, jel.account_name),
              sum(jel.debit_amount), sum(jel.credit_amount), sum(jel.debit_amount - jel.credit_amount),
              coalesce(je.finance_book, 'main')
       from journal_entry_lines jel
       join journal_entries je on jel.entry_id = je.id
       left join chart_of_accounts coa on coa.id = jel.account_id or coa.code = jel.account_code
       where je.tenant_slug = $1
         and coalesce(je.posting_date, je.entry_date) <= $3
         and coalesce(upper(je.approval_status), 'POSTED') in ('POSTED', 'APPROVED')
       group by jel.account_id, coa.code, jel.account_code, coa.name, jel.account_name, coalesce(je.finance_book, 'main')
       on conflict (tenant_slug, fiscal_period_id, account_id, finance_book) do update
         set debit = excluded.debit, credit = excluded.credit, closing_balance = excluded.closing_balance`,
      [tenantSlug, periodId, end],
    );
  } catch (e) {
    console.error("account_closing_balance snapshot failed:", e);
  }

  await db.query(
    `update fiscal_periods set status = 'closed', allow_posting = false, closed_at = now(), closed_by = $2, locked_at = now(), locked_by = $2, updated_at = now() where id = $1`,
    [periodId, userId ?? null]
  );

  return { closingEntryId, carriedAccounts };
}
