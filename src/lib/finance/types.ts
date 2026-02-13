export type TenantId = string;

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export interface ChartOfAccount {
  id: string;
  tenant_id: TenantId;
  code: string;
  name: string;
  type: AccountType;
  parent_id?: string | null;
  metadata?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
}

export interface JournalLine {
  id?: string;
  journal_entry_id?: string;
  tenant_id: TenantId;
  account_id: string;
  amount: number; // positive value
  side: 'debit' | 'credit';
  description?: string | null;
}

export interface JournalEntry {
  id?: string;
  tenant_id: TenantId;
  reference?: string | null;
  description?: string | null;
  posted_at?: string | null;
  status?: 'draft' | 'posted' | 'reversed';
  source?: string | null;
  metadata?: Record<string, any> | null;
  created_by?: string | null;
  created_at?: string | null;
  lines?: JournalLine[];
}

export interface Invoice {
  id?: string;
  tenant_id: TenantId;
  number?: string;
  customer_id?: string;
  amount_total: number;
  amount_due: number;
  status?: 'draft' | 'open' | 'paid' | 'void';
  due_date?: string | null;
  metadata?: Record<string, any> | null;
}

export interface Payment {
  id?: string;
  tenant_id: TenantId;
  invoice_id?: string | null;
  amount: number;
  method?: string | null;
  reference?: string | null;
  processed_at?: string | null;
  metadata?: Record<string, any> | null;
}
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

export type FinanceAccount = {
  id: string;
  tenantSlug: string;
  regionId: string | null;
  branchId: string | null;
  name: string;
  type: "bank" | "cash";
  currency: string;
  balance: number;
  changeValue: number | null;
  changePeriod: string | null;
  trend: "up" | "down";
  createdAt: string;
  updatedAt: string;
};

const financeAccountSharedSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["bank", "cash"]),
  currency: z.string().min(1).default("₦"),
  balance: z.coerce.number(),
  regionId: z.string().optional(),
  branchId: z.string().optional(),
  changeValue: z.coerce.number().optional(),
  changePeriod: z.string().optional(),
  trend: z.enum(["up", "down"]).default("up"),
});

export const financeAccountCreateSchema = financeAccountSharedSchema.extend({
  tenantSlug: z.string().min(1),
});

export const financeAccountUpdateSchema = financeAccountSharedSchema.partial();

export type FinanceAccountCreateInput = z.infer<typeof financeAccountCreateSchema>;
export type FinanceAccountUpdateInput = z.infer<typeof financeAccountUpdateSchema>;

export const FINANCE_INVOICE_STATUSES = ["draft", "sent", "partially_paid", "paid", "overdue", "void"] as const;
export type FinanceInvoiceStatus = (typeof FINANCE_INVOICE_STATUSES)[number];

export type FinanceInvoiceLine = {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  accountCode?: string;
  taxRate?: number | null;
  amount?: number;
};

export type FinanceInvoice = {
  id: string;
  tenantSlug: string;
  regionId: string | null;
  branchId: string | null;
  customerName: string;
  customerCode?: string | null;
  invoiceNumber: string;
  purchaseOrder?: string | null;
  issuedDate: string;
  dueDate: string;
  currency: string;
  amount: number;
  balanceDue: number;
  status: FinanceInvoiceStatus;
  paymentTerms?: string | null;
  notes?: string | null;
  tags?: string[];
  lineItems: FinanceInvoiceLine[];
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

const financeInvoiceLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0),
  accountCode: z.string().min(1).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  amount: z.coerce.number().min(0).optional(),
});

const financeInvoiceSharedSchema = z.object({
  customerName: z.string().min(1),
  customerCode: z.string().optional(),
  invoiceNumber: z.string().min(1),
  purchaseOrder: z.string().optional(),
  issuedDate: z.string().min(1),
  dueDate: z.string().min(1),
  currency: z.string().min(1).default("₦"),
  amount: z.coerce.number().min(0),
  balanceDue: z.coerce.number().min(0).optional(),
  status: z.enum(FINANCE_INVOICE_STATUSES).default("draft"),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string().min(1)).optional(),
  lineItems: z.array(financeInvoiceLineSchema).min(1),
  metadata: z.record(z.unknown()).optional(),
});

export const financeInvoiceCreateSchema = financeInvoiceSharedSchema.extend({
  tenantSlug: z.string().min(1),
  regionId: z.string().optional(),
  branchId: z.string().optional(),
});

export const financeInvoiceUpdateSchema = financeInvoiceSharedSchema.partial().extend({
  tenantSlug: z.string().min(1).optional(),
  regionId: z.string().optional(),
  branchId: z.string().optional(),
});

