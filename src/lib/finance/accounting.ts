/**
 * Accounting Integration Service
 * Handles automatic journal entry generation for vendor transactions
 */

import { randomUUID } from "crypto";
import { db, sql as SQL, SqlClient } from "../sql-client";
import { ensureOnce } from "@/lib/ensure-once";

export interface JournalEntry {
  id: string;
  tenantSlug: string;
  entryNumber: string;
  entryDate: string;
  referenceType: "bill" | "payment" | "manual" | "payroll";
  referenceId?: string;
  description: string;
  lines: JournalEntryLine[];
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface JournalEntryLine {
  id: string;
  entryId: string;
  accountCode: string;
  accountName?: string;
  debitAmount: number;
  creditAmount: number;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface ChartOfAccount {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  isActive: boolean;
}

/* using imported SQL */

// Default chart of accounts for vendor transactions
const DEFAULT_ACCOUNTS: Record<string, ChartOfAccount> = {
  ACCOUNTS_PAYABLE: {
    code: "2100",
    name: "Accounts Payable",
    type: "liability",
    isActive: true
  },
  BANK_ACCOUNT: {
    code: "1100",
    name: "Bank Account",
    type: "asset",
    isActive: true
  },
  CASH_ACCOUNT: {
    code: "1110",
    name: "Cash",
    type: "asset",
    isActive: true
  },
  CORPORATE_CARD: {
    code: "1120",
    name: "Corporate Card",
    type: "liability",
    isActive: true
  },
  VAT_INPUT: {
    code: "2200",
    name: "VAT Input Tax",
    type: "asset",
    isActive: true
  },
  WHT_PAYABLE: {
    code: "2210",
    name: "Withholding Tax Payable",
    type: "liability",
    isActive: true
  },
  EXPENSE_DEFAULT: {
    code: "6100",
    name: "General Expenses",
    type: "expense",
    isActive: true
  },
  WIP_INVENTORY: {
    code: "1300",
    name: "Work In Progress",
    type: "asset",
    isActive: true
  },
  FINISHED_GOODS: {
    code: "1400",
    name: "Finished Goods Inventory",
    type: "asset",
    isActive: true
  },
  RAW_MATERIALS: {
    code: "1500",
    name: "Raw Materials Inventory",
    type: "asset",
    isActive: true
  },
  ACCOUNTS_RECEIVABLE: {
    code: "1200",
    name: "Accounts Receivable",
    type: "asset",
    isActive: true
  },
  PREPAID_EXPENSES: {
    code: "1600",
    name: "Prepaid Expenses",
    type: "asset",
    isActive: true
  },
  MATERIAL_VARIANCE: {
    code: "6200",
    name: "Material Variance",
    type: "expense",
    isActive: true
  },
  SALARIES_WAGES: {
    code: "6300",
    name: "Salaries & Wages",
    type: "expense",
    isActive: true
  },
  PAYROLL_PAYABLE: {
    code: "2300",
    name: "Payroll Payable",
    type: "liability",
    isActive: true
  },
  PAYROLL_DEDUCTIONS_PAYABLE: {
    code: "2310",
    name: "Payroll Deductions Payable",
    type: "liability",
    isActive: true
  }
};

export function ensureAccountingTables(...args: Parameters<typeof ensureAccountingTablesRun>) {
  return ensureOnce("finance/accounting:ensureAccountingTables", () => ensureAccountingTablesRun(...args));
}

async function ensureAccountingTablesRun(sql = SQL) {
  try {
    // Create journal entries table if not exists
    await sql`
      create table if not exists journal_entries (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        entry_number text not null,
        entry_date date not null,
        reference_type text not null check (reference_type in ('bill', 'payment', 'manual')),
        reference_id uuid,
        description text not null,
        metadata jsonb,
        created_at timestamptz not null default now()
      )
    `;

    // Legacy tables carry tenant_id uuid NOT NULL — relax it so tenant_slug rows can be written
    try {
      await sql`alter table if exists journal_entries alter column tenant_id drop not null`;
    } catch (e: any) {
      console.warn("journal_entries tenant_id relax skipped:", e?.message || e);
    }

    await sql`alter table if exists journal_entries add column if not exists tenant_slug text`;
    await sql`alter table if exists journal_entries add column if not exists entry_number text`;
    await sql`alter table if exists journal_entries add column if not exists entry_date date`;
    await sql`alter table if exists journal_entries add column if not exists reference_type text`;
    await sql`alter table if exists journal_entries add column if not exists reference_id uuid`;
    await sql`alter table if exists journal_entries add column if not exists description text`;
    await sql`alter table if exists journal_entries add column if not exists metadata jsonb`;
    await sql`alter table if exists journal_entries add column if not exists created_at timestamptz default now()`;
    await sql`alter table if exists journal_entries add column if not exists journal_number text`;
    await sql`alter table if exists journal_entries add column if not exists journal_type text`;
    await sql`alter table if exists journal_entries add column if not exists fiscal_period_id uuid`;
    await sql`alter table if exists journal_entries add column if not exists posting_date date`;
    await sql`alter table if exists journal_entries add column if not exists reference text`;
    await sql`alter table if exists journal_entries add column if not exists source text`;
    await sql`alter table if exists journal_entries add column if not exists status text`;
    await sql`alter table if exists journal_entries add column if not exists total_debit numeric(18,2) not null default 0`;
    await sql`alter table if exists journal_entries add column if not exists total_credit numeric(18,2) not null default 0`;
    await sql`alter table if exists journal_entries add column if not exists notes text`;
    await sql`alter table if exists journal_entries add column if not exists approval_status text`;
    await sql`alter table if exists journal_entries add column if not exists created_by text`;
    await sql`alter table if exists journal_entries add column if not exists approved_by text`;
    await sql`alter table if exists journal_entries add column if not exists approved_at timestamptz`;
    await sql`alter table if exists journal_entries add column if not exists posted_at timestamptz`;
    await sql`alter table if exists journal_entries add column if not exists reversed_entry_id uuid`;
    await sql`alter table if exists journal_entries add column if not exists is_reversing boolean default false`;
    await sql`alter table if exists journal_entries add column if not exists attachment_url text`;
    await sql`alter table if exists journal_entries add column if not exists updated_at timestamptz default now()`;

    // Create journal entry lines table if not exists
    await sql`
      create table if not exists journal_entry_lines (
        id uuid primary key default gen_random_uuid(),
        entry_id uuid not null references journal_entries(id) on delete cascade,
        account_code text not null,
        account_name text,
        debit_amount numeric(18,2) not null default 0,
        credit_amount numeric(18,2) not null default 0,
        description text,
        metadata jsonb,
        created_at timestamptz not null default now()
      )
    `;

    await sql`alter table if exists journal_entry_lines add column if not exists journal_entry_id uuid`;
    await sql`alter table if exists journal_entry_lines add column if not exists line_number integer`;
    await sql`alter table if exists journal_entry_lines add column if not exists account_id uuid`;
    await sql`alter table if exists journal_entry_lines add column if not exists branch_id text`;
    await sql`alter table if exists journal_entry_lines add column if not exists department_id text`;
    await sql`alter table if exists journal_entry_lines add column if not exists project_id text`;
    await sql`alter table if exists journal_entry_lines add column if not exists cost_center_id text`;
    await sql`alter table if exists journal_entry_lines add column if not exists is_reconciled boolean default false`;
    await sql`alter table if exists journal_entry_lines add column if not exists reconciled_at timestamptz`;
    await sql`alter table if exists journal_entry_lines add column if not exists debit numeric(18,2) default 0`;
    await sql`alter table if exists journal_entry_lines add column if not exists credit numeric(18,2) default 0`;

    // Create chart of accounts table if not exists
    await sql`
      create table if not exists chart_of_accounts (
        code text primary key,
        name text not null,
        type text not null check (type in ('asset', 'liability', 'equity', 'revenue', 'expense')),
        is_active boolean default true,
        tenant_slug text,
        created_at timestamptz not null default now()
      )
    `;

    try {
      await sql`alter table if exists chart_of_accounts alter column tenant_id drop not null`;
    } catch (e: any) {
      console.warn("chart_of_accounts tenant_id relax skipped:", e?.message || e);
    }
    await sql`alter table if exists chart_of_accounts add column if not exists id uuid default gen_random_uuid()`;
    await sql`alter table if exists chart_of_accounts add column if not exists tenant_slug text`;
    await sql`alter table if exists chart_of_accounts add column if not exists is_active boolean default true`;
    await sql`alter table if exists chart_of_accounts add column if not exists code text`;
    await sql`alter table if exists chart_of_accounts add column if not exists name text`;
    await sql`alter table if exists chart_of_accounts add column if not exists type text`;
    await sql`alter table if exists chart_of_accounts add column if not exists tenant_id text`;
    await sql`alter table if exists chart_of_accounts add column if not exists account_code text`;
    await sql`alter table if exists chart_of_accounts add column if not exists account_name text`;
    await sql`alter table if exists chart_of_accounts add column if not exists account_type text`;
    await sql`alter table if exists chart_of_accounts add column if not exists sub_type text`;
    await sql`alter table if exists chart_of_accounts add column if not exists subtype text`;
    await sql`alter table if exists chart_of_accounts add column if not exists balance numeric(18,2) default 0`;
    await sql`alter table if exists chart_of_accounts add column if not exists description text`;
    await sql`alter table if exists chart_of_accounts add column if not exists parent_account_id text`;
    await sql`alter table if exists chart_of_accounts add column if not exists parent_accounts_id text`;
    await sql`alter table if exists chart_of_accounts add column if not exists currency text default 'NGN'`;
    await sql`alter table if exists chart_of_accounts add column if not exists is_system_account boolean default false`;
    await sql`alter table if exists chart_of_accounts add column if not exists branch_id text`;
    await sql`alter table if exists chart_of_accounts add column if not exists department_id text`;
    await sql`alter table if exists chart_of_accounts add column if not exists project_id text`;
    await sql`alter table if exists chart_of_accounts add column if not exists allow_manual_posting boolean default true`;
    await sql`alter table if exists chart_of_accounts add column if not exists require_cost_center boolean default false`;
    await sql`alter table if exists chart_of_accounts add column if not exists is_reconciliation_account boolean default false`;
    await sql`alter table if exists chart_of_accounts add column if not exists created_by text`;
    await sql`alter table if exists chart_of_accounts add column if not exists updated_at timestamptz default now()`;

    // Create indexes (sequential to avoid nested-array typing from template-tag results)
    await sql`create index if not exists journal_entries_tenant_idx on journal_entries (tenant_slug)`;
    await sql`create index if not exists journal_entries_reference_idx on journal_entries (reference_type, reference_id)`;
    await sql`create index if not exists journal_entry_lines_entry_idx on journal_entry_lines (entry_id)`;
    await sql`create index if not exists journal_entry_lines_account_idx on journal_entry_lines (account_code)`;
    await sql`create index if not exists coa_tenant_idx on chart_of_accounts (tenant_slug)`;
    await sql`create index if not exists journal_entry_lines_je_idx on journal_entry_lines (journal_entry_id)`;
    await sql`create index if not exists journal_entry_lines_account_id_idx on journal_entry_lines (account_id)`;

    // Unique code per account — required for seed upserts and lookups
    try {
      await sql`create unique index if not exists chart_of_accounts_code_uq on chart_of_accounts (code)`;
    } catch (e: any) {
      console.warn("chart_of_accounts code unique index skipped:", e?.message || e);
    }

    // Seed default accounts if they don't exist
    await seedDefaultAccounts(sql);

  } catch (error) {
    console.error("Failed to ensure accounting tables:", error);
  }
}

async function seedDefaultAccounts(sql: SqlClient) {
  for (const [key, account] of Object.entries(DEFAULT_ACCOUNTS)) {
    await sql`
      insert into chart_of_accounts (code, name, type, is_active)
      select ${account.code}, ${account.name}, ${account.type}, ${account.isActive}
      where not exists (select 1 from chart_of_accounts where code = ${account.code})
    `;
  }
}

export async function createJournalEntry(payload: {
  tenantSlug: string;
  entryDate: string;
  referenceType: "bill" | "payment" | "manual" | "payroll";
  referenceId?: string;
  description: string;
  lines: Array<{
    accountCode: string;
    debitAmount: number;
    creditAmount: number;
    description?: string;
  }>;
  metadata?: Record<string, unknown>;
}): Promise<JournalEntry> {
  const sql = SQL;
  await ensureAccountingTables(sql);

  // Validate debits equal credits
  const totalDebits = payload.lines.reduce((sum, line) => sum + line.debitAmount, 0);
  const totalCredits = payload.lines.reduce((sum, line) => sum + line.creditAmount, 0);
  
  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    throw new Error(`Journal entry must balance. Debits: ${totalDebits}, Credits: ${totalCredits}`);
  }

  const entryId = randomUUID();
  const entryNumber = `JE-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  // Create journal entry header
  const [entryRecord] = (await sql`
    insert into journal_entries (
      id, tenant_slug, entry_number, entry_date, reference_type, reference_id,
      description, metadata, created_at
    ) values (
      ${entryId}, ${payload.tenantSlug}, ${entryNumber}, ${payload.entryDate},
      ${payload.referenceType}, ${payload.referenceId || null}, ${payload.description},
      ${payload.metadata || null}, now()
    ) returning *
  `) as any[];

  // Create journal entry lines
  const lineRecords = await Promise.all(payload.lines.map(async (line) => {
    // Get account name
    const [account] = (await sql`
      select name from chart_of_accounts where code = ${line.accountCode} limit 1
    `) as any[];

    const [lineRecord] = (await sql`
      insert into journal_entry_lines (
        id, entry_id, account_code, account_name, debit_amount, credit_amount,
        description, metadata, created_at
      ) values (
        ${randomUUID()}, ${entryId}, ${line.accountCode}, ${account?.name || null},
        ${line.debitAmount}, ${line.creditAmount}, ${line.description || null},
        null, now()
      ) returning *
    `) as any[];

    return lineRecord;
  }));

  return {
    id: entryRecord.id,
    tenantSlug: entryRecord.tenant_slug,
    entryNumber: entryRecord.entry_number,
    entryDate: entryRecord.entry_date,
    referenceType: entryRecord.reference_type,
    referenceId: entryRecord.reference_id,
    description: entryRecord.description,
    lines: lineRecords.map(line => ({
      id: line.id,
      entryId: line.entry_id,
      accountCode: line.account_code,
      accountName: line.account_name,
      debitAmount: Number(line.debit_amount),
      creditAmount: Number(line.credit_amount),
      description: line.description,
      metadata: line.metadata
    })),
    metadata: entryRecord.metadata,
    createdAt: entryRecord.created_at
  };
}

export async function createBillJournalEntry(billId: string, bill: any): Promise<JournalEntry> {
  const lines = [];

  // Debit expense accounts for each bill item
  for (const item of bill.items) {
    const accountCode = item.accountCode || DEFAULT_ACCOUNTS.EXPENSE_DEFAULT.code;
    const lineAmount = item.lineAmount;
    
    lines.push({
      accountCode,
      debitAmount: lineAmount,
      creditAmount: 0,
      description: `Bill: ${bill.billNumber} - ${item.description}`
    });
  }

  // Credit Accounts Payable for total bill amount
  lines.push({
    accountCode: DEFAULT_ACCOUNTS.ACCOUNTS_PAYABLE.code,
    debitAmount: 0,
    creditAmount: bill.total,
    description: `Accounts Payable - Bill: ${bill.billNumber} - Vendor: ${bill.vendorId}`
  });

  return createJournalEntry({
    tenantSlug: bill.tenantSlug,
    entryDate: bill.billDate,
    referenceType: "bill",
    referenceId: billId,
    description: `Vendor Bill Posting - ${bill.billNumber}`,
    lines,
    metadata: {
      billNumber: bill.billNumber,
      vendorId: bill.vendorId,
      subtotal: bill.subtotal,
      taxes: bill.taxes,
      total: bill.total
    }
  });
}

export async function createPaymentJournalEntry(paymentId: string, payment: any): Promise<JournalEntry> {
  const lines = [];

  // Get the appropriate cash/bank account based on payment method
  let cashAccountCode = DEFAULT_ACCOUNTS.BANK_ACCOUNT.code;
  switch (payment.method) {
    case "cash":
      cashAccountCode = DEFAULT_ACCOUNTS.CASH_ACCOUNT.code;
      break;
    case "corporate_card":
      cashAccountCode = DEFAULT_ACCOUNTS.CORPORATE_CARD.code;
      break;
  }

  // Debit Accounts Payable for applied amount
  if (payment.appliedAmount > 0) {
    lines.push({
      accountCode: DEFAULT_ACCOUNTS.ACCOUNTS_PAYABLE.code,
      debitAmount: payment.appliedAmount,
      creditAmount: 0,
      description: `Payment to Vendor - ${payment.paymentNumber} - Applied Amount`
    });
  }

  // Credit cash/bank account for total payment amount
  lines.push({
    accountCode: cashAccountCode,
    debitAmount: 0,
    creditAmount: payment.amount,
    description: `Payment to Vendor - ${payment.paymentNumber} - ${payment.method}`
  });

  // If there's unapplied amount, credit it to a prepaid expense or similar
  if (payment.unappliedAmount > 0) {
    lines.push({
      accountCode: DEFAULT_ACCOUNTS.PREPAID_EXPENSES.code,
      debitAmount: payment.unappliedAmount,
      creditAmount: 0,
      description: `Prepayment to Vendor - ${payment.paymentNumber} - Unapplied Amount`
    });
  }

  return createJournalEntry({
    tenantSlug: payment.tenantSlug,
    entryDate: payment.paymentDate,
    referenceType: "payment",
    referenceId: paymentId,
    description: `Vendor Payment Posting - ${payment.paymentNumber}`,
    lines,
    metadata: {
      paymentNumber: payment.paymentNumber,
      vendorId: payment.vendorId,
      method: payment.method,
      amount: payment.amount,
      appliedAmount: payment.appliedAmount,
      unappliedAmount: payment.unappliedAmount
    }
  });
}

export async function getJournalEntries(filters: {
  tenantSlug: string;
  referenceType?: string;
  referenceId?: string;
  accountCode?: string;
  limit?: number;
  offset?: number;
}): Promise<JournalEntry[]> {
  const sql = SQL;
  await ensureAccountingTables(sql);

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);

  const params: any[] = [];
  let paramIndex = 1;
  let whereClause = `tenant_slug = $${paramIndex}`;
  params.push(filters.tenantSlug);
  paramIndex++;

  if (filters.referenceType) {
    whereClause += ` and reference_type = $${paramIndex}`;
    params.push(filters.referenceType);
    paramIndex++;
  }

  if (filters.referenceId) {
    whereClause += ` and reference_id = $${paramIndex}`;
    params.push(filters.referenceId);
    paramIndex++;
  }

  const queryText = `select * from journal_entries where ${whereClause} order by entry_date desc, created_at desc limit $${paramIndex} offset $${paramIndex + 1}`;
  params.push(limit, offset);

  const entries = (await db.query<any>(queryText, params)).rows;

  if (!entries.length) return [];

  const lines = (await db.query<any>(
    `select * from journal_entry_lines where entry_id = any($1) order by id`,
    [entries.map((e: any) => e.id)]
  )).rows;

  const linesByEntry: Record<string, any[]> = {};
  lines.forEach(line => {
    linesByEntry[line.entry_id] = linesByEntry[line.entry_id] || [];
    linesByEntry[line.entry_id].push(line);
  });

  return entries.map(entry => ({
    id: entry.id,
    tenantSlug: entry.tenant_slug,
    entryNumber: entry.entry_number,
    entryDate: entry.entry_date,
    referenceType: entry.reference_type,
    referenceId: entry.reference_id,
    description: entry.description,
    lines: (linesByEntry[entry.id] || []).map(line => ({
      id: line.id,
      entryId: line.entry_id,
      accountCode: line.account_code,
      accountName: line.account_name,
      debitAmount: Number(line.debit_amount),
      creditAmount: Number(line.credit_amount),
      description: line.description,
      metadata: line.metadata
    })),
    metadata: entry.metadata,
    createdAt: entry.created_at
  }));
}

export async function getChartOfAccounts(tenantSlug?: string): Promise<ChartOfAccount[]> {
  const sql = SQL;
  await ensureAccountingTables(sql);

  const whereClause = tenantSlug 
    ? sql`where tenant_slug = ${tenantSlug} or tenant_slug is null`
    : sql``;

  const accounts = (await sql`
    select * from chart_of_accounts 
    ${whereClause}
    order by code
  `) as any[];

  return accounts.map(account => ({
    code: account.code,
    name: account.name,
    type: account.type,
    isActive: account.is_active
  }));
}
