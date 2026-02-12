import { z } from "zod";

/**
 * ASSET & DEPRECIATION TYPES
 */

/**
 * Depreciation Methods
 */
export type DepreciationMethod = "STRAIGHT_LINE" | "REDUCING_BALANCE";
export const DEPRECIATION_METHODS = ["STRAIGHT_LINE", "REDUCING_BALANCE"] as const;

/**
 * Asset Status Lifecycle
 */
export type AssetStatus = "ACQUIRED" | "IN_USE" | "UNDER_MAINTENANCE" | "REVALUED" | "DISPOSED";
export const ASSET_STATUSES = ["ACQUIRED", "IN_USE", "UNDER_MAINTENANCE", "REVALUED", "DISPOSED"] as const;

/**
 * Disposal Methods
 */
export type DisposalMethod = "SCRAP" | "SALE" | "DONATION" | "EXCHANGE";
export const DISPOSAL_METHODS = ["SCRAP", "SALE", "DONATION", "EXCHANGE"] as const;

/**
 * Depreciation Schedule Status
 */
export type DepreciationScheduleStatus = "DRAFT" | "CALCULATED" | "POSTED" | "REVERSED";
export const DEPRECIATION_SCHEDULE_STATUSES = ["DRAFT", "CALCULATED", "POSTED", "REVERSED"] as const;

/**
 * Asset Category Interface
 */
