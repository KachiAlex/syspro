/**
 * Accounting Integration Service
 * Handles automatic journal entry generation for vendor transactions
 */

import { db, sql as SQL, SqlClient } from "../sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { ensureGLTables, postGLEntry, GL_ACCOUNTS, type GLPartyType } from "./gl";

export interface JournalEntry {
  id: string;
  tenantSlug: string;
  entryNumber: string;
  entryDate: string;
  referenceType: "bill" | "payment" | "manual" | "payroll" | "invoice" | "period_close" | "reversal" | "sales_return" | "purchase_return" | "landed_cost";
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
  },
  SALES_REVENUE: {
    code: "4000",
    name: "Sales Revenue",
    type: "revenue",
    isActive: true
  },
  SERVICE_REVENUE: {
    code: "4100",
    name: "Service Revenue",
    type: "revenue",
    isActive: true
  },
  VAT_OUTPUT: {
    code: "2205",
    name: "VAT Output Tax",
    type: "liability",
    isActive: true
  },
  RETAINED_EARNINGS: {
    code: "3100",
    name: "Retained Earnings",
    type: "equity",
    isActive: true
  }
};

export function ensureAccountingTables(...args: Parameters<typeof ensureAccountingTablesRun>) {
  return ensureOnce("finance/accounting:ensureAccountingTables", () => ensureAccountingTablesRun(...args));
}

async function ensureAccountingTablesRun(sql = SQL) {
  // Canonical GL schema (journal_entries / journal_entry_lines / fiscal_periods /
  // account_balances / sequences / audit) is maintained by the consolidation
  // migration and src/lib/finance/gl.ts.
  await ensureGLTables();
  try {
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
    await sql`alter table if exists chart_of_accounts add column if not exists account_code text`;
    await sql`alter table if exists chart_of_accounts add column if not exists account_name text`;
    await sql`alter table if exists chart_of_accounts add column if not exists account_type text`;

    await sql`create index if not exists coa_tenant_idx on chart_of_accounts (tenant_slug)`;

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
  referenceType: "bill" | "payment" | "manual" | "payroll" | "invoice" | "period_close" | "reversal" | "sales_return" | "purchase_return" | "landed_cost";
  referenceId?: string;
  branchId?: string;
  description: string;
  lines: Array<{
    accountCode: string;
    debitAmount: number;
    creditAmount: number;
    description?: string;
    partyType?: GLPartyType;
    partyId?: string;
  }>;
  metadata?: Record<string, unknown>;
  status?: "POSTED" | "DRAFT";
}): Promise<JournalEntry> {
  await ensureAccountingTables(SQL);

  // Single write path: canonical GL poster validates balance, assigns a
  // sequential journal number, enforces the fiscal period, maintains
  // account_balances, and writes the audit trail inside a transaction.
  const entry = await postGLEntry({
    tenantSlug: payload.tenantSlug,
    entryDate: payload.entryDate,
    journalType: payload.referenceType === "manual" ? "MANUAL" : "SYSTEM",
    referenceType: payload.referenceType,
    referenceId: payload.referenceId,
    description: payload.description,
    status: payload.status ?? "POSTED",
    metadata: payload.metadata,
    branchId: payload.branchId,
    lines: payload.lines.map((line) => ({
      accountCode: line.accountCode,
      debitAmount: line.debitAmount,
      creditAmount: line.creditAmount,
      description: line.description,
      partyType: line.partyType,
      partyId: line.partyId,
    })),
  });

  return {
    id: entry.id,
    tenantSlug: payload.tenantSlug,
    entryNumber: entry.entryNumber,
    entryDate: entry.entryDate,
    referenceType: payload.referenceType,
    referenceId: payload.referenceId,
    description: entry.description,
    lines: entry.lines.map((line) => ({
      id: line.id,
      entryId: entry.id,
      accountCode: line.accountCode ?? "",
      accountName: line.accountName ?? undefined,
      debitAmount: line.debitAmount,
      creditAmount: line.creditAmount,
      description: line.description,
      metadata: undefined,
    })),
    metadata: payload.metadata,
    createdAt: entry.createdAt,
  };
}