export type FinanceInvoiceCreateInput = z.infer<typeof financeInvoiceCreateSchema>;
export type FinanceInvoiceUpdateInput = z.infer<typeof financeInvoiceUpdateSchema>;

// Expense Management Types

export const EXPENSE_TYPES = ["vendor", "reimbursement", "cash", "prepaid"] as const;
export type ExpenseType = (typeof EXPENSE_TYPES)[number];

export const EXPENSE_TAX_TYPES = ["VAT", "WHT", "NONE"] as const;
export type ExpenseTaxType = (typeof EXPENSE_TAX_TYPES)[number];

export const EXPENSE_APPROVAL_STATUSES = ["DRAFT", "PENDING", "APPROVED", "REJECTED", "CLARIFY_NEEDED"] as const;
export type ExpenseApprovalStatus = (typeof EXPENSE_APPROVAL_STATUSES)[number];

export const EXPENSE_PAYMENT_STATUSES = ["UNPAID", "PAID", "REIMBURSED", "PENDING"] as const;
export type ExpensePaymentStatus = (typeof EXPENSE_PAYMENT_STATUSES)[number];

export const EXPENSE_APPROVER_ROLES = ["MANAGER", "FINANCE", "EXECUTIVE"] as const;
export type ExpenseApproverRole = (typeof EXPENSE_APPROVER_ROLES)[number];

export type ExpenseApproval = {
  id: string;
  expenseId: string;
  approverRole: ExpenseApproverRole;
  approverId: string;
  approverName: string;
  action: "APPROVED" | "REJECTED" | "PENDING" | "CLARIFY_NEEDED";
  reason?: string | null;
  timestamp: string;
  amountThreshold: number;
};

export type ExpenseAuditLog = {
  id: string;
  expenseId: string;
  action: string;
  timestamp: string;
  user: string;
  details?: Record<string, unknown> | null;
};

export type ExpenseCategory = {
  id: string;
  code: string;
  name: string;
  accountId: string;
  requiresVendor: boolean;
  requiresReceipt: boolean;
  categoryLimit?: number | null;
  policyDescription?: string | null;
};

export type Expense = {
  id: string;
  tenantSlug: string;
  regionId: string | null;
  branchId: string | null;
  type: ExpenseType;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  taxType: ExpenseTaxType;
  category: string;
  categoryId: string;
  description: string;
  vendor?: string | null;
  date: string;
  approvalStatus: ExpenseApprovalStatus;
  paymentStatus: ExpensePaymentStatus;
  approvals: ExpenseApproval[];
  auditLog: ExpenseAuditLog[];
  glAccountId?: string | null;
  notes?: string | null;
  attachments?: string[] | null;
  prepaidSchedule?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

// Schemas for validation

const expenseApprovalSchema = z.object({
  approverRole: z.enum(EXPENSE_APPROVER_ROLES),
  approverId: z.string().min(1),
  approverName: z.string().min(1),
  action: z.enum(["APPROVED", "REJECTED", "PENDING", "CLARIFY_NEEDED"]),
  reason: z.string().optional(),
  amountThreshold: z.coerce.number().min(0),
});

const expenseSharedSchema = z.object({
  type: z.enum(EXPENSE_TYPES),
  amount: z.coerce.number().min(0),
  taxType: z.enum(EXPENSE_TAX_TYPES),
  category: z.string().min(1),
  categoryId: z.string().min(1),
  description: z.string().min(1),
  vendor: z.string().optional(),
  date: z.string().min(1),
  approvalStatus: z.enum(EXPENSE_APPROVAL_STATUSES).default("DRAFT"),
  paymentStatus: z.enum(EXPENSE_PAYMENT_STATUSES).default("UNPAID"),
  notes: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const expenseCreateSchema = expenseSharedSchema.extend({
  tenantSlug: z.string().min(1),
  regionId: z.string().optional(),
  branchId: z.string().optional(),
  createdBy: z.string().min(1),
});

export const expenseUpdateSchema = expenseSharedSchema.partial().extend({
  tenantSlug: z.string().min(1).optional(),
});

export const expenseApproveSchema = z.object({
  tenantSlug: z.string().min(1),
  action: z.enum(["APPROVED", "REJECTED", "CLARIFY_NEEDED"]),
  reason: z.string().optional(),
  approverRole: z.enum(EXPENSE_APPROVER_ROLES),
  approverId: z.string().min(1),
  approverName: z.string().min(1),
});

export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;
export type ExpenseUpdateInput = z.infer<typeof expenseUpdateSchema>;
export type ExpenseApproveInput = z.infer<typeof expenseApproveSchema>;
