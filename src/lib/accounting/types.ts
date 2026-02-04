import { z } from "zod";

/**
 * ACCOUNTING CORE TYPES
 * Multi-tenant accounting system with full double-entry bookkeeping support
 */

// ============================================================
// ENUMS
// ============================================================

export const ACCOUNT_TYPES = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "INCOME",
  "EXPENSE",
] as const;

export const JOURNAL_TYPES = [
  "MANUAL",
  "SYSTEM",
  "ADJUSTMENT",
  "REVERSING",
] as const;

export const APPROVAL_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "POSTED",
] as const;

export const PERIOD_STATUSES = ["OPEN", "CLOSED", "LOCKED"] as const;

// ============================================================
// CHART OF ACCOUNTS
// ============================================================

export interface ChartOfAccount {
  id: string;
  tenantSlug: string;
  accountCode: string;
  accountName: string;
  accountType: (typeof ACCOUNT_TYPES)[number];
  subType?: string;
  parentAccountId?: string | null;
  description?: string;
  currency: string;

  // System properties
  isSystemAccount: boolean;
  isActive: boolean;

  // Tagging
  branchId?: string | null;
  departmentId?: string | null;
  projectId?: string | null;

  // Controls
  allowManualPosting: boolean;
  requireCostCenter: boolean;
  isReconciliationAccount: boolean;

  // Metadata
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const chartOfAccountCreateSchema = z.object({
  tenantSlug: z.string().min(1),
  accountCode: z.string().min(1).max(50),
  accountName: z.string().min(1).max(255),
  accountType: z.enum(ACCOUNT_TYPES),
  subType: z.string().optional(),
  parentAccountId: z.string().uuid().optional(),
  description: z.string().optional(),
  currency: z.string().default("NGN"),
  isSystemAccount: z.boolean().default(false),
  isActive: z.boolean().default(true),
  branchId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  allowManualPosting: z.boolean().default(true),
  requireCostCenter: z.boolean().default(false),
  isReconciliationAccount: z.boolean().default(false),
  createdBy: z.string().optional(),
});

export const chartOfAccountUpdateSchema = z.object({
  accountName: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  allowManualPosting: z.boolean().optional(),
  requireCostCenter: z.boolean().optional(),
});

export type ChartOfAccountCreateInput = z.infer<typeof chartOfAccountCreateSchema>;
export type ChartOfAccountUpdateInput = z.infer<typeof chartOfAccountUpdateSchema>;

// ============================================================
// FISCAL PERIODS
// ============================================================

export interface FiscalPeriod {
  id: string;
  tenantSlug: string;
  fiscalYear: number;
  periodNumber: number; // 1-12
  periodName?: string;
  startDate: Date;
  endDate: Date;

  status: (typeof PERIOD_STATUSES)[number];
  lockedBy?: string | null;
  lockedAt?: Date | null;

  allowPosting: boolean;
  allowAdjustments: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const fiscalPeriodCreateSchema = z.object({
  tenantSlug: z.string().min(1),
  fiscalYear: z.number().int().min(2000).max(2100),
  periodNumber: z.number().int().min(1).max(12),
  periodName: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: z.enum(PERIOD_STATUSES).default("OPEN"),
  allowPosting: z.boolean().default(true),
  allowAdjustments: z.boolean().default(false),
});

export type FiscalPeriodCreateInput = z.infer<typeof fiscalPeriodCreateSchema>;

// ============================================================
// JOURNAL ENTRIES
// ============================================================

export interface JournalEntry {
  id: string;
  tenantSlug: string;
  journalNumber?: string;
  journalType: (typeof JOURNAL_TYPES)[number];

  fiscalPeriodId: string;
  postingDate: Date;
  referenceId?: string;
  referenceType?: string;

  totalDebit: number;
  totalCredit: number;

  description?: string;
  notes?: string;
  attachmentUrl?: string;

  approvalStatus: (typeof APPROVAL_STATUSES)[number];
  approvedBy?: string | null;
  approvedAt?: Date | null;

  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  postedAt?: Date | null;

  isReversing: boolean;
  reversedEntryId?: string | null;
}

export interface JournalLine {
  id: string;
  journalEntryId: string;
  lineNumber: number;

  accountId: string;
  debitAmount: number;
  creditAmount: number;

