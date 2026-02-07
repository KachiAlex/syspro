/**
 * Budget Tracking Service
 * Manages expense budgets, usage tracking, and alerts
 */

export interface BudgetConfig {
  categoryId: string;
  categoryName: string;
  monthlyLimit: number;
  quarterlyLimit?: number;
  annualLimit?: number;
  alertThresholds: {
    warning: number; // 80% = warn
    critical: number; // 95% = critical
  };
}

export interface BudgetUsage {
  categoryId: string;
  categoryName: string;
  period: "monthly" | "quarterly" | "annual";
  limit: number;
  spent: number;
  remaining: number;
  usagePercentage: number;
  status: "normal" | "warning" | "critical" | "exceeded";
  approvalRequired: boolean;
}

export interface BudgetAlert {
  categoryId: string;
  categoryName: string;
  type: "warning" | "critical" | "exceeded";
  currentUsage: number;
  limit: number;
  threshold: number;
  timestamp: string;
  message: string;
}

/**
 * Default budget configurations for expense categories
 */
export const DEFAULT_BUDGETS: BudgetConfig[] = [
  {
    categoryId: "cat-001",
    categoryName: "Travel",
    monthlyLimit: 5000000, // ₦5M per month
    quarterlyLimit: 12000000, // ₦12M per quarter
    annualLimit: 48000000, // ₦48M per year
    alertThresholds: { warning: 0.8, critical: 0.95 },
  },
  {
    categoryId: "cat-002",
    categoryName: "Office Supplies",
    monthlyLimit: 2000000, // ₦2M per month
    quarterlyLimit: 5000000,
    annualLimit: 20000000,
    alertThresholds: { warning: 0.8, critical: 0.95 },
  },
  {
    categoryId: "cat-003",
    categoryName: "Meals & Entertainment",
    monthlyLimit: 1500000, // ₦1.5M per month
    quarterlyLimit: 3500000,
    annualLimit: 14000000,
    alertThresholds: { warning: 0.8, critical: 0.95 },
  },
  {
    categoryId: "cat-004",
    categoryName: "Insurance",
    monthlyLimit: 500000, // ₦500K per month
    quarterlyLimit: 1500000,
    annualLimit: 5000000,
    alertThresholds: { warning: 0.8, critical: 0.95 },
  },
  {
    categoryId: "cat-005",
    categoryName: "Professional Services",
    monthlyLimit: 3000000, // ₦3M per month
    quarterlyLimit: 8000000,
    annualLimit: 32000000,
    alertThresholds: { warning: 0.8, critical: 0.95 },
  },
];

/**
 * Calculate budget usage for a category in current month
 */
export function calculateMonthlyUsage(
  categoryId: string,
  spent: number,
  config?: BudgetConfig
): BudgetUsage {
  const budget =
    config || DEFAULT_BUDGETS.find((b) => b.categoryId === categoryId);

  if (!budget) {
    return {
      categoryId,
      categoryName: "Unknown",
      period: "monthly",
      limit: 0,
      spent,
      remaining: 0,
      usagePercentage: 0,
      status: "normal",
      approvalRequired: false,
    };
  }

  const limit = budget.monthlyLimit;
  const remaining = Math.max(0, limit - spent);
  const usagePercentage = (spent / limit) * 100;

  let status: "normal" | "warning" | "critical" | "exceeded";
  if (spent > limit) {
    status = "exceeded";
  } else if (usagePercentage >= budget.alertThresholds.critical * 100) {
    status = "critical";
  } else if (usagePercentage >= budget.alertThresholds.warning * 100) {
    status = "warning";
  } else {
    status = "normal";
  }

  return {
    categoryId,
    categoryName: budget.categoryName,
    period: "monthly",
    limit,
    spent,
    remaining,
    usagePercentage,
    status,
    approvalRequired: status === "critical" || status === "exceeded",
  };
}

/**
 * Calculate budget usage for a category in current quarter
 */
export function calculateQuarterlyUsage(
  categoryId: string,
  spent: number,
  config?: BudgetConfig
): BudgetUsage {
  const budget =
    config || DEFAULT_BUDGETS.find((b) => b.categoryId === categoryId);

  if (!budget || !budget.quarterlyLimit) {
    return {
      categoryId,
      categoryName: "Unknown",
      period: "quarterly",
      limit: 0,
      spent,
      remaining: 0,
      usagePercentage: 0,
      status: "normal",
      approvalRequired: false,
    };
  }

  const limit = budget.quarterlyLimit;
  const remaining = Math.max(0, limit - spent);
  const usagePercentage = (spent / limit) * 100;

  let status: "normal" | "warning" | "critical" | "exceeded";
  if (spent > limit) {
    status = "exceeded";
  } else if (usagePercentage >= budget.alertThresholds.critical * 100) {
    status = "critical";
  } else if (usagePercentage >= budget.alertThresholds.warning * 100) {
    status = "warning";
  } else {
    status = "normal";
  }

  return {
    categoryId,
    categoryName: budget.categoryName,
    period: "quarterly",
    limit,
    spent,
    remaining,
    usagePercentage,
    status,
    approvalRequired: status === "critical" || status === "exceeded",
  };
}

