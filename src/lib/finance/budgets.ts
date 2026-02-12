import { z } from "zod";

/**
 * Budget Types - Define the scope of the budget
 */
export type BudgetType = "DEPARTMENT" | "PROJECT" | "BRANCH" | "ACCOUNT_CATEGORY";
export const BUDGET_TYPES = ["DEPARTMENT", "PROJECT", "BRANCH", "ACCOUNT_CATEGORY"] as const;

/**
 * Budget Period Types
 */
export type BudgetPeriodType = "ANNUAL" | "QUARTERLY" | "MONTHLY";
export const BUDGET_PERIOD_TYPES = ["ANNUAL", "QUARTERLY", "MONTHLY"] as const;

/**
 * Budget Status
 */
export type BudgetStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "ACTIVE" | "CLOSED" | "ARCHIVED";
export const BUDGET_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "ACTIVE", "CLOSED", "ARCHIVED"] as const;

/**
 * Enforcement Mode - How strictly budgets are enforced
 */
export type EnforcementMode = "SOFT_WARNING" | "HARD_BLOCK" | "AUDIT_ONLY";
export const ENFORCEMENT_MODES = ["SOFT_WARNING", "HARD_BLOCK", "AUDIT_ONLY"] as const;

/**
 * Actual Type - Source of actual expenditure
 */
export type ActualType = "EXPENSE" | "INVOICE" | "PURCHASE_ORDER" | "PAYMENT";
export const ACTUAL_TYPES = ["EXPENSE", "INVOICE", "PURCHASE_ORDER", "PAYMENT"] as const;

/**
 * Variance Type
 */
export type VarianceType = "OVER_BUDGET" | "UNDER_BUDGET" | "THRESHOLD_WARNING";
export const VARIANCE_TYPES = ["OVER_BUDGET", "UNDER_BUDGET", "THRESHOLD_WARNING"] as const;

/**
 * Alert Level
 */
export type AlertLevel = "INFO" | "WARNING" | "CRITICAL";
export const ALERT_LEVELS = ["INFO", "WARNING", "CRITICAL"] as const;

/**
 * Forecast Type
 */
export type ForecastType = "ROLLING" | "TREND_BASED" | "SCENARIO";
export const FORECAST_TYPES = ["ROLLING", "TREND_BASED", "SCENARIO"] as const;

/**
 * Confidence Level for Forecasts
 */
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
export const CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;

/**
 * Variance Methodology
 */
export type ForecastMethodology = "avg_of_last_n_periods" | "trend_projection" | "custom_upload";
export const FORECAST_METHODOLOGIES = ["avg_of_last_n_periods", "trend_projection", "custom_upload"] as const;

/**
 * Budget Line Interface
 */
