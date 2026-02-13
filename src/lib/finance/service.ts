import { JournalEntry, JournalLine } from './types';

function makeId(prefix = 'je') {
  try {
    // node 14+ crypto
    // @ts-ignore
    const { randomUUID } = require('crypto');
    return randomUUID();
  } catch (e) {
    return `${prefix}-${Date.now().toString(36)}`;
  }
}

export function validateJournalLines(lines: JournalLine[]) {
  if (!lines || lines.length === 0) {
    throw new Error('journal entry must have at least one line');
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (const l of lines) {
    if (l.amount == null || isNaN(l.amount)) throw new Error('invalid line amount');
    if (l.amount < 0) throw new Error('line amount must be positive');
    if (l.side === 'debit') totalDebit += Number(l.amount);
    else if (l.side === 'credit') totalCredit += Number(l.amount);
    else throw new Error('line side must be debit or credit');
  }

  // allow small rounding tolerance
  const eps = 1e-6;
  if (Math.abs(totalDebit - totalCredit) > eps) {
    throw new Error(`unbalanced journal lines: debits=${totalDebit} credits=${totalCredit}`);
  }
  return true;
}

export function createJournalEntry(entry: JournalEntry): JournalEntry {
  const lines = entry.lines || [];
  validateJournalLines(lines);

  const id = makeId('je');
  const now = new Date().toISOString();

  const created: JournalEntry = {
    ...entry,
    id,
    status: entry.status || 'draft',
    created_at: entry.created_at || now,
    lines: lines.map((l) => ({ ...l, id: l.id || `${id}-l-${Math.random().toString(36).slice(2,8)}`, journal_entry_id: id })),
  };

  return created;
}

export function postJournalEntry(entry: JournalEntry) {
  const now = new Date().toISOString();
  if (!entry.id) throw new Error('entry must have id');
  // in real impl: persist entry and lines, enforce RBAC, create audit log
  return { ...entry, status: 'posted', posted_at: now } as JournalEntry;
}

import type { FinanceDashboardSnapshot, FinanceFilters } from "@/lib/finance/types";
import {
  ensureFinanceTables,
  type FinanceAccountRecord,
  type FinanceScheduleRecord,
  type FinanceExpenseCategoryRecord,
  type FinanceTrendPointRecord,
} from "@/lib/finance/db";
import { ensureFinanceSeedForTenant } from "@/lib/finance/seed";
import { db, sql as SQL, SqlClient } from "@/lib/sql-client";
const DEFAULT_CURRENCY = "₦";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

import {
  listFinanceAccounts,
  insertFinanceAccount,
  insertFinanceInvoice,
  createPayment as dbCreatePayment,
  approveExpense as dbApproveExpense,
} from "@/lib/finance/db";

type FinanceDataSets = {
  accounts: FinanceAccountRecord[];
  receivables: FinanceScheduleRecord[];
  payables: FinanceScheduleRecord[];
  expenses: FinanceExpenseCategoryRecord[];
  trendPoints: FinanceTrendPointRecord[];
};

export async function getFinanceDashboardSnapshot(filters: FinanceFilters): Promise<FinanceDashboardSnapshot> {
  const sql = SQL;
  await ensureFinanceTables(sql);

  let data = await fetchFinanceData(filters);

  if (!hasAnyFinanceData(data)) {
    await ensureFinanceSeedForTenant(filters);
    data = await fetchFinanceData(filters);
  }

  const mappedTrend = mapTrendSeries(data.trendPoints);

  return {
    metrics: buildFinanceMetrics({ accounts: data.accounts, receivables: data.receivables, trend: mappedTrend }),
    trend: mappedTrend,
    receivables: data.receivables.length ? data.receivables.map(mapScheduleRow) : [],
    payables: data.payables.length ? data.payables.map(mapScheduleRow) : [],
    cashAccounts: data.accounts.length ? data.accounts.map(mapAccountRow) : [],
    expenseBreakdown: data.expenses.length ? data.expenses.map(mapExpenseRow) : [],
  };
}

// Persistence-wrappers
export async function listAccounts(filters: { tenantSlug: string; regionId?: string; branchId?: string }) {
  const sql = SQL;
  await ensureFinanceTables(sql);
  return listFinanceAccounts(filters);
}

export async function createAccount(payload: any) {
  const sql = SQL;
  await ensureFinanceTables(sql);
  return insertFinanceAccount(payload);
}

export async function createInvoice(payload: any) {
  const sql = SQL;
  await ensureFinanceTables(sql);
  return insertFinanceInvoice(payload);
}

export async function createPayment(payload: any) {
  const sql = SQL;
  await ensureFinanceTables(sql);
  return dbCreatePayment(payload);
}

export async function approveExpense(tenantSlug: string, expenseId: string, approval: any) {
  const sql = SQL;
  await ensureFinanceTables(sql);
  // forward to db implementation which contains approval rules and audit
  return dbApproveExpense(expenseId, tenantSlug, approval as any);
}

async function fetchFinanceData(filters: FinanceFilters): Promise<FinanceDataSets> {
  const sql = SQL;
  const [accounts, receivables, payables, expenses, trendPoints] = await Promise.all([
    sql<FinanceAccountRecord>`
      select *
      from finance_accounts
      where tenant_slug = ${filters.tenantSlug}
      ${filters.regionId ? sql`and (region_id is null or region_id = ${filters.regionId})` : sql``}
      ${filters.branchId ? sql`and (branch_id is null or branch_id = ${filters.branchId})` : sql``}
      order by balance desc
    `,
    sql<FinanceScheduleRecord>`
      select *
      from finance_schedules
      where tenant_slug = ${filters.tenantSlug}
        and document_type = 'receivable'
        ${filters.regionId ? sql`and (region_id is null or region_id = ${filters.regionId})` : sql``}
        ${filters.branchId ? sql`and (branch_id is null or branch_id = ${filters.branchId})` : sql``}
      order by due_date asc
      limit 12
    `,
    sql<FinanceScheduleRecord>`
      select *
      from finance_schedules
      where tenant_slug = ${filters.tenantSlug}
        and document_type = 'payable'
        ${filters.regionId ? sql`and (region_id is null or region_id = ${filters.regionId})` : sql``}
        ${filters.branchId ? sql`and (branch_id is null or branch_id = ${filters.branchId})` : sql``}
      order by due_date asc
      limit 12
    `,
    sql<FinanceExpenseCategoryRecord>`
      select *
      from finance_expense_categories
      where tenant_slug = ${filters.tenantSlug}
        ${filters.regionId ? sql`and (region_id is null or region_id = ${filters.regionId})` : sql``}
        ${filters.branchId ? sql`and (branch_id is null or branch_id = ${filters.branchId})` : sql``}
      order by amount desc
      limit 10
    `,
    sql<FinanceTrendPointRecord>`
      select *
      from finance_trend_points
      where tenant_slug = ${filters.tenantSlug}
        and timeframe = ${filters.timeframe}
        ${filters.regionId ? sql`and (region_id is null or region_id = ${filters.regionId})` : sql``}
        ${filters.branchId ? sql`and (branch_id is null or branch_id = ${filters.branchId})` : sql``}
      order by created_at asc
    `,
  ]);

  return { accounts, receivables, payables, expenses, trendPoints };
}

function hasAnyFinanceData(data: FinanceDataSets): boolean {
  return Boolean(
    data.accounts.length || data.receivables.length || data.payables.length || data.expenses.length || data.trendPoints.length
  );
}

function mapAccountRow(row: FinanceAccountRecord): FinanceDashboardSnapshot["cashAccounts"][number] {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    balance: formatCurrencyCompact(Number(row.balance ?? 0), row.currency ?? DEFAULT_CURRENCY),
    currency: row.currency ?? DEFAULT_CURRENCY,
    trend: row.trend === "down" ? "down" : "up",
    change: formatAccountChange(row),
    region: humanizeOrgLabel(row.region_id) ?? "Global",
  };
}

