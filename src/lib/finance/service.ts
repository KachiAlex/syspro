import { FINANCE_BASELINE_SNAPSHOT } from "@/lib/finance/mock";
import type { FinanceDashboardSnapshot, FinanceFilters } from "@/lib/finance/types";
import {
  ensureFinanceTables,
  type FinanceAccountRecord,
  type FinanceScheduleRecord,
  type FinanceExpenseCategoryRecord,
  type FinanceTrendPointRecord,
} from "@/lib/finance/db";
import { ensureFinanceSeedForTenant } from "@/lib/finance/seed";
import { getSql } from "@/lib/db";

const SQL = getSql();
const DEFAULT_CURRENCY = "₦";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

  if (!hasAnyFinanceData(data)) {
    return FINANCE_BASELINE_SNAPSHOT;
  }

  const mappedTrend = data.trendPoints.length ? mapTrendSeries(data.trendPoints) : FINANCE_BASELINE_SNAPSHOT.trend;

  return {
    metrics: buildFinanceMetrics({ accounts: data.accounts, receivables: data.receivables, trend: mappedTrend }),
    trend: mappedTrend,
    receivables: data.receivables.length ? data.receivables.map(mapScheduleRow) : FINANCE_BASELINE_SNAPSHOT.receivables,
    payables: data.payables.length ? data.payables.map(mapScheduleRow) : FINANCE_BASELINE_SNAPSHOT.payables,
    cashAccounts: data.accounts.length ? data.accounts.map(mapAccountRow) : FINANCE_BASELINE_SNAPSHOT.cashAccounts,
    expenseBreakdown: data.expenses.length ? data.expenses.map(mapExpenseRow) : FINANCE_BASELINE_SNAPSHOT.expenseBreakdown,
  };
}

async function fetchFinanceData(filters: FinanceFilters): Promise<FinanceDataSets> {
  const sql = SQL;
  const [accounts, receivables, payables, expenses, trendPoints] = await Promise.all([
    sql<FinanceAccountRecord[]>`
      select *
      from finance_accounts
      where tenant_slug = ${filters.tenantSlug}
      ${filters.regionId ? sql`and (region_id is null or region_id = ${filters.regionId})` : sql``}
      ${filters.branchId ? sql`and (branch_id is null or branch_id = ${filters.branchId})` : sql``}
      order by balance desc
    `,
    sql<FinanceScheduleRecord[]>`
      select *
      from finance_schedules
      where tenant_slug = ${filters.tenantSlug}
        and document_type = 'receivable'
        ${filters.regionId ? sql`and (region_id is null or region_id = ${filters.regionId})` : sql``}
        ${filters.branchId ? sql`and (branch_id is null or branch_id = ${filters.branchId})` : sql``}
      order by due_date asc
      limit 12
    `,
    sql<FinanceScheduleRecord[]>`
      select *
      from finance_schedules
      where tenant_slug = ${filters.tenantSlug}
        and document_type = 'payable'
        ${filters.regionId ? sql`and (region_id is null or region_id = ${filters.regionId})` : sql``}
        ${filters.branchId ? sql`and (branch_id is null or branch_id = ${filters.branchId})` : sql``}
      order by due_date asc
      limit 12
    `,
    sql<FinanceExpenseCategoryRecord[]>`
      select *
      from finance_expense_categories
      where tenant_slug = ${filters.tenantSlug}
        ${filters.regionId ? sql`and (region_id is null or region_id = ${filters.regionId})` : sql``}
        ${filters.branchId ? sql`and (branch_id is null or branch_id = ${filters.branchId})` : sql``}
      order by amount desc
      limit 10
    `,
    sql<FinanceTrendPointRecord[]>`
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