export interface BudgetLine {
  id?: bigint;
  budgetId: bigint;
  tenantId: bigint;
  lineNumber: number;
  accountId?: bigint;
  accountCode?: string;
  accountName?: string;
  costCenterId?: bigint;
  costCenterName?: string;
  projectId?: bigint;
  projectName?: string;
  budgetedAmount: number;
  allocationPercent?: number;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Budget Version Interface
 */
export interface BudgetVersion {
  id?: bigint;
  budgetId: bigint;
  tenantId: bigint;
  versionNumber: number;
  status: BudgetStatus;
  totalBudgetAmount: number;
  changeReason?: string;
  changedBy?: string;
  changedAt?: Date;
  budgetSnapshot?: Record<string, any>;
}

/**
 * Budget Actual Interface
 */
export interface BudgetActual {
  id?: bigint;
  budgetId: bigint;
  budgetLineId?: bigint;
  tenantId: bigint;
  actualType: ActualType;
  transactionId?: bigint;
  transactionCode?: string;
  actualAmount: number;
  committedAmount?: number;
  accountId?: bigint;
  accountCode?: string;
  costCenterId?: bigint;
  projectId?: bigint;
  transactionDate?: Date;
  recordedAt?: Date;
  notes?: string;
}

/**
 * Budget Forecast Interface
 */
export interface BudgetForecastLine {
  budgetLineId: bigint;
  forecastedAmount: number;
  confidenceLevel?: ConfidenceLevel;
}

export interface BudgetForecast {
  id?: bigint;
  budgetId: bigint;
  tenantId: bigint;
  forecastType: ForecastType;
  forecastPeriodStart?: Date;
  forecastPeriodEnd?: Date;
  forecastLines: BudgetForecastLine[];
  scenarioName?: string;
  scenarioDescription?: string;
  methodology?: ForecastMethodology;
  basePeriods?: number;
  confidenceLevel?: ConfidenceLevel;
  variancePercent?: number;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Budget Variance Interface
 */
export interface BudgetVariance {
  id?: bigint;
  budgetId: bigint;
  budgetLineId?: bigint;
  tenantId: bigint;
  varianceType: VarianceType;
  budgetedAmount?: number;
  actualAmount?: number;
  committedAmount?: number;
  varianceAmount: number;
  variancePercent: number;
  alertLevel: AlertLevel;
  isAcknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Budget Approval Interface
 */
export interface BudgetApproval {
  id?: bigint;
  budgetId: bigint;
  tenantId: bigint;
  approvalSequence: number;
  approverRole: string;
  approverId?: string;
  approverName?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  comment?: string;
  approvedAt?: Date;
}

/**
 * Budget Interface
 */
export interface Budget {
  id?: bigint;
  tenantId: bigint;
  code: string;
  name: string;
  description?: string;
  budgetType: BudgetType;
  scopeEntityId?: bigint;
  scopeEntityName?: string;
  periodType: BudgetPeriodType;
  fiscalYear: number;
  quarterNum?: number;
  monthNum?: number;
  totalBudgetAmount: number;
  status: BudgetStatus;
  enforcementMode: EnforcementMode;
  allowOverrun?: boolean;
  overrunThresholdPercent?: number;
  createdBy?: string;
  createdAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  versionNumber?: number;
  notes?: string;
}

/**
 * Budget Summary - View with calculated totals
 */
export interface BudgetSummary {
  id: bigint;
  tenantId: bigint;
  code: string;
  name: string;
  budgetType: BudgetType;
  periodType: BudgetPeriodType;
  fiscalYear: number;
  status: BudgetStatus;
  totalBudgetAmount: number;
  totalActual: number;
  totalCommitted: number;
  remainingBalance: number;
  percentUtilized: number;
  createdAt: Date;
  approvedAt?: Date;
}

/**
 * Budget Line Variance - View with variance details
 */
export interface BudgetLineVariance {
  budgetLineId: bigint;
  budgetId: bigint;
  tenantId: bigint;
  accountCode?: string;
  accountName?: string;
  budgetedAmount: number;
  actualAmount: number;
  committedAmount: number;
  remainingBalance: number;
  percentUtilized: number;
}

/**
 * Zod Schemas
 */

export const budgetLineSchema = z.object({
  lineNumber: z.number().int().positive(),
  accountId: z.bigint().optional(),
  accountCode: z.string().optional(),
  accountName: z.string().optional(),
  costCenterId: z.bigint().optional(),
  costCenterName: z.string().optional(),
  projectId: z.bigint().optional(),
  projectName: z.string().optional(),
  budgetedAmount: z.number().nonnegative(),
  allocationPercent: z.number().min(0).max(100).optional(),
  description: z.string().optional(),
});

export const budgetCreateSchema = z.object({
  tenantId: z.bigint(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  budgetType: z.enum(BUDGET_TYPES),
  scopeEntityId: z.bigint().optional(),
  scopeEntityName: z.string().optional(),
  periodType: z.enum(BUDGET_PERIOD_TYPES),
  fiscalYear: z.number().int().min(2000).max(2100),
  quarterNum: z.number().int().min(1).max(4).optional(),
  monthNum: z.number().int().min(1).max(12).optional(),
  totalBudgetAmount: z.number().nonnegative(),
  enforcementMode: z.enum(ENFORCEMENT_MODES).default("SOFT_WARNING"),
  allowOverrun: z.boolean().optional(),
  overrunThresholdPercent: z.number().min(100).max(500).optional(),
  notes: z.string().optional(),
  budgetLines: z.array(budgetLineSchema),
});

export const budgetUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  totalBudgetAmount: z.number().nonnegative().optional(),
  enforcementMode: z.enum(ENFORCEMENT_MODES).optional(),
  allowOverrun: z.boolean().optional(),
  overrunThresholdPercent: z.number().min(100).max(500).optional(),
  notes: z.string().optional(),
  changeReason: z.string().optional(),
});

export const budgetApproveSchema = z.object({
  tenantId: z.bigint(),
  budgetId: z.bigint(),
  approverRole: z.string().min(1),
  approverId: z.string().min(1),
  approverName: z.string().min(1),
  approve: z.boolean(),
  comment: z.string().optional(),
});

export const budgetActualSchema = z.object({
  budgetId: z.bigint(),
  budgetLineId: z.bigint().optional(),
  tenantId: z.bigint(),
  actualType: z.enum(ACTUAL_TYPES),
  transactionId: z.bigint().optional(),
  transactionCode: z.string().optional(),
  actualAmount: z.number().nonnegative(),
  committedAmount: z.number().nonnegative().optional(),
  accountId: z.bigint().optional(),
  accountCode: z.string().optional(),
  costCenterId: z.bigint().optional(),
  projectId: z.bigint().optional(),
  transactionDate: z.date().optional(),
  notes: z.string().optional(),
});

export const budgetForecastLineSchema = z.object({
  budgetLineId: z.bigint(),
  forecastedAmount: z.number().nonnegative(),
  confidenceLevel: z.enum(CONFIDENCE_LEVELS).optional(),
});

export const budgetForecastCreateSchema = z.object({
  budgetId: z.bigint(),
  tenantId: z.bigint(),
  forecastType: z.enum(FORECAST_TYPES),
  forecastPeriodStart: z.date().optional(),
  forecastPeriodEnd: z.date().optional(),
  forecastLines: z.array(budgetForecastLineSchema),
  scenarioName: z.string().optional(),
  scenarioDescription: z.string().optional(),
  methodology: z.enum(FORECAST_METHODOLOGIES).optional(),
  basePeriods: z.number().int().positive().optional(),
  confidenceLevel: z.enum(CONFIDENCE_LEVELS).optional(),
  variancePercent: z.number().min(0).max(100).optional(),
});

/**
 * Types for API requests/responses
 */
export type BudgetCreateInput = z.infer<typeof budgetCreateSchema>;
export type BudgetUpdateInput = z.infer<typeof budgetUpdateSchema>;
export type BudgetApproveInput = z.infer<typeof budgetApproveSchema>;
export type BudgetActualInput = z.infer<typeof budgetActualSchema>;
export type BudgetForecastCreateInput = z.infer<typeof budgetForecastCreateSchema>;