function mapScheduleRow(row: FinanceScheduleRecord): FinanceDashboardSnapshot["receivables"][number] {
  return {
    id: row.id,
    entity: row.entity_name,
    amount: formatCurrencyCompact(Number(row.amount ?? 0), row.currency ?? DEFAULT_CURRENCY),
    dueDate: formatDueDate(row.due_date),
    status: normalizeScheduleStatus(row.status),
    branch: humanizeOrgLabel(row.branch_id) ?? humanizeOrgLabel(row.region_id) ?? "Global",
  };
}

function mapExpenseRow(row: FinanceExpenseCategoryRecord): FinanceDashboardSnapshot["expenseBreakdown"][number] {
  return {
    label: row.label,
    amount: formatCurrencyCompact(Number(row.amount ?? 0), DEFAULT_CURRENCY),
    delta: formatPercentDelta(row.delta_percent ?? 0),
    direction: row.direction === "down" ? "down" : "up",
  };
}

function mapTrendSeries(rows: FinanceTrendPointRecord[]): FinanceDashboardSnapshot["trend"] {
  const sorted = [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return {
    labels: sorted.map((row) => row.label),
    revenue: sorted.map((row) => Number(row.revenue ?? 0)),
    expenses: sorted.map((row) => Number(row.expenses ?? 0)),
  };
}

function buildFinanceMetrics(input: {
  accounts: FinanceAccountRecord[];
  receivables: FinanceScheduleRecord[];
  trend: FinanceDashboardSnapshot["trend"];
}): FinanceDashboardSnapshot["metrics"] {
  const totalRevenue = sumArray(input.trend.revenue);
  const totalExpenses = sumArray(input.trend.expenses);
  const revenueDelta = computeSeriesDelta(input.trend.revenue);
  const expenseDelta = computeSeriesDelta(input.trend.expenses);
  const netCash = input.accounts.reduce((total, account) => total + Number(account.balance ?? 0), 0);
  const netCashDelta = input.accounts.reduce((total, account) => total + Number(account.change_value ?? 0), 0);
  const dsoDays = calculateDsoDays(input.receivables);
  const dsoDelta = dsoDays - 45; // target benchmark
  const monthlyBurn = totalExpenses || 1;
  const cashRunwayMonths = Math.max(netCash / (monthlyBurn / 4 || 1), 0); // approximate quarter view
  const cashRunwayDelta = cashRunwayMonths - 12;

  return [
    {
      label: "Monthly revenue",
      value: formatCurrencyCompact(totalRevenue, DEFAULT_CURRENCY),
      delta: formatPercentDelta(revenueDelta),
      trend: revenueDelta >= 0 ? "up" : "down",
      description: "vs start of period",
    },
    {
      label: "OpEx burn",
      value: formatCurrencyCompact(totalExpenses, DEFAULT_CURRENCY),
      delta: formatPercentDelta(expenseDelta),
      trend: expenseDelta >= 0 ? "up" : "down",
      description: "timeframe spend",
    },
    {
      label: "Days sales outstanding",
      value: `${dsoDays} days`,
      delta: formatSignedNumber(dsoDelta, 0),
      trend: dsoDelta <= 0 ? "up" : "down",
      description: "collections velocity",
    },
    {
      label: "Cash runway",
      value: `${cashRunwayMonths.toFixed(1)} mo`,
      delta: formatSignedNumber(cashRunwayDelta, 1),
      trend: cashRunwayDelta >= 0 ? "up" : "down",
      description: formatCurrencyCompact(netCash, DEFAULT_CURRENCY),
    },
  ];
}

function normalizeScheduleStatus(status?: string | null): "current" | "due_soon" | "overdue" {
  if (status === "due_soon" || status === "overdue") {
    return status;
  }
  return "current";
}

function formatAccountChange(row: FinanceAccountRecord): string {
  if (row.change_value === null || row.change_value === undefined) {
    return "Stable";
  }
  const value = Number(row.change_value);
  if (!Number.isFinite(value) || value === 0) {
    return "Stable";
  }
  const formatted = formatCurrencyCompact(Math.abs(value), row.currency ?? DEFAULT_CURRENCY);
  const prefix = value >= 0 ? "+" : "-";
  const period = row.change_period ? ` vs ${row.change_period}` : "";
  return `${prefix}${formatted} ${period}`.trim();
}

function formatDueDate(dateInput: string | Date): string {
  const due = new Date(dateInput);
  if (Number.isNaN(due.getTime())) {
    return "No due date";
  }
  const diffMs = due.getTime() - Date.now();
  const diffDays = Math.round(diffMs / MS_PER_DAY);
  if (diffDays > 1) {
    return `Due in ${diffDays}d`;
  }
  if (diffDays === 1) {
    return "Due tomorrow";
  }
  if (diffDays === 0) {
    return "Today";
  }
  return `${Math.abs(diffDays)}d overdue`;
}

function formatCurrencyCompact(value: number, currency = DEFAULT_CURRENCY): string {
  if (!Number.isFinite(value)) {
    return `${currency}0`;
  }
  const formatter = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  });
  const formatted = formatter.format(Math.abs(value));
  return `${value < 0 ? "-" : ""}${currency}${formatted}`;
}

