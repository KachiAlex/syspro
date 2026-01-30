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
