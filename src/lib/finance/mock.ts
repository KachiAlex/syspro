import type { FinanceDashboardSnapshot, FinanceFilters, FinanceScheduleItem } from "./types";

const FINANCE_TREND_BASELINE = {
  labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  revenue: [42, 48, 51, 47, 55, 39, 36],
  expenses: [31, 33, 36, 34, 37, 29, 28],
};

const FINANCE_RECEIVABLES_BASELINE: FinanceScheduleItem[] = [
  { id: "RCV-2048", entity: "Nova Retail", amount: "₦48.2M", dueDate: "Due in 2d", status: "due_soon", branch: "EMEA" },
  { id: "RCV-2052", entity: "Helix Grid", amount: "₦32.7M", dueDate: "Today", status: "current", branch: "APAC" },
  { id: "RCV-2054", entity: "Tembea Steel", amount: "₦64.3M", dueDate: "3d overdue", status: "overdue", branch: "Americas" },
  { id: "RCV-2058", entity: "Verdant FMCG", amount: "₦21.9M", dueDate: "Due in 5d", status: "current", branch: "EMEA" },
];

const FINANCE_PAYABLES_BASELINE: FinanceScheduleItem[] = [
  { id: "PYB-8811", entity: "Apex Suppliers", amount: "₦38.6M", dueDate: "Runs tonight", status: "current", branch: "Global" },
  { id: "PYB-8818", entity: "Atlas Metals", amount: "₦19.4M", dueDate: "Due in 1d", status: "due_soon", branch: "EMEA" },
  { id: "PYB-8820", entity: "Lagos Assembly", amount: "₦54.8M", dueDate: "5d overdue", status: "overdue", branch: "Nigeria" },
  { id: "PYB-8824", entity: "Carbon Freight", amount: "₦27.2M", dueDate: "Due in 4d", status: "current", branch: "APAC" },
];

const FINANCE_CASH_ACCOUNTS_BASELINE = [
  {
    id: "ACC-01",
    name: "Zenith Treasury",
    type: "bank",
    balance: "₦312.4M",
    currency: "₦",
    trend: "up" as const,
    change: "+₦8.2M vs last week",
    region: "Global",
  },
  {
    id: "ACC-02",
    name: "Ecobank Ops",
    type: "bank",
    balance: "₦148.0M",
    currency: "₦",
    trend: "down" as const,
    change: "-₦3.6M vs last week",
    region: "EMEA",
  },
  {
    id: "ACC-03",
    name: "Cash-in-Transit",
    type: "cash",
    balance: "₦42.6M",
    currency: "₦",
    trend: "up" as const,
    change: "+₦1.4M vs last week",
    region: "APAC",
  },
];

const FINANCE_EXPENSE_BREAKDOWN_BASELINE = [
  { label: "Cloud infrastructure", amount: "₦48.2M", delta: "+6.4%", direction: "up" as const },
  { label: "Logistics + freight", amount: "₦34.6M", delta: "-2.1%", direction: "down" as const },
  { label: "Payroll", amount: "₦128.9M", delta: "+1.2%", direction: "up" as const },
  { label: "Vendors & services", amount: "₦26.4M", delta: "-3.8%", direction: "down" as const },
];

export const FINANCE_BASELINE_SNAPSHOT: FinanceDashboardSnapshot = {
  metrics: [
    { label: "Monthly revenue", value: "₦812M", delta: "+4.2%", trend: "up", description: "vs prior period" },
    { label: "OpEx burn", value: "₦534M", delta: "-1.9%", trend: "down", description: "track to budget" },
    { label: "Days sales outstanding", value: "42 days", delta: "-3", trend: "up", description: "collections velocity" },
    { label: "Cash runway", value: "13.4 mo", delta: "+0.3", trend: "up", description: "multi-entity" },
  ],
  trend: FINANCE_TREND_BASELINE,
  receivables: FINANCE_RECEIVABLES_BASELINE,
  payables: FINANCE_PAYABLES_BASELINE,
  cashAccounts: FINANCE_CASH_ACCOUNTS_BASELINE,
  expenseBreakdown: FINANCE_EXPENSE_BREAKDOWN_BASELINE,
};

export const FINANCE_SCHEDULE_STATUS_META: Record<FinanceScheduleItem["status"], { label: string; chip: string }> = {
  current: { label: "Current", chip: "bg-emerald-50 text-emerald-600" },
  due_soon: { label: "Due soon", chip: "bg-amber-50 text-amber-600" },
  overdue: { label: "Overdue", chip: "bg-rose-50 text-rose-600" },
};

export function generateFinanceDashboardSnapshot(_filters?: Partial<FinanceFilters>): FinanceDashboardSnapshot {
  // In the future this can be driven by database queries. For now we return the baseline snapshot.
  return FINANCE_BASELINE_SNAPSHOT;
}