function formatPercentDelta(value: number): string {
  if (!Number.isFinite(value) || value === 0) {
    return "0%";
  }
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

function formatSignedNumber(value: number, digits: number): string {
  if (!Number.isFinite(value) || Math.abs(value) < Math.pow(10, -digits) / 2) {
    return "0";
  }
  const formatted = value.toFixed(digits);
  if (value > 0) {
    return `+${formatted}`;
  }
  return formatted;
}

function sumArray(values: number[]): number {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

function computeSeriesDelta(series: number[]): number {
  if (series.length < 2) {
    return 0;
  }
  const first = series[0] ?? 0;
  const last = series[series.length - 1] ?? 0;
  const baseline = Math.abs(first) > 1 ? Math.abs(first) : 1;
  return ((last - first) / baseline) * 100;
}

function calculateDsoDays(receivables: FinanceScheduleRecord[]): number {
  if (!receivables.length) {
    return 42;
  }
  const now = Date.now();
  const totalDays = receivables.reduce((total, doc) => {
    const due = new Date(doc.due_date).getTime();
    if (Number.isNaN(due)) {
      return total;
    }
    const diffDays = (now - due) / MS_PER_DAY;
    return total + Math.max(diffDays, 0);
  }, 0);
  return Math.max(Math.round(totalDays / receivables.length), 15);
}

function humanizeOrgLabel(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  return value
    .split(/[-_]/g)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
// GL Posting and Journal Entry Service

import type { Expense, ExpenseTaxType } from "@/lib/finance/types";

export type JournalEntry = {
  id: string;
  expenseId: string;
  account: string;
  accountId: string;
  debit: number;
  credit: number;
  description: string;
  reference: string;
  entryDate: string;
  createdAt: string;
};

/**
 * Generate journal entries for an expense based on its type and tax treatment
 * Supports 6 scenarios: Standard Vendor, VAT, WHT, Prepaid, Reimbursement, Cash
 */
export function generateExpenseJournalEntries(expense: Expense): JournalEntry[] {
  const entries: JournalEntry[] = [];
  const date = new Date().toISOString();
  const baseRef = `EXP-${expense.id.substring(0, 8)}`;

  switch (expense.type) {
    case "vendor": {
      // Scenario 1 & 2: Standard Vendor Purchase (with optional VAT/WHT)
      // Debit: Expense GL account (category-specific)
      const expenseGl = getGLAccountForCategory(expense.categoryId);
      entries.push({
        id: `je_${expense.id}_1`,
        expenseId: expense.id,
        account: `Expense - ${expense.category}`,
        accountId: expenseGl,
        debit: expense.amount,
        credit: 0,
        description: `Vendor expense: ${expense.description}`,
        reference: baseRef,
        entryDate: expense.date,
        createdAt: date,
      });

      // Credit: Payable (GL 2100)
      entries.push({
        id: `je_${expense.id}_2`,
        expenseId: expense.id,
        account: "Accounts Payable",
        accountId: "2100",
        debit: 0,
        credit: expense.amount,
        description: `Payable to ${expense.vendor || "vendor"}`,
        reference: baseRef,
        entryDate: expense.date,
        createdAt: date,
      });

      // Handle VAT or WHT if applicable
      if (expense.taxType === "VAT") {
        // Scenario 2: VAT Entry
        // Debit: Input Tax (GL 1050) - recoverable
        entries.push({
          id: `je_${expense.id}_3`,
          expenseId: expense.id,
          account: "Input Tax - VAT",
          accountId: "1050",
          debit: expense.taxAmount,
          credit: 0,
          description: `VAT 7.5% on vendor purchase`,
          reference: baseRef,
          entryDate: expense.date,
          createdAt: date,
        });

        // Credit: Payable (increase by tax)
        entries.push({
          id: `je_${expense.id}_4`,
          expenseId: expense.id,
          account: "Accounts Payable",
          accountId: "2100",
          debit: 0,
          credit: expense.taxAmount,
          description: `VAT payable on vendor purchase`,
          reference: baseRef,
          entryDate: expense.date,
          createdAt: date,
        });
      } else if (expense.taxType === "WHT") {
        // Scenario 3: WHT Entry (professional services)
        // Debit: WHT Receivable (GL 1600)
        entries.push({
          id: `je_${expense.id}_3`,
          expenseId: expense.id,
          account: "Withholding Tax Receivable",
          accountId: "1600",
          debit: expense.taxAmount,
          credit: 0,
          description: `WHT 5% on professional services`,
          reference: baseRef,
          entryDate: expense.date,
          createdAt: date,
        });

        // Credit: Payable (already includes WHT)
        // Amount paid to vendor = gross - WHT
        const netAmount = expense.amount - expense.taxAmount;
        entries.push({
          id: `je_${expense.id}_4`,
          expenseId: expense.id,
          account: "Accounts Payable",
          accountId: "2100",
          debit: 0,
          credit: netAmount,
          description: `Net payable to vendor (after WHT)`,
          reference: baseRef,
          entryDate: expense.date,
          createdAt: date,
        });
      }
      break;
    }

    case "reimbursement": {
      // Scenario 5: Employee Reimbursement
      // Debit: Expense GL account
      const expenseGl = getGLAccountForCategory(expense.categoryId);
      entries.push({
        id: `je_${expense.id}_1`,
        expenseId: expense.id,
        account: `Expense - ${expense.category}`,
        accountId: expenseGl,
        debit: expense.amount,
        credit: 0,
        description: `Employee reimbursement: ${expense.description}`,
        reference: baseRef,
        entryDate: expense.date,
        createdAt: date,
      });

      // Credit: Employee Receivable (GL 1300) - will be offset when reimbursed
      entries.push({
        id: `je_${expense.id}_2`,
        expenseId: expense.id,
        account: "Employee Advances/Receivables",
        accountId: "1300",
        debit: 0,
        credit: expense.amount,
        description: `Reimbursement to employee`,
        reference: baseRef,
        entryDate: expense.date,
        createdAt: date,
      });

      // Handle tax on reimbursement
      if (expense.taxType === "VAT") {
        entries.push({
          id: `je_${expense.id}_3`,
          expenseId: expense.id,
          account: "Input Tax - VAT",
          accountId: "1050",
          debit: expense.taxAmount,
          credit: 0,
          description: `VAT on reimbursable expense`,
          reference: baseRef,
          entryDate: expense.date,
          createdAt: date,
        });

        entries.push({
          id: `je_${expense.id}_4`,
          expenseId: expense.id,
          account: "Employee Advances/Receivables",
          accountId: "1300",
          debit: 0,
          credit: expense.taxAmount,
          description: `VAT component of reimbursement`,
          reference: baseRef,
          entryDate: expense.date,
          createdAt: date,
        });
      }
      break;
    }

    case "cash": {
      // Scenario 6: Cash Expense (petty cash)
      // Debit: Expense GL account
      const expenseGl = getGLAccountForCategory(expense.categoryId);
      entries.push({
        id: `je_${expense.id}_1`,
        expenseId: expense.id,
        account: `Expense - ${expense.category}`,
        accountId: expenseGl,
        debit: expense.amount,
        credit: 0,
        description: `Cash expense: ${expense.description}`,
        reference: baseRef,
        entryDate: expense.date,
        createdAt: date,
      });

      // Credit: Cash (GL 1000)
      entries.push({
        id: `je_${expense.id}_2`,
        expenseId: expense.id,
        account: "Cash on Hand",
        accountId: "1000",
        debit: 0,
        credit: expense.amount,
        description: `Cash payment for expense`,
        reference: baseRef,
        entryDate: expense.date,
        createdAt: date,
      });
      break;
    }

    case "prepaid": {
      // Scenario 4: Prepaid Expense (multi-period)
      // Debit: Prepaid GL (GL 1200) - amortized over periods
      entries.push({
        id: `je_${expense.id}_1`,
        expenseId: expense.id,
        account: "Prepaid Expenses",
        accountId: "1200",
        debit: expense.amount,
        credit: 0,
        description: `Prepaid ${expense.category} (to be amortized)`,
        reference: baseRef,
        entryDate: expense.date,
        createdAt: date,
      });

      // Credit: Payable or Cash
      const creditAccount = expense.vendor ? "2100" : "1000"; // Payable or Cash
      const creditLabel = expense.vendor ? "Accounts Payable" : "Cash on Hand";
      entries.push({
        id: `je_${expense.id}_2`,
        expenseId: expense.id,
        account: creditLabel,
        accountId: creditAccount,
        debit: 0,
        credit: expense.amount,
        description: `Payment for prepaid ${expense.category}`,
        reference: baseRef,
        entryDate: expense.date,
        createdAt: date,
      });

      // Add amortization note to metadata
      if (expense.prepaidSchedule) {
        entries.push({
          id: `je_${expense.id}_3`,
          expenseId: expense.id,
          account: "Prepaid Amortization Schedule",
          accountId: "1200",
          debit: 0,
          credit: 0,
          description: `Amortization: ${JSON.stringify(expense.prepaidSchedule)}`,
          reference: baseRef,
          entryDate: expense.date,
          createdAt: date,
        });
      }
      break;
    }
  }

  return entries;
}

/**
 * Get GL account for expense category
 */
function getGLAccountForCategory(categoryId: string): string {
  const categoryGLMap: Record<string, string> = {
    cat_travel: "6010",
    cat_supplies: "6020",
    cat_meals: "6030",
    cat_insurance: "6040",
    cat_professional: "6050",
  };
  return categoryGLMap[categoryId] || "6999"; // Default to miscellaneous expense
}

/**
 * Get GL account for tax type
 */
function getGLAccountForTax(taxType: ExpenseTaxType): string {
  switch (taxType) {
    case "VAT":
      return "1050"; // Input Tax - Recoverable
    case "WHT":
      return "2080"; // Withholding Tax Payable
    default:
      return "";
  }
}

/**
 * Calculate budget usage for an expense
 */
export function calculateBudgetUsage(categoryLimit: number | undefined, spent: number): {
  usage: number;
  status: "normal" | "warning" | "critical";
} {
  if (!categoryLimit || categoryLimit === 0) {
    return { usage: 0, status: "normal" };
  }

  const percentage = (spent / categoryLimit) * 100;
  let status: "normal" | "warning" | "critical" = "normal";

  if (percentage >= 95) {
    status = "critical";
  } else if (percentage >= 80) {
    status = "warning";
  }

  return {
    usage: Math.min(percentage, 100),
    status,
  };
}

/**
 * Determine approval routing based on amount
 */
export function determineApprovalRoute(amount: number): {
  levels: Array<{ level: number; role: "MANAGER" | "FINANCE" | "EXECUTIVE"; threshold: number }>;
  routeDescription: string;
} {
  if (amount <= 50000) {
    return {
      levels: [{ level: 1, role: "MANAGER", threshold: 50000 }],
      routeDescription: "Manager approval only (≤ ₦50,000)",
    };
  } else if (amount <= 500000) {
    return {
      levels: [
        { level: 1, role: "MANAGER", threshold: 50000 },
        { level: 2, role: "FINANCE", threshold: 500000 },
      ],
      routeDescription: "Manager + Finance approval (₦50K - ₦500K)",
    };
  } else {
    return {
      levels: [
        { level: 1, role: "MANAGER", threshold: 50000 },
        { level: 2, role: "FINANCE", threshold: 500000 },
        { level: 3, role: "EXECUTIVE", threshold: Infinity },
      ],
      routeDescription: "All 3 levels required (> ₦500K)",
    };
  }
}