  branchId?: string | null;
  departmentId?: string | null;
  projectId?: string | null;
  costCenterId?: string | null;

  description?: string;

  isReconciled: boolean;
  reconciledAt?: Date | null;

  createdAt: Date;
}

export const journalLineSchema = z.object({
  lineNumber: z.number().int().positive(),
  accountId: z.string().uuid(),
  debitAmount: z.number().nonnegative().default(0),
  creditAmount: z.number().nonnegative().default(0),
  branchId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  costCenterId: z.string().uuid().optional(),
  description: z.string().optional(),
});

export const journalEntryCreateSchema = z.object({
  tenantSlug: z.string().min(1),
  journalType: z.enum(JOURNAL_TYPES),
  fiscalPeriodId: z.string().uuid(),
  postingDate: z.coerce.date(),
  referenceId: z.string().optional(),
  referenceType: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  attachmentUrl: z.string().url().optional(),
  createdBy: z.string(),
  lines: z.array(journalLineSchema).min(2), // At least 2 lines for double-entry
});

export const journalEntryApproveSchema = z.object({
  entryId: z.string().uuid(),
  approverEmail: z.string().email(),
  approverName: z.string(),
  action: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().optional(),
});

export type JournalEntryCreateInput = z.infer<typeof journalEntryCreateSchema>;
export type JournalLineInput = z.infer<typeof journalLineSchema>;
export type JournalEntryApproveInput = z.infer<typeof journalEntryApproveSchema>;

// ============================================================
// ACCOUNT BALANCES
// ============================================================

export interface AccountBalance {
  id: string;
  tenantSlug: string;
  accountId: string;
  fiscalPeriodId: string;

  openingBalance: number;
  periodDebit: number;
  periodCredit: number;
  closingBalance: number;

  lastUpdated: Date;
}

// ============================================================
// REPORTING
// ============================================================

export interface TrialBalance {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: (typeof ACCOUNT_TYPES)[number];
  balance: number;
  debitBalance: number;
  creditBalance: number;
}

export interface GeneralLedgerEntry {
  entryId: string;
  journalNumber?: string;
  journalType: (typeof JOURNAL_TYPES)[number];
  postingDate: Date;
  referenceId?: string;
  accountCode: string;
  accountName: string;
  accountType: (typeof ACCOUNT_TYPES)[number];
  debitAmount: number;
  creditAmount: number;
  description?: string;
  approvalStatus: (typeof APPROVAL_STATUSES)[number];
  createdBy: string;
  createdAt: Date;
}

// ============================================================
// AUDIT LOG
// ============================================================

export interface AccountingAuditLog {
  id: string;
  tenantSlug: string;
  entityType: string;
  entityId: string;
  action: string;
  changedFields?: Record<string, any>;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  userId?: string;
  userName?: string;
  ipAddress?: string;
  timestamp: Date;
}

// ============================================================
// POSTING INSTRUCTIONS FOR MODULES
// ============================================================

export interface InvoicePostingInstruction {
  tenantSlug: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  taxAmount: number;
  currency: string;
  invoiceDate: Date;
}

export interface PaymentPostingInstruction {
  tenantSlug: string;
  paymentId: string;
  customerId?: string;
  vendorId?: string;
  amount: number;
  paymentMethod: string;
  paymentDate: Date;
}

export interface ExpensePostingInstruction {
  tenantSlug: string;
  expenseId: string;
  amount: number;
  taxAmount?: number;
  category: string;
  expenseDate: Date;
}

export interface VendorPaymentPostingInstruction {
  tenantSlug: string;
  paymentId: string;
  vendorId: string;
  billIds: string[];
  amount: number;
  paymentDate: Date;
}

export interface PayrollPostingInstruction {
  tenantSlug: string;
  payrollId: string;
  employeeId: string;
  grossAmount: number;
  netAmount: number;
  deductions: Record<string, number>;
  payrollDate: Date;
}

// ============================================================
// API RESPONSES
// ============================================================

export interface PostingResult {
  success: boolean;
  journalEntryId?: string;
  journalNumber?: string;
  message: string;
  errors?: string[];
}

export interface TrialBalanceResponse {
  fiscalYear: number;
  period: number;
  totalDebits: number;
  totalCredits: number;
  entries: TrialBalance[];
  isBalanced: boolean;
}
