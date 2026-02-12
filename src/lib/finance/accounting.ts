/**
 * Accounting Integration Service
 * Handles automatic journal entry generation for vendor transactions
 */

import { randomUUID } from "node:crypto";
import { db, sql as SQL, SqlClient } from "@/lib/sql-client";

export interface JournalEntry {
  id: string;
  tenantSlug: string;
  entryNumber: string;
  entryDate: string;
  referenceType: "bill" | "payment" | "manual";
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

// using SQL imported from sql-client

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
  }
};

export async function ensureAccountingTables(sql = SQL) {
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

    // Create indexes
    await Promise.all([
      sql`create index if not exists journal_entries_tenant_idx on journal_entries (tenant_slug)`,
      sql`create index if not exists journal_entries_reference_idx on journal_entries (reference_type, reference_id)`,
      sql`create index if not exists journal_lines_entry_idx on journal_entry_lines (entry_id)`,
      sql`create index if not exists journal_lines_account_idx on journal_entry_lines (account_code)`,
      sql`create index if not exists coa_tenant_idx on chart_of_accounts (tenant_slug)`
    ]);

    // Seed default accounts if they don't exist
    await seedDefaultAccounts(sql);

  } catch (error) {
    console.error("Failed to ensure accounting tables:", error);
  }
}

async function seedDefaultAccounts(sql: ReturnType<typeof getSql>) {
  for (const [key, account] of Object.entries(DEFAULT_ACCOUNTS)) {
    await sql`
      insert into chart_of_accounts (code, name, type, is_active)
      values (${account.code}, ${account.name}, ${account.type}, ${account.isActive})
      on conflict (code) do nothing
    `;
  }
}

export async function createJournalEntry(payload: {
  tenantSlug: string;
  entryDate: string;
  referenceType: "bill" | "payment" | "manual";
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

  // Credit VAT Input Tax if applicable
  if (bill.taxes > 0) {
    lines.push({
      accountCode: DEFAULT_ACCOUNTS.VAT_INPUT.code,
      debitAmount: bill.taxes,
      creditAmount: 0,
      description: `VAT Input Tax - Bill: ${bill.billNumber}`
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
      accountCode: DEFAULT_ACCOUNTS.ACCOUNTS_PAYABLE.code,
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

  const whereConditions: any[] = [];
  whereConditions.push(sql`tenant_slug = ${filters.tenantSlug}`);
  
  if (filters.referenceType) {
    whereConditions.push(sql`reference_type = ${filters.referenceType}`);
  }
  
  if (filters.referenceId) {
    whereConditions.push(sql`reference_id = ${filters.referenceId}`);
  }

  const whereClause = whereConditions.length > 0 
    ? sql`where ${db.join(whereConditions, ' and ')}`
    : sql``;

  const entries = (await sql`
    select * from journal_entries 
    ${whereClause}
    order by entry_date desc, created_at desc
    limit ${limit} offset ${offset}
  `) as any[];

  if (!entries.length) return [];

  const lines = (await sql`
    select * from journal_entry_lines 
    where entry_id = any(${entries.map(e => e.id)})
    order by id
  `) as any[];

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