export async function createBillJournalEntry(billId: string, bill: any): Promise<JournalEntry> {
  const lines = [];
  const { GL_ACCOUNTS } = await import("./gl");

  let inputVat = 0;
  let netTotal = 0;
  for (const item of bill.items) {
    // lineAmount is tax-inclusive; recover the net as qty × unit price.
    const net = Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0);
    const tax = Math.max(0, Number(item.lineAmount) - net);
    inputVat += tax;
    netTotal += net;
  }

  if (bill.poId) {
    // PO-linked bill: goods were capitalized to inventory at receipt with the
    // offset in GRNI. Clear GRNI here instead of expensing — otherwise the
    // purchase lands in both the inventory asset and expense, and AP is
    // credited twice (once at receipt, once at bill).
    const { resolvePostingAccount } = await import("./posting-settings");
    const grniAcc = await resolvePostingAccount(bill.tenantSlug, "goods_received_not_invoiced").catch(() => GL_ACCOUNTS.GRNI);
    lines.push({
      accountCode: grniAcc,
      debitAmount: netTotal,
      creditAmount: 0,
      description: `GRNI clearing — Bill: ${bill.billNumber}`
    });
  } else {
    // Non-PO bill: debit expense accounts for each bill item (net of input VAT)
    for (const item of bill.items) {
      const accountCode = item.accountCode || DEFAULT_ACCOUNTS.EXPENSE_DEFAULT.code;
      const net = Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0);
      lines.push({
        accountCode,
        debitAmount: net,
        creditAmount: 0,
        description: `Bill: ${bill.billNumber} - ${item.description}`
      });
    }
  }

  // Debit input VAT (claimable) — previously buried in the expense lines
  if (inputVat > 0.005) {
    lines.push({
      accountCode: GL_ACCOUNTS.VAT_INPUT,
      debitAmount: inputVat,
      creditAmount: 0,
      description: `Input VAT — Bill: ${bill.billNumber}`
    });
  }

  const whtAmount = Number(bill.whtAmount ?? 0);

  // Credit Accounts Payable net of WHT — vendor is paid total minus withholding
  lines.push({
    accountCode: DEFAULT_ACCOUNTS.ACCOUNTS_PAYABLE.code,
    debitAmount: 0,
    creditAmount: Math.round((bill.total - whtAmount) * 100) / 100,
    description: `Accounts Payable - Bill: ${bill.billNumber} - Vendor: ${bill.vendorId}`,
    partyType: "vendor" as const,
    partyId: bill.vendorId
  });

  // Credit WHT payable — withheld from the vendor, remitted to FIRS
  if (whtAmount > 0.005) {
    lines.push({
      accountCode: GL_ACCOUNTS.WHT_PAYABLE,
      debitAmount: 0,
      creditAmount: whtAmount,
      description: `WHT withheld — Bill: ${bill.billNumber}`
    });
  }

  return createJournalEntry({
    tenantSlug: bill.tenantSlug,
    entryDate: bill.billDate,
    referenceType: "bill",
    referenceId: billId,
    branchId: bill.branchId,
    description: `Vendor Bill Posting - ${bill.billNumber}`,
    lines,
    metadata: {
      billNumber: bill.billNumber,
      vendorId: bill.vendorId,
      subtotal: bill.subtotal,
      taxes: bill.taxes,
      whtAmount,
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
      description: `Payment to Vendor - ${payment.paymentNumber} - Applied Amount`,
      partyType: "vendor" as const,
      partyId: payment.vendorId
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
    branchId: payment.branchId,
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
    order by coalesce(code, account_code)
  `) as any[];

  // Two column families exist: code/name/type (GL-side, lowercase types)
  // and account_code/account_name/account_type (accounting-side, 'INCOME').
  return accounts.map((account) => {
    const rawType = (account.type ?? account.account_type ?? "").toLowerCase();
    return {
      code: account.code ?? account.account_code,
      name: account.name ?? account.account_name,
      type: rawType === "income" ? "revenue" : rawType,
      isActive: account.is_active,
    };
  });
}
