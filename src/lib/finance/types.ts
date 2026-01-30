import { z } from "zod";

export const FINANCE_TIMEFRAMES = ["last_24_hours", "last_7_days", "last_30_days", "quarter_to_date"] as const;
export type FinanceTimeframe = (typeof FINANCE_TIMEFRAMES)[number];

export const financeFiltersSchema = z.object({
  tenantSlug: z.string().min(1),
  regionId: z.string().optional(),
  branchId: z.string().optional(),
  timeframe: z.enum(FINANCE_TIMEFRAMES).default("last_7_days"),
});

export type FinanceFilters = z.infer<typeof financeFiltersSchema>;

export type FinanceScheduleStatus = "current" | "due_soon" | "overdue";

export type FinanceScheduleItem = {
  id: string;
  entity: string;
  amount: string;
  dueDate: string;
  status: FinanceScheduleStatus;
  branch: string;
};

export type FinanceCashAccount = {
  id: string;
  name: string;
  type: "bank" | "cash";
  balance: string;
  currency: string;
  trend: "up" | "down";
  change: string;
  region: string;
};

export type FinanceExpenseBreakdown = {
  label: string;
  amount: string;
  delta: string;
  direction: "up" | "down";
};

export type FinanceTrendSnapshot = {
  labels: string[];
  revenue: number[];
  expenses: number[];
};

export type FinanceDashboardSnapshot = {
  metrics: Array<{
    label: string;
    value: string;
    delta: string;
    trend: "up" | "down";
    description: string;
  }>;
  trend: FinanceTrendSnapshot;
  receivables: FinanceScheduleItem[];
  payables: FinanceScheduleItem[];
  cashAccounts: FinanceCashAccount[];
  expenseBreakdown: FinanceExpenseBreakdown[];
};