/**
 * Calculate budget usage for a category in current year
 */
export function calculateAnnualUsage(
  categoryId: string,
  spent: number,
  config?: BudgetConfig
): BudgetUsage {
  const budget =
    config || DEFAULT_BUDGETS.find((b) => b.categoryId === categoryId);

  if (!budget || !budget.annualLimit) {
    return {
      categoryId,
      categoryName: "Unknown",
      period: "annual",
      limit: 0,
      spent,
      remaining: 0,
      usagePercentage: 0,
      status: "normal",
      approvalRequired: false,
    };
  }

  const limit = budget.annualLimit;
  const remaining = Math.max(0, limit - spent);
  const usagePercentage = (spent / limit) * 100;

  let status: "normal" | "warning" | "critical" | "exceeded";
  if (spent > limit) {
    status = "exceeded";
  } else if (usagePercentage >= budget.alertThresholds.critical * 100) {
    status = "critical";
  } else if (usagePercentage >= budget.alertThresholds.warning * 100) {
    status = "warning";
  } else {
    status = "normal";
  }

  return {
    categoryId,
    categoryName: budget.categoryName,
    period: "annual",
    limit,
    spent,
    remaining,
    usagePercentage,
    status,
    approvalRequired: status === "critical" || status === "exceeded",
  };
}

/**
 * Get all budget usages for a month
 */
export function getAllMonthlyBudgets(
  categorySpending: Record<string, number>
): BudgetUsage[] {
  return DEFAULT_BUDGETS.map((budget) => {
    const spent = categorySpending[budget.categoryId] || 0;
    return calculateMonthlyUsage(budget.categoryId, spent, budget);
  });
}

/**
 * Check if expense requires additional approvals based on budget status
 */
export function requiresEscalatedApproval(usage: BudgetUsage): boolean {
  return usage.status === "critical" || usage.status === "exceeded";
}

/**
 * Generate budget alert if threshold is crossed
 */
export function generateBudgetAlert(usage: BudgetUsage): BudgetAlert | null {
  if (usage.status === "normal") return null;

  let type: "warning" | "critical" | "exceeded" = usage.status as
    | "warning"
    | "critical"
    | "exceeded";
  if (usage.status === "exceeded") type = "exceeded";

  const messages = {
    warning: `Budget warning for ${usage.categoryName}: ${usage.usagePercentage.toFixed(1)}% of ₦${(usage.limit / 1000000).toFixed(1)}M used`,
    critical: `Critical budget alert for ${usage.categoryName}: ${usage.usagePercentage.toFixed(1)}% of ₦${(usage.limit / 1000000).toFixed(1)}M used`,
    exceeded: `Budget exceeded for ${usage.categoryName}: ₦${(usage.spent / 1000000).toFixed(2)}M spent of ₦${(usage.limit / 1000000).toFixed(1)}M limit`,
  };

  return {
    categoryId: usage.categoryId,
    categoryName: usage.categoryName,
    type,
    currentUsage: usage.spent,
    limit: usage.limit,
    threshold:
      type === "critical"
        ? usage.limit * 0.95
        : type === "warning"
          ? usage.limit * 0.8
          : usage.limit,
    timestamp: new Date().toISOString(),
    message: messages[type],
  };
}

/**
 * Get budget summary for dashboard
 */
export function getBudgetSummary(
  categorySpending: Record<string, number>
): {
  totalBudget: number;
  totalSpent: number;
  overallUsage: number;
  criticalAlerts: BudgetAlert[];
  warningAlerts: BudgetAlert[];
} {
  const allUsages = getAllMonthlyBudgets(categorySpending);
  const alerts = allUsages
    .map((u) => generateBudgetAlert(u))
    .filter((a): a is BudgetAlert => a !== null);

  return {
    totalBudget: allUsages.reduce((sum, u) => sum + u.limit, 0),
    totalSpent: allUsages.reduce((sum, u) => sum + u.spent, 0),
    overallUsage: (allUsages.reduce((sum, u) => sum + u.spent, 0) /
      allUsages.reduce((sum, u) => sum + u.limit, 0)) * 100,
    criticalAlerts: alerts.filter((a) => a.type === "critical" || a.type === "exceeded"),
    warningAlerts: alerts.filter((a) => a.type === "warning"),
  };
}