export interface AssetCategory {
  id?: bigint;
  tenantId: bigint;
  code: string;
  name: string;
  description?: string;
  defaultUsefulLifeYears?: number;
  defaultDepreciationMethod: DepreciationMethod;
  defaultResidualPercent?: number;
  assetAccountId?: bigint;
  accumulatedDepreciationAccountId?: bigint;
  depreciationExpenseAccountId?: bigint;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Asset Interface
 */
export interface Asset {
  id?: bigint;
  tenantId: bigint;
  code: string;
  name: string;
  description?: string;
  categoryId: bigint;
  location?: string;
  costCenterId?: bigint;
  purchaseDate: Date;
  purchaseCost: number;
  purchaseInvoiceId?: bigint;
  usefulLifeYears: number;
  depreciationMethod: DepreciationMethod;
  residualValue?: number;
  accumulatedDepreciation?: number;
  netBookValue?: number;
  lastRevaluationDate?: Date;
  lastRevaluationAmount?: number;
  revaluationCount?: number;
  assetStatus: AssetStatus;
  depreciationStartedDate?: Date;
  depreciationEndDate?: Date;
  lastDepreciationDate?: Date;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Depreciation Schedule Interface
 */
export interface DepreciationSchedule {
  id?: bigint;
  tenantId: bigint;
  assetId: bigint;
  periodYear: number;
  periodMonth: number;
  periodStartDate: Date;
  periodEndDate: Date;
  openingNetBookValue: number;
  depreciationRate?: number;
  depreciationAmount: number;
  closingNetBookValue: number;
  isPosted?: boolean;
  journalEntryId?: bigint;
  postedAt?: Date;
  status: DepreciationScheduleStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Asset Journal Interface
 */
export interface AssetJournal {
  id?: bigint;
  tenantId: bigint;
  assetId: bigint;
  transactionType: "ACQUISITION" | "DEPRECIATION" | "REVALUATION" | "DISPOSAL";
  transactionDate: Date;
  debitAmount?: number;
  creditAmount?: number;
  debitAccountId?: bigint;
  creditAccountId?: bigint;
  journalEntryId?: bigint;
  postedToGL?: boolean;
  description?: string;
  referenceNumber?: string;
  createdBy?: string;
  createdAt?: Date;
}

/**
 * Asset Disposal Interface
 */
export interface AssetDisposal {
  id?: bigint;
  tenantId: bigint;
  assetId: bigint;
  disposalDate: Date;
  disposalMethod: DisposalMethod;
  salePrice?: number;
  netBookValueAtDisposal?: number;
  gainLoss?: number;
  cashReceiptAccountId?: bigint;
  gainLossAccountId?: bigint;
  journalEntryId?: bigint;
  isPosted?: boolean;
  notes?: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt?: Date;
}

/**
 * Asset Register Summary View
 */
export interface AssetRegisterSummary {
  id: bigint;
  tenantId: bigint;
  code: string;
  name: string;
  categoryName: string;
  purchaseDate: Date;
  purchaseCost: number;
  usefulLifeYears: number;
  depreciationMethod: DepreciationMethod;
  accumulatedDepreciation: number;
  netBookValue: number;
  assetStatus: AssetStatus;
  location?: string;
  purchaseYear: number;
  daysInUse: number;
}

/**
 * Depreciation Summary View
 */
export interface DepreciationSummary {
  tenantId: bigint;
  categoryId: bigint;
  categoryName: string;
  assetCount: number;
  totalPurchaseCost: number;
  totalAccumulatedDepreciation: number;
  totalNetBookValue: number;
  currentPeriodDepreciation: number;
}

/**
 * Zod Schemas
 */

export const assetCategoryCreateSchema = z.object({
  tenantId: z.bigint(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  defaultUsefulLifeYears: z.number().int().positive().default(5),
  defaultDepreciationMethod: z.enum(DEPRECIATION_METHODS as unknown as [string, ...string[]]),
  defaultResidualPercent: z.number().min(0).max(100).optional(),
  assetAccountId: z.bigint().optional(),
  accumulatedDepreciationAccountId: z.bigint().optional(),
  depreciationExpenseAccountId: z.bigint().optional(),
});

export const assetCreateSchema = z.object({
  tenantId: z.bigint(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  categoryId: z.bigint(),
  location: z.string().optional(),
  costCenterId: z.bigint().optional(),
  purchaseDate: z.date(),
  purchaseCost: z.number().nonnegative(),
  purchaseInvoiceId: z.bigint().optional(),
  usefulLifeYears: z.number().int().positive().default(5),
  depreciationMethod: z.enum(DEPRECIATION_METHODS as unknown as [string, ...string[]]),
  residualValue: z.number().nonnegative().optional(),
});

export const assetUpdateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  usefulLifeYears: z.number().int().positive().optional(),
  depreciationMethod: z.enum(DEPRECIATION_METHODS as unknown as [string, ...string[]]).optional(),
  residualValue: z.number().nonnegative().optional(),
  assetStatus: z.enum(ASSET_STATUSES as unknown as [string, ...string[]]).optional(),
});

export const depreciationScheduleCreateSchema = z.object({
  tenantId: z.bigint(),
  assetId: z.bigint(),
  periodYear: z.number().int().min(2000).max(2100),
  periodMonth: z.number().int().min(1).max(12),
  periodStartDate: z.date(),
  periodEndDate: z.date(),
});

export const assetDisposalCreateSchema = z.object({
  tenantId: z.bigint(),
  assetId: z.bigint(),
  disposalDate: z.date(),
  disposalMethod: z.enum(DISPOSAL_METHODS as unknown as [string, ...string[]]),
  salePrice: z.number().nonnegative().optional(),
  cashReceiptAccountId: z.bigint().optional(),
  gainLossAccountId: z.bigint().optional(),
  notes: z.string().optional(),
});

/**
 * Types for API requests/responses
 */
export type AssetCategoryCreateInput = z.infer<typeof assetCategoryCreateSchema>;
export type AssetCreateInput = z.infer<typeof assetCreateSchema>;
export type AssetUpdateInput = z.infer<typeof assetUpdateSchema>;
export type DepreciationScheduleCreateInput = z.infer<typeof depreciationScheduleCreateSchema>;
export type AssetDisposalCreateInput = z.infer<typeof assetDisposalCreateSchema>;

/**
 * FINANCIAL REPORTS TYPES
 */

export type ReportType = "P_AND_L" | "BALANCE_SHEET" | "CASH_FLOW" | "AGED_RECEIVABLES" | "AGED_PAYABLES";
export const REPORT_TYPES: ReportType[] = ["P_AND_L", "BALANCE_SHEET", "CASH_FLOW", "AGED_RECEIVABLES", "AGED_PAYABLES"];

export type ExportFormat = "PDF" | "EXCEL" | "CSV";
export const EXPORT_FORMATS: ExportFormat[] = ["PDF", "EXCEL", "CSV"];

/**
 * P&L Report Line
 */
export interface PnLReportLine {
  section: "REVENUE" | "EXPENSES";
  code: string;
  name: string;
  amountTotal: number;
  accountType: string;
  percentOfRevenue?: number;
}

export interface PnLReport {
  periodStart: Date;
  periodEnd: Date;
  tenantId: bigint;
  revenue: PnLReportLine[];
  expenses: PnLReportLine[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
}

/**
 * Balance Sheet Line
 */
export interface BalanceSheetLine {
  section: "ASSETS" | "LIABILITIES" | "EQUITY";
  code: string;
  name: string;
  balance: number;
  accountType: string;
  percentOfTotal?: number;
}

export interface BalanceSheet {
  asOfDate: Date;
  tenantId: bigint;
  assets: BalanceSheetLine[];
  liabilities: BalanceSheetLine[];
  equity: BalanceSheetLine[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

/**
 * Cash Flow Line
 */
export interface CashFlowLine {
  category: "OPERATING" | "INVESTING" | "FINANCING";
  date: Date;
  code: string;
  name: string;
  netCashFlow: number;
}

export interface CashFlowReport {
  periodStart: Date;
  periodEnd: Date;
  tenantId: bigint;
  operatingActivities: CashFlowLine[];
  investingActivities: CashFlowLine[];
  financingActivities: CashFlowLine[];
  netCashChange: number;
  beginningCash: number;
  endingCash: number;
}

/**
 * Aged Receivable
 */
export interface AgedReceivable {
  id: bigint;
  invoiceId: bigint;
  customerName: string;
  amount: number;
  daysOutstanding: number;
  agingBucket: "Current" | "31-60 days" | "61-90 days" | "91-120 days" | "Over 120 days";
  invoiceDate: Date;
  dueDate: Date;
  outstandingAmount: number;
}

export interface AgedReceivablesReport {
  asOfDate: Date;
  tenantId: bigint;
  receivables: AgedReceivable[];
  totalOutstanding: number;
  currentAmount: number;
  days31to60: number;
  days61to90: number;
  days91to120: number;
  over120Days: number;
}

/**
 * Aged Payable
 */
export interface AgedPayable {
  id: bigint;
  invoiceId: bigint;
  vendorName: string;
  amount: number;
  daysOutstanding: number;
  agingBucket: "Current" | "31-60 days" | "61-90 days" | "91-120 days" | "Over 120 days";
  invoiceDate: Date;
  dueDate: Date;
  outstandingAmount: number;
}

export interface AgedPayablesReport {
  asOfDate: Date;
  tenantId: bigint;
  payables: AgedPayable[];
  totalOutstanding: number;
  currentAmount: number;
  days31to60: number;
  days61to90: number;
  days91to120: number;
  over120Days: number;
}

/**
 * Report Filter Options
 */
export interface ReportFilters {
  tenantId: bigint;
  periodStart?: Date;
  periodEnd?: Date;
  branch?: string;
  department?: string;
  comparePreviousPeriod?: boolean;
  drillDownAccountId?: bigint;
}

/**
 * Drill Down Detail
 */
export interface DrillDownDetail {
  date: Date;
  description: string;
  reference: string;
  debitAmount?: number;
  creditAmount?: number;
  balance: number;
  journalEntryId: bigint;
}

/**
 * Report Export
 */
export interface ReportExport {
  reportType: ReportType;
  format: ExportFormat;
  fileName: string;
  contentType: string;
  data: Buffer | string;
}
