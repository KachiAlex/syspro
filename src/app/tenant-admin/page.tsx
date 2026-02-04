"use client";

type CrmLeadRecord = {
  id: string;
  tenantSlug: string;
  regionId: string;
  branchId: string;
  companyName: string;
  contactName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  source: string;
  stage: string;
  assignedOfficerId?: string | null;
  expectedValue?: number | null;
  currency?: string | null;
  notes?: string | null;
};

type CrmCustomerRecordNormalized = {
  id: string;
  tenantSlug: string;
  regionId: string;
  branchId: string;
  regionName?: string;
  branchName?: string;
  name: string;
  primaryContact?: {
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    owner?: string;
  } | null;
  status?: string | null;
};

import {
  Activity,
  AlertTriangle,
  Banknote,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bot,
  Building2,
  ClipboardList,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Command,
  Clock,
  DollarSign,
  Download,
  CreditCard,
  Edit,
  FileSpreadsheet,
  FileText,
  Gauge,
  Loader2,
  GitBranch,
  LineChart,
  Handshake,
  Headphones,
  KanbanSquare,
  PieChart,
  Layers3,
  LayoutDashboard,
  Mail,
  MessageSquare,
  MoreVertical,
  Package,
  Receipt,
  Megaphone,
  Menu,
  PhoneCall,
  PiggyBank,
  PlugZap,
  ScrollText,
  Search,
  Send,
  Settings,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Users2,
  Wallet,
  Workflow,
  XCircle,
  Zap,
  X,
} from "lucide-react";
import { Component, Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ComponentType, FormEvent } from "react";
import DepartmentManagement from "@/app/tenant-admin/sections/department-management";
import RoleBuilder from "@/app/tenant-admin/sections/role-builder";
import ApprovalDesigner from "@/app/tenant-admin/sections/approval-designer";
import EmployeeConsole from "@/app/tenant-admin/sections/employee-console";
import { listExpenses, createExpense, approveExpense, deleteExpense } from "@/lib/api/expenses";
import AccessControlPanel from "@/app/tenant-admin/sections/access-control";
import LifecycleWorkflows from "@/app/tenant-admin/sections/workflows";
import ModuleRegistry from "@/app/tenant-admin/sections/module-registry";
import BillingSection from "@/app/tenant-admin/sections/billing";
import IntegrationsSection from "@/app/tenant-admin/sections/integrations";
import AnalyticsSection from "@/app/tenant-admin/sections/analytics";
import SecuritySection from "@/app/tenant-admin/sections/security";
import CostAllocationSection from "@/app/tenant-admin/sections/cost-allocation";

type NavigationLink = {
  label: string;
  key: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string;
};

const CRM_METRICS = [];

const CRM_LEADS = [];

const CRM_TASKS = [];

const CRM_ENGAGEMENTS = [];

const CRM_STATUS_META = [];

const CRM_REMINDERS = [];

const CRM_CUSTOMERS = [];

const CRM_CHARTS_BASELINE = [];

const CRM_BASELINE_SNAPSHOT: CrmSnapshot = {
  metrics: [],
  leads: [],
  tasks: [],
  engagements: [],
  reminders: [],
  charts: {
    funnel: [],
    revenueByOfficer: [],
    lostReasons: [],
  },
  customers: [],
};

const FINANCE_TREND_BASELINE = [];

const FINANCE_RECEIVABLES_BASELINE = [];

const FINANCE_PAYABLES_BASELINE = [];

type FinanceExpenseItem = {
  id: string;
  description: string;
  category: string;
  amount: string;
  submittedBy: string;
  submittedDate: string;
  status: "pending" | "approved" | "rejected" | "paid";
  branch: string;
};

const FINANCE_EXPENSES_BASELINE = [];

type PaymentRecord = {
  id: string;
  payableId: string;
  customerId?: string;
  invoiceId?: string;
  method: "bank_transfer" | "check" | "cash" | "pos" | "mobile_money" | "wire" | "paystack" | "flutterwave" | "stripe";
  grossAmount: string;
  fees: string;
  netAmount: string;
  currency: string;
  paymentDate: string;
  settlementDate?: string;
  referenceNumber: string;
  gatewayReference?: string;
  confirmationDetails: string;
  status: "pending" | "successful" | "failed" | "reversed";
  gateway?: "paystack" | "flutterwave" | "stripe" | "manual";
  linkedInvoices: string[]; // Invoice IDs
  recordedBy: string;
  recordedDate: string;
  auditTrail: {
    action: string;
    timestamp: string;
    user: string;
  }[];
};

const PAYMENT_RECORDS_BASELINE = [];

// Expense Types
type ExpenseCategory = {
  id: string;
  code: string;
  name: string;
  accountId: string;
  requiresVendor: boolean;
  requiresReceipt: boolean;
  categoryLimit?: number;
  policyDescription: string;
};

type Approval = {
  id: string;
  expenseId: string;
  approverRole: "manager" | "finance" | "executive";
  approverId: string;
  approverName: string;
  action: "approved" | "rejected" | "clarification_requested";
  reason?: string;
  timestamp: string;
  amountThreshold: number;
};

type AuditLog = {
  id: string;
  action: string;
  timestamp: string;
  user: string;
  details: Record<string, any>;
};

type Expense = {
  id: string;
  tenantId: string;
  expenseDate: string;
  recordedDate: string;
  amount: number;
  taxType: "none" | "vat" | "wht";
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  category: ExpenseCategory;
  type: "vendor" | "employee_reimbursement" | "cash" | "prepaid";
  description: string;
  vendorId?: string;
  vendorName?: string;
  employeeId?: string;
  departmentId: string;
  projectId?: string;
  costCenterId?: string;
  paymentStatus: "unpaid" | "paid" | "reimbursed" | "pending_payment";
  approvalStatus: "draft" | "pending" | "approved" | "rejected";
  paymentMethod: "bank_transfer" | "cash" | "corporate_card" | "mobile_money" | "check";
  linkedPaymentId?: string;
  linkedInvoiceId?: string;
  notes: string;
  receiptUrls: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  journalEntryId?: string;
  accountId: string;
  vatInputAccountId?: string;
  whtPayableAccountId?: string;
  approvals: Approval[];
  auditTrail: AuditLog[];
};

const EXPENSE_CATEGORIES_BASELINE = [];

const EXPENSE_RECORDS_BASELINE = [];

const DEFAULT_FINANCE_CURRENCY = "₦";

const FINANCE_CASH_ACCOUNTS_BASELINE = [];

const FINANCE_EXPENSE_BREAKDOWN_BASELINE = [];

const MOCK_INVOICES = [];

const FINANCE_BASELINE_SNAPSHOT: FinanceSnapshot = {
  metrics: [],
  trend: {
    labels: [],
    revenue: [],
    expenses: [],
  },
  receivables: [],
  payables: [],
  cashAccounts: [],
  expenseBreakdown: [],
};

const FINANCE_SCHEDULE_STATUS_META: Record<FinanceScheduleItem["status"], { label: string; chip: string }> = {
  current: { label: "Current", chip: "bg-emerald-50 text-emerald-600" },
  due_soon: { label: "Due soon", chip: "bg-amber-50 text-amber-600" },
  overdue: { label: "Overdue", chip: "bg-rose-50 text-rose-600" },
};

function normalizeFinanceScheduleStatus(value: unknown): FinanceScheduleItem["status"] {
  if (value === "due_soon" || value === "overdue" || value === "current") {
    return value;
  }
  return "current";
}

function mapFinanceSnapshotPayload(payload: unknown): FinanceSnapshot {
  const baseline = FINANCE_BASELINE_SNAPSHOT;
  if (payload && typeof payload === "object") {
    const snapshot = (payload as { snapshot?: FinanceSnapshot }).snapshot ?? (payload as FinanceSnapshot | undefined);
    if (
      snapshot &&
      Array.isArray(snapshot.metrics) &&
      snapshot.trend &&
      Array.isArray(snapshot.receivables) &&
      Array.isArray(snapshot.payables) &&
      Array.isArray(snapshot.cashAccounts) &&
      Array.isArray(snapshot.expenseBreakdown)
    ) {
      return {
        metrics: snapshot.metrics.length ? snapshot.metrics : baseline.metrics,
        trend: snapshot.trend,
        receivables: snapshot.receivables.map((item) => ({ ...item, status: normalizeFinanceScheduleStatus(item.status) })),
        payables: snapshot.payables.map((item) => ({ ...item, status: normalizeFinanceScheduleStatus(item.status) })),
        cashAccounts: snapshot.cashAccounts.map((account) => ({
          ...account,
          trend: account.trend === "down" ? "down" : "up",
          change: account.change ?? "Stable",
        })),
        expenseBreakdown: snapshot.expenseBreakdown,
      } satisfies FinanceSnapshot;
    }
  }
  return baseline;
}

async function fetchFinanceSnapshot(tenantSlug: string | null, timeframe: string, region?: string): Promise<FinanceSnapshot> {
  const timeframeValue = TIMEFRAME_MAP[timeframe] || "last_7_days";
  const params = new URLSearchParams({ tenantSlug: tenantSlug ?? "kreatix-default", timeframe: timeframeValue });
  if (region && region !== "Global HQ") {
    params.set("regionId", regionToId(region));
  }

  try {
    const response = await fetch(`/api/finance/dashboard?${params.toString()}`, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error ?? "Finance dashboard request failed");
    }
    return mapFinanceSnapshotPayload(payload);
  } catch (error) {
    console.warn("Finance snapshot fetch failed, returning baseline", error);
    return FINANCE_BASELINE_SNAPSHOT;
  }
}

async function fetchFinanceCashAccounts(tenantSlug: string | null, region?: string): Promise<FinanceCashAccount[]> {
  const params = new URLSearchParams({ tenantSlug: tenantSlug ?? "kreatix-default", limit: "8" });
  if (region && region !== "Global HQ") {
    params.set("regionId", regionToId(region));
  }

  const response = await fetch(`/api/finance/accounts?${params.toString()}`, { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? "Finance accounts request failed");
  }

  const accounts = Array.isArray(payload?.accounts) ? (payload.accounts as FinanceAccountApiResponse[]) : [];
  const normalized = accounts
    .map((account) => {
      if (!account?.id || !account.name) {
        return null;
      }
      return mapFinanceAccountFromApi(account);
    })
    .filter((value): value is FinanceCashAccount => Boolean(value));

  return normalized.length ? normalized : FINANCE_BASELINE_SNAPSHOT.cashAccounts;
}

function mapFinanceAccountFromApi(account: FinanceAccountApiResponse): FinanceCashAccount {
  const currency = account.currency ?? DEFAULT_FINANCE_CURRENCY;
  return {
    id: account.id,
    name: account.name,
    type: account.type === "cash" ? "cash" : "bank",
    balance: formatCurrencyCompactClient(account.balance, currency),
    currency,
    trend: account.trend === "down" ? "down" : "up",
    change: formatAccountChangeFromApi(account, currency),
    region: humanizeOrgLabel(account.branchId) ?? humanizeOrgLabel(account.regionId) ?? "Global",
  };
}

function formatAccountChangeFromApi(account: FinanceAccountApiResponse, currency: string): string {
  if (account.changeValue === null || account.changeValue === undefined) {
    return "Stable";
  }
  const value = Number(account.changeValue);
  if (!Number.isFinite(value) || value === 0) {
    return "Stable";
  }
  const prefix = value > 0 ? "+" : "-";
  const formatted = formatCurrencyCompactClient(Math.abs(value), currency);
  const period = account.changePeriod ? ` vs ${account.changePeriod}` : "";
  return `${prefix}${formatted}${period ? ` ${period}` : ""}`;
}

function formatCurrencyCompactClient(value: number, currency = DEFAULT_FINANCE_CURRENCY): string {
  if (!Number.isFinite(value)) {
    return `${currency}0`;
  }
  const formatter = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: Math.abs(value) >= 1_000_000 ? 1 : 0,
  });
  const formatted = formatter.format(Math.abs(value));
  return `${value < 0 ? "-" : ""}${currency}${formatted}`;
}

function formatCurrency(value: number, currency = "₦"): string {
  if (Number.isNaN(value)) {
    return `${currency}0`;
  }
  return `${currency}${value.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
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

function mapContactApiToImportedContact(contact: CrmContactApiResponse): CrmImportedContact {
  return {
    id: contact.id,
    company: contact.company,
    contact: contact.contactName,
    email: contact.contactEmail ?? "",
    phone: contact.contactPhone ?? "",
    source: contact.source ?? "CSV import",
    status: contact.status ?? "New",
    importedAt: contact.importedAt ?? contact.createdAt ?? new Date().toISOString(),
    tags: Array.isArray(contact.tags) ? contact.tags : [],
  };
}

function mapCustomerRecordToView(record: CrmCustomerRecordNormalized): CrmCustomerView {
  const contactName = [record.primaryContact?.firstName, record.primaryContact?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return {
    id: record.id,
    name: record.name,
    region: record.regionName ?? "Global",
    branch: record.branchName ?? "Horizon HQ",
    owner: record.primaryContact?.owner ?? record.primaryContact?.name ?? "Unassigned",
    status: record.status ?? "Active",
    contactName: contactName || record.primaryContact?.name,
    contactEmail: record.primaryContact?.email,
    contactPhone: record.primaryContact?.phone,
  };
}

function getNextLeadStage(stage: string): string {
  const index = CRM_STAGE_OPTIONS.findIndex((value) => value.toLowerCase() === stage.toLowerCase());
  if (index === -1 || index === CRM_STAGE_OPTIONS.length - 1) {
    return stage;
  }
  return CRM_STAGE_OPTIONS[index + 1];
}

function mapDealRecordToView(record: CrmDealRecord): CrmLead {
  return {
    id: record.id,
    company: `Deal ${record.id.slice(0, 4)}`,
    contact: record.assignedOfficerId ?? "Unassigned",
    stage: record.stage,
    owner: record.assignedOfficerId ?? "Unassigned",
    value: formatCurrency(record.value, record.currency ?? "₦"),
    status: record.status === "closed_won" ? "won" : record.status === "closed_lost" ? "overdue" : "pending",
  };
}

function CrmReportsView({ snapshot }: { snapshot: CrmSnapshot }) {
  return (
    <div className="space-y-6">
      <CrmSubViewHero
        title="Reports & analytics"
        description="Export-ready CRM analytics covering funnels, revenue, and lost reasons per channel."
        actionLabel="Export PDF"
      />

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Sales funnel</p>
            <h2 className="text-xl font-semibold text-slate-900">Conversion rate by stage</h2>
          </div>
          <button className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">Download CSV</button>
        </div>
        <div className="mt-4 space-y-4">
          {snapshot.charts.funnel.map((stage) => (
            <div key={stage.stage} className="space-y-1">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
                <span>{stage.stage}</span>
                <span>{stage.value}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.min(stage.value, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Revenue by officer</p>
              <h2 className="text-xl font-semibold text-slate-900">Contributor breakdown</h2>
            </div>
            <button className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">Share dashboard</button>
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.charts.revenueByOfficer.map((row) => (
              <div key={row.officer} className="flex items-center justify-between text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{row.officer}</span>
                <span>{formatCurrency(row.value)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Lost reasons</p>
              <h2 className="text-xl font-semibold text-slate-900">Churn analysis</h2>
            </div>
            <button className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">Export chart</button>
          </div>
          <div className="mt-4 space-y-2">
            {snapshot.charts.lostReasons.map((reason) => (
              <div key={reason.reason} className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
                <span>{reason.reason}</span>
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[0.65rem] text-white">{reason.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

}

function CrmCustomersView({
  customers,
  reminders,
  onAddCustomer,
  onImportContacts,
  importing,
  onExportContacts,
}: {
  customers: CrmCustomerView[];
  reminders: CrmReminder[];
  onAddCustomer: () => void;
  onImportContacts: () => void;
  importing: boolean;
  onExportContacts: () => void;
}) {
  const highlightedCustomers = customers.slice(0, 4);

  return (
    <div className="space-y-6">
      <CrmSubViewHero
        title="Customers & accounts"
        description="Convert leads into telecom accounts with linked contracts, invoices, and support tickets."
        actionLabel="Add customer"
        onAction={onAddCustomer}
      />

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Customer roster</p>
            <h2 className="text-xl font-semibold text-slate-900">Multi-branch coverage</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">Filter</button>
            <button
              type="button"
              onClick={onImportContacts}
              disabled={importing}
              className="inline-flex items-center gap-2 rounded-full border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Users2 className="h-4 w-4" /> {importing ? "Importing…" : "Import contacts"}
            </button>
            <button
              type="button"
              onClick={onExportContacts}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700"
            >
              <Download className="h-4 w-4" /> Export contacts
            </button>
          </div>
        </div>
        {customers.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-sm text-slate-500">
            No customers yet. Use the "Add customer" action to create your first account profile.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {highlightedCustomers.map((customer) => (
              <div key={customer.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{customer.name}</p>
                    <p className="text-xs text-slate-500">
                      {customer.region} · {customer.branch}
                    </p>
                  </div>
                  <button className="text-xs font-semibold text-slate-500">Profile →</button>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-slate-500">
                  <span>Account owner · {customer.owner}</span>
                  {customer.contactName && <span>Primary contact · {customer.contactName}</span>}
                  {customer.contactPhone && <span>Phone · {customer.contactPhone}</span>}
                  {customer.contactEmail && <span>Email · {customer.contactEmail}</span>}
                  <span className="inline-flex items-center gap-2">
                    Status ·
                    <span className="rounded-full bg-white px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600">
                      {customer.status}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Account health</p>
              <h2 className="text-xl font-semibold text-slate-900">Engagement timeline</h2>
            </div>
            <button className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">Sync CRM</button>
          </div>
          {customers.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Customer engagement insights will appear once accounts are created.</div>
          ) : (
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              {customers.slice(0, 3).map((customer) => (
                <p key={customer.id}>
                  {customer.name} · Owner {customer.owner} · {customer.status}
                </p>
              ))}
            </div>
          )}

          {/* Loading state handled in CrmContactsView; customers list currently static */}
        </div>

        <div className="space-y-6">
          <CrmReminderList reminders={reminders} />
        </div>
      </div>
    </div>
  );
}

function CrmContactsView({
  contacts,
  importing,
  loading,
  error,
  onRetry,
  onImportContacts,
  onExportContacts,
  sample,
  onSampleChange,
  onSampleSubmit,
  onSamplePrefill,
  tagOptions,
  activeTagFilter,
  onTagFilterChange,
  onTagToggle,
}: {
  contacts: CrmImportedContact[];
  importing: boolean;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onImportContacts: () => void;
  onExportContacts: () => void;
  sample: CrmContactImportSampleState;
  onSampleChange: (field: keyof CrmContactImportSampleState, value: string) => void;
  onSampleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSamplePrefill: () => void;
  tagOptions: readonly string[];
  activeTagFilter: string | null;
  onTagFilterChange: (tag: string | null) => void;
  onTagToggle: (contactId: string, tag: string) => void;
}) {
  const CONTACTS_PER_PAGE = 6;
  const [pageIndex, setPageIndex] = useState(0);
  const filteredContacts = activeTagFilter
    ? contacts.filter((contact) => Array.isArray(contact.tags) && contact.tags.includes(activeTagFilter))
    : contacts;
  const hasContacts = filteredContacts.length > 0;
  const totalPages = Math.max(1, Math.ceil(Math.max(filteredContacts.length, 1) / CONTACTS_PER_PAGE));
  const safePage = Math.min(pageIndex, totalPages - 1);
  const displayedContacts = filteredContacts.slice(
    safePage * CONTACTS_PER_PAGE,
    safePage * CONTACTS_PER_PAGE + CONTACTS_PER_PAGE
  );

  useEffect(() => {
    setPageIndex(0);
  }, [activeTagFilter, contacts]);

  const handlePageChange = (direction: "prev" | "next") => {
    setPageIndex((previous) => {
      if (direction === "prev") {
        return Math.max(0, previous - 1);
      }
      return Math.min(totalPages - 1, previous + 1);
    });
  };

  return (
    <div className="space-y-6">
      <CrmSubViewHero
        title="Contacts"
        description="Centralize telecom stakeholder contacts with import/export workflows and quick filters."
        actionLabel="Import contacts"
        onAction={onImportContacts}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.55fr)]">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Imported roster</p>
              <h2 className="text-xl font-semibold text-slate-900">Contact directory</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onImportContacts}
                disabled={importing}
                className="inline-flex items-center gap-2 rounded-full border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Users2 className="h-4 w-4" /> {importing ? "Importing…" : "Import CSV"}
              </button>
              <button
                type="button"
                onClick={onExportContacts}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700"
              >
                <Download className="h-4 w-4" /> Export contacts
              </button>
            </div>
          </div>

          {contacts.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="uppercase tracking-[0.3em] text-slate-400">Filter by tag</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onTagFilterChange(null)}
                  className={`rounded-full border px-3 py-1 text-[0.7rem] font-semibold ${
                    activeTagFilter === null ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600"
                  }`}
                >
                  All contacts
                </button>
                {tagOptions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onTagFilterChange(activeTagFilter === tag ? null : tag)}
                    className={`rounded-full border px-3 py-1 text-[0.7rem] font-semibold ${
                      activeTagFilter === tag ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!hasContacts ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm text-slate-500">
              {activeTagFilter
                ? "No contacts match the selected tag yet. Try a different filter or import more contacts."
                : "Upload a CSV to populate the contact roster. Use the sample builder to generate the correct format."}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-600">
                  <thead>
                    <tr className="bg-slate-50 text-xs uppercase tracking-[0.3em] text-slate-400">
                      <th className="px-4 py-3">Company</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Imported</th>
                      <th className="px-4 py-3">Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedContacts.map((contact) => (
                      <tr key={contact.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-semibold text-slate-900">{contact.company}</td>
                        <td className="px-4 py-3">{contact.contact}</td>
                        <td className="px-4 py-3 text-slate-500">{contact.email || "—"}</td>
                        <td className="px-4 py-3 text-slate-500">{contact.phone || "—"}</td>
                        <td className="px-4 py-3">{contact.source}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {contact.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">{formatRelativeTimestamp(contact.importedAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {tagOptions.map((tag) => {
                              const active = Array.isArray(contact.tags) && contact.tags.includes(tag);
                              return (
                                <button
                                  key={`${contact.id}-${tag}`}
                                  type="button"
                                  onClick={() => onTagToggle(contact.id, tag)}
                                  className={`rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold transition ${
                                    active
                                      ? "border-slate-900 bg-slate-900 text-white"
                                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                                  }`}
                                >
                                  {tag}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                <span>
                  Showing {displayedContacts.length ? safePage * CONTACTS_PER_PAGE + 1 : 0} –
                  {Math.min(filteredContacts.length, (safePage + 1) * CONTACTS_PER_PAGE)} of {filteredContacts.length} contacts
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePageChange("prev")}
                    disabled={safePage === 0}
                    className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span className="text-sm font-semibold">
                    Page {safePage + 1} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => handlePageChange("next")}
                    disabled={safePage >= totalPages - 1}
                    className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Import template</p>
              <h2 className="text-lg font-semibold text-slate-900">Sample row builder</h2>
            </div>
            <button
              type="button"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600"
              onClick={onSamplePrefill}
            >
              Use example values
            </button>
          </div>
          <p className="mt-2 text-sm text-slate-500">Fill this mini-form to generate a CSV row that matches the import format.</p>
          <form className="mt-4 space-y-3" onSubmit={onSampleSubmit}>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Company
              <input
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none"
                value={sample.company}
                onChange={(event) => onSampleChange("company", event.target.value)}
                placeholder="Nova Retail"
                required
              />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-slate-700">
                First name
                <input
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none"
                  value={sample.firstName}
                  onChange={(event) => onSampleChange("firstName", event.target.value)}
                  placeholder="Sara"
                  required
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Last name
                <input
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none"
                  value={sample.lastName}
                  onChange={(event) => onSampleChange("lastName", event.target.value)}
                  placeholder="Bello"
                  required
                />
              </label>
            </div>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none"
                value={sample.email}
                onChange={(event) => onSampleChange("email", event.target.value)}
                placeholder="sara@nova.io"
                required
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Phone number
              <input
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none"
                value={sample.phone}
                onChange={(event) => onSampleChange("phone", event.target.value)}
                placeholder="+234 801 555 9988"
                required
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Tags (comma separated)
              <input
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none"
                value={sample.tags}
                onChange={(event) => onSampleChange("tags", event.target.value)}
                placeholder="Key Account, High Priority"
              />
              <span className="text-xs font-normal text-slate-500">
                Supported tags: {tagOptions.join(", ")}
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm"
              >
                <Download className="h-4 w-4" /> Download sample CSV
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600"
                onClick={onSamplePrefill}
              >
                Prefill fields
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function CrmOpportunitiesView({
  leads,
  reminders,
}: {
  leads: CrmLead[];
  reminders: CrmReminder[];
}) {
  const columns = ["Prospecting", "Qualification", "Proposal", "Negotiation", "Closed"];
  const PAGE_SIZE = 6;
  const [pageIndex, setPageIndex] = useState(0);
  const totalPages = Math.max(1, Math.ceil(Math.max(leads.length, 1) / PAGE_SIZE));
  const safePage = Math.min(pageIndex, totalPages - 1);
  const paginatedLeads = leads.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    setPageIndex(0);
  }, [leads]);

  const handlePageChange = (direction: "prev" | "next") => {
    setPageIndex((previous) => {
      if (direction === "prev") {
        return Math.max(0, previous - 1);
      }
      return Math.min(totalPages - 1, previous + 1);
    });
  };

  return (
    <div className="space-y-6">
      <CrmSubViewHero
        title="Deals & opportunities"
        description="Track telecom programs from sourcing through onboarding with probability weighting."
        actionLabel="New deal"
      />

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Pipeline overview</p>
            <h2 className="text-xl font-semibold text-slate-900">Multi-stage flow</h2>
          </div>
          <button className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">Configure board</button>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-5">
          {columns.map((column, index) => (
            <div key={column} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
                <span>{column}</span>
                <span>{(index + 1) * 2}</span>
              </div>
              <div className="mt-3 space-y-3">
                {leads.slice(index, index + 2).map((deal) => (
                  <div key={deal.id} className="rounded-2xl border border-white bg-white p-3 text-sm shadow-sm">
                    <p className="font-semibold text-slate-900">{deal.company}</p>
                    <p className="text-xs text-slate-500">Owner · {deal.owner}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span>{deal.value}</span>
                      <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[0.65rem] text-white">{Math.min(90, 40 + index * 10)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Forecast</p>
              <h2 className="text-xl font-semibold text-slate-900">Weighted revenue</h2>
            </div>
            <button className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">Export plan</button>
          </div>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>Next 30 days</span>
              <span>{formatCurrency(420000)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Quarter</span>
              <span>{formatCurrency(1180000)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Year</span>
              <span>{formatCurrency(4820000)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <CrmReminderList reminders={reminders} />
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Next actions</p>
                <h2 className="text-lg font-semibold text-slate-900">Deal motions</h2>
              </div>
              <button className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">View all</button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>Prep RFP addendum · Nova Retail</p>
              <p>Schedule on-site review · Helios Parts</p>
              <p>Align finance guardrails · Tembea Steel</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CrmLeadsView({
  leads,
  reminders,
  onAddContact,
  onAdvanceStage,
}: {
  leads: CrmLead[];
  reminders: CrmReminder[];
  onAddContact: () => void;
  onAdvanceStage: (leadId: string) => void;
}) {
  const total = leads.length;
  const overdue = leads.filter((lead) => lead.status === "overdue").length;
  const won = leads.filter((lead) => lead.status === "won").length;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Lead controls</p>
            <h2 className="text-xl font-semibold text-slate-900">Signal-based routing</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:border-slate-300" onClick={onAddContact}>
              <Users className="h-4 w-4" />
              New lead
            </button>
            <button className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-slate-300">Assign owner</button>
            <button className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-slate-300">Export CSV</button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Total leads</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{total}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-amber-50/80 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-600">SLA risk</p>
            <p className="mt-1 text-2xl font-semibold text-amber-700">{overdue}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-emerald-50/80 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">Won this cycle</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-700">{won}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Lead list</p>
              <h2 className="text-xl font-semibold text-slate-900">Regional pipeline</h2>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-3 py-1">All regions</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">Any owner</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">Last 30d</span>
            </div>
          </div>
          <div className="mt-6 overflow-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead>
                <tr className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  <th className="pb-2">Lead</th>
                  <th className="pb-2">Contact</th>
                  <th className="pb-2">Stage</th>
                  <th className="pb-2">Owner</th>
                  <th className="pb-2">Value</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-t border-slate-100">
                    <td className="py-3">
                      <p className="font-semibold text-slate-900">{lead.company}</p>
                      <p className="text-xs text-slate-400">{lead.id}</p>
                    </td>
                    <td>{lead.contact}</td>
                    <td>{lead.stage}</td>
                    <td>{lead.owner}</td>
                    <td>{lead.value}</td>
                    <td className="space-x-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${CRM_STATUS_META[lead.status].chip}`}>
                        {CRM_STATUS_META[lead.status].label}
                      </span>
                      <button
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-slate-300"
                        onClick={() => onAdvanceStage(lead.id)}
                      >
                        Advance
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <CrmReminderList reminders={reminders} />
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Signals</p>
                <h2 className="text-lg font-semibold text-slate-900">Lead notes</h2>
              </div>
              <button className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">Add note</button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>CopperNet · awaiting CFO review.</p>
              <p>Nova Retail · asked for SLA evidence pack.</p>
              <p>Helix Grid · flagged for multi-region support.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const CRM_CUSTOMER_STATUS_OPTIONS = ["Active", "Onboarding", "Churn risk", "Dormant"] as const;

function CrmSubViewHero({ title, description, actionLabel, onAction }: { title: string; description: string; actionLabel: string; onAction?: () => void }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">CRM workspace</p>
          <h2 className="text-2xl font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-white/80">{description}</p>
        </div>
        <button
          className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onAction}
          disabled={!onAction}
          type="button"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

function CrmPlaceholderCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{title}</p>
      <p className="mt-2 text-sm text-slate-600">{detail}</p>
    </div>
  );
}

function CrmChartCard({
  title,
  subtitle,
  children,
  currentView,
  onViewChange,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  currentView?: CrmView;
  onViewChange?: (view: CrmView) => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{subtitle}</p>
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        </div>
      </div>

      {onViewChange && currentView ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="rounded-full bg-white/70 p-1 shadow-sm">
            {CRM_VIEWS.map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => onViewChange(view)}
                className={`px-4 py-2 text-sm font-semibold capitalize ${
                  currentView === view ? "rounded-full bg-slate-900 text-white" : "text-slate-600"
                }`}
              >
                {view}
              </button>
            ))}
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Multi-region telecom CRM</p>
        </div>
      ) : (
        <div className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-400">Multi-region telecom CRM</div>
      )}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function CrmReminderList({ reminders }: { reminders: CrmReminder[] }) {
  if (reminders.length === 0) {
    return null;
  }
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Follow-ups</p>
          <h2 className="text-xl font-semibold text-slate-900">Reminders</h2>
        </div>
        <span className="text-xs font-semibold text-slate-500">{reminders.length} open</span>
      </div>
      <div className="mt-4 space-y-3">
        {reminders.map((reminder) => (
          <div key={reminder.id} className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
            <div>
              <p className="font-semibold text-slate-900">{reminder.label}</p>
              <p className="text-xs text-slate-500">Due {reminder.dueAt}</p>
            </div>
            {reminder.slaSeconds && (
              <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
                SLA {Math.round(reminder.slaSeconds / 3600)}h
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatRelativeTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) {
    return "Just now";
  }
  if (diffMs < hour) {
    const minutes = Math.floor(diffMs / minute);
    return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  }
  if (diffMs < day) {
    const hours = Math.floor(diffMs / hour);
    return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(diffMs / day);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function parseCurrencyValue(input?: string): number | undefined {
  if (!input) {
    return undefined;
  }
  const numeric = Number(input.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? numeric : undefined;
}

function downloadCsvFile(rows: Array<Array<string | number | null | undefined>>, filename: string): void {
  const csvContent = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function regionToId(region?: string): string {
  return region ? region.toLowerCase().replace(/\s+/g, "-") : "global-hq";
}

function mapLeadRecordToView(record: CrmLeadRecord): CrmLead {
  return {
    id: record.id,
    company: record.companyName,
    contact: record.contactName,
    stage: record.stage,
    owner: record.assignedOfficerId ?? "Unassigned",
    value: formatCurrency(record.expectedValue ?? 0, record.currency ?? "₦"),
    status: "pending",
  };
}

async function fetchCrmSnapshot(tenantSlug: string | null, timeframe: string, region?: string): Promise<CrmSnapshot> {
  const params = new URLSearchParams({ tenantSlug: tenantSlug ?? "kreatix-default" });
  if (region && region !== "Global HQ") {
    params.set("regionId", region.toLowerCase().replace(/\s+/g, "-"));
  }

  const response = await fetch(`/api/crm/dashboard?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload?.error ?? "CRM dashboard request failed");
  }
  const data = await response.json();
  const payload = data.payload as {
    metrics: Array<{ label: string; value: number; delta?: number; deltaDirection?: "up" | "down"; description?: string }>;
    totals: { totalLeads: number; qualifiedLeads: number; opportunities: number; dealsWon: number; dealsLost: number; revenue: number; conversionRate: number };
    charts: { salesFunnel: Array<{ stage: string; value: number }>; lostReasons: Array<{ reason: string; count: number }>; revenueByOfficer: Array<{ officerId: string; officerName: string; value: number }> };
    leads: Array<{ id: string; companyName: string; contactName: string; stage: string; ownerName: string; value: number; currency: string; status: "overdue" | "pending" | "won" }>;
    reminders: Array<{ id: string; label: string; dueAt: string; slaSeconds?: number }>;
    tasks: Array<{ id: string; title: string; due: string; assignee: string; status: "due" | "upcoming" }>;
    engagements: Array<{ id: string; title: string; detail: string; timestamp: string; channel: "email" | "sms" | "call" | "meeting" | "whatsapp" }>;
    customers: Array<{ id: string; name: string; regionId: string; branchId: string; status: string; primaryContact: { name: string; email: string; phone: string } }>;
  };

  let customersFromApi: CrmCustomerView[] = [];
  let customersLoaded = false;
  try {
    const customerParams = new URLSearchParams({ tenantSlug: tenantSlug ?? "kreatix-default", limit: "20" });
    if (region && region !== "Global HQ") {
      customerParams.set("regionId", region.toLowerCase().replace(/\s+/g, "-"));
    }
    const customersResponse = await fetch(`/api/crm/customers?${customerParams.toString()}`, { cache: "no-store" });
    if (customersResponse.ok) {
      const customersPayload = await customersResponse.json().catch(() => null);
      if (customersPayload?.customers) {
        customersFromApi = (customersPayload.customers as CrmCustomerRecordNormalized[]).map((customer) => mapCustomerRecordToView(customer));
        customersLoaded = true;
      }
    }
  } catch (error) {
    console.error("CRM customers fetch failed", error);
  }

  return {
    metrics: payload.metrics.map((metric) => ({
      label: metric.label,
      value: metric.value.toLocaleString(),
      delta: metric.delta !== undefined ? `${metric.delta.toFixed(1)}%` : "0%",
      trend: metric.deltaDirection ?? "up",
      description: metric.description ?? timeframe,
    })),
    leads: payload.leads.map((lead) => ({
      id: lead.id,
      company: lead.companyName,
      contact: lead.contactName,
      stage: lead.stage,
      owner: lead.ownerName,
      value: formatCurrency(lead.value, lead.currency ?? "₦"),
      status: lead.status,
    })),
    tasks: payload.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      due: formatTimestamp(task.due),
      assignee: task.assignee,
      status: task.status,
    })),
    engagements: payload.engagements.map((engagement) => ({
      id: engagement.id,
      title: engagement.title,
      detail: engagement.detail,
      timestamp: formatTimestamp(engagement.timestamp),
      channel: engagement.channel === "sms" ? "call" : engagement.channel === "whatsapp" ? "call" : (engagement.channel as CrmEngagement["channel"]),
    })),
    reminders: payload.reminders.map((reminder) => ({
      id: reminder.id,
      label: reminder.label,
      dueAt: formatTimestamp(reminder.dueAt),
      slaSeconds: reminder.slaSeconds,
    })),
    charts: {
      funnel: payload.charts.salesFunnel,
      revenueByOfficer: payload.charts.revenueByOfficer.map((row) => ({ officer: row.officerName, value: row.value })),
      lostReasons: payload.charts.lostReasons,
    },
    customers: customersLoaded ? customersFromApi : CRM_BASELINE_SNAPSHOT.customers,
  };
}

type NavigationSection = {
  label: string;
  links: NavigationLink[];
};

type KpiMetric = {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down";
  description: string;
};

type LiveOperationPanel = {
  title: string;
  countLabel: string;
  primaryColor: string;
  pills: string[];
  items: { title: string; meta: string; supporting: string; statusColor: string }[];
};

type InvoiceRow = {
  id: string;
  vendor: string;
  amount: string;
  channel: string;
  eta: string;
  status: "ready" | "hold" | "variance";
  notes: string;
};

type DealOpportunity = {
  name: string;
  stage: string;
  value: string;
  owner: string;
  probability: number;
  region: string;
};

type ApprovalRoute = {
  name: string;
  pending: number;
  owners: string[];
  updated: string;
  eta: string;
  critical?: boolean;
};

type AlertItem = {
  label: string;
  detail: string;
  severity: "critical" | "warning" | "info";
  timestamp: string;
};

type CrmLead = {
  id: string;
  company: string;
  contact: string;
  stage: string;
  owner: string;
  value: string;
  status: "overdue" | "pending" | "won";
};

type CrmEngagement = {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  channel: "email" | "call" | "meeting";
};

type CrmTask = {
  id: string;
  title: string;
  due: string;
  assignee: string;
  status: "due" | "upcoming";
};

type CrmReminder = {
  id: string;
  label: string;
  dueAt: string;
  slaSeconds?: number;
};

type CrmChartSnapshot = {
  funnel: Array<{ stage: string; value: number }>;
  revenueByOfficer: Array<{ officer: string; value: number }>;
  lostReasons: Array<{ reason: string; count: number }>;
};

type CrmCustomerView = {
  id: string;
  name: string;
  region: string;
  branch: string;
  owner: string;
  status: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
};

type CrmSnapshot = {
  metrics: KpiMetric[];
  leads: CrmLead[];
  tasks: CrmTask[];
  engagements: CrmEngagement[];
  reminders: CrmReminder[];
  charts: CrmChartSnapshot;
  customers: CrmCustomerView[];
};

type CrmActionType = "contact" | "opportunity" | "engagement" | "customer";

type CrmDealFormState = {
  company: string;
  contact: string;
  owner: string;
  stage: string;
  value: string;
  linkedContactId: string | null;
  description: string;
};

type CrmEngagementFormState = {
  title: string;
  detail: string;
  channel: CrmEngagement["channel"];
};

type CrmCustomerFormState = {
  name: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  contactPhone: string;
  status: string;
};

type CrmContactImportSampleState = {
  company: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  tags: string;
};

type CrmImportedContact = {
  id: string;
  company: string;
  contact: string;
  email: string;
  phone: string;
  source: string;
  status: string;
  importedAt: string;
  tags: string[];
};

type CrmContactApiResponse = {
  id: string;
  tenantSlug: string;
  company: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  source: string | null;
  status: string | null;
  tags: string[];
  importedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

type CrmDealRecord = {
  id: string;
  tenantSlug: string;
  customerId?: string | null;
  leadId?: string | null;
  stage: string;
  value: number;
  currency: string;
  probability?: number | null;
  assignedOfficerId?: string | null;
  status: string;
};

type FinanceTrendSnapshot = {
  labels: string[];
  revenue: number[];
  expenses: number[];
};

type FinanceScheduleItem = {
  id: string;
  entity: string;
  amount: string;
  dueDate: string;
  status: "current" | "overdue" | "due_soon";
  branch: string;
};

type FinanceCashAccount = {
  id: string;
  name: string;
  type: "bank" | "cash";
  balance: string;
  currency: string;
  trend: "up" | "down";
  change: string;
  region: string;
};

type FinanceAccountApiResponse = {
  id: string;
  tenantSlug: string;
  regionId: string | null;
  branchId: string | null;
  name: string;
  type: "bank" | "cash";
  currency?: string | null;
  balance: number;
  changeValue: number | null;
  changePeriod: string | null;
  trend: "up" | "down";
};

type FinanceExpenseBreakdown = {
  label: string;
  amount: string;
  delta: string;
  direction: "up" | "down";
};

type FinanceSnapshot = {
  metrics: KpiMetric[];
  trend: FinanceTrendSnapshot;
  receivables: FinanceScheduleItem[];
  payables: FinanceScheduleItem[];
  cashAccounts: FinanceCashAccount[];
  expenseBreakdown: FinanceExpenseBreakdown[];
};

type CrmActionSubmission =
  | {
      type: "contact";
      payload: CrmDealFormState;
    }
  | {
      type: "opportunity";
      payload: CrmDealFormState;
    }
  | {
      type: "engagement";
      payload: CrmEngagementFormState;
    }
  | {
      type: "customer";
      payload: CrmCustomerFormState;
    };

const CRM_STAGE_OPTIONS = ["Qualification", "Proposal", "Negotiation", "Contracting", "Won"];
const CRM_PIPELINE_OPTIONS = ["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"] as const;
const CRM_CHANNEL_OPTIONS: CrmEngagement["channel"][] = ["email", "call", "meeting"];
const CRM_CONTACT_TAG_OPTIONS = ["Key Account", "Prospect", "Partner", "Support", "Renewal", "High Priority"] as const;
const CRM_VIEWS = ["contacts", "opportunities", "customers", "reports", "dashboard"] as const;
const CRM_VIEW_LABELS: Record<CrmView, string> = {
  contacts: "Contacts",
  opportunities: "Opportunities",
  customers: "Customers",
  reports: "Reports",
  dashboard: "Insights",
};
type CrmView = (typeof CRM_VIEWS)[number];

const FINANCE_VIEWS = ["overview", "invoices", "payments", "expenses", "accounting", "reports"] as const;
const FINANCE_VIEW_LABELS: Record<FinanceView, string> = {
  overview: "Overview",
  invoices: "Invoices",
  payments: "Payments",
  expenses: "Expenses",
  accounting: "Accounting",
  reports: "Reports",
};
type FinanceView = (typeof FINANCE_VIEWS)[number];

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

type CrmContact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  tags?: string[];
  type?: 'individual' | 'business';  // Distinguish contact types
};

type SavedLineItem = {
  id: string;
  description: string;
  defaultPrice: number;
  category?: string;
};

type InvoiceLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

type InvoiceItem = {
  id: string;
  invoiceNumber: string;
  customer: string;
  customerEmail?: string;
  contactId?: string;
  contactType?: 'individual' | 'business';  // Track if contact is business or individual
  amount: string;
  status: InvoiceStatus;
  dueDate: string;
  issueDate: string;
  branch: string;
  // Preserve all draft details
  items?: InvoiceLineItem[];
  notes?: string;
  taxRate?: number;
  discount?: number;
};

type InvoiceFormTab = "details" | "items" | "taxes" | "preview";

const INVOICE_STATUS_OPTIONS: InvoiceStatus[] = ["draft", "sent", "paid", "overdue", "cancelled"];
const INVOICE_STATUS_META: Record<InvoiceStatus, { label: string; chip: string }> = {
  draft: { label: "Draft", chip: "bg-slate-100 text-slate-600" },
  sent: { label: "Sent", chip: "bg-blue-50 text-blue-600" },
  paid: { label: "Paid", chip: "bg-emerald-50 text-emerald-600" },
  overdue: { label: "Overdue", chip: "bg-rose-50 text-rose-600" },
  cancelled: { label: "Cancelled", chip: "bg-slate-100 text-slate-400" },
};

function generateLeadId() {
  return `PIPE-${Math.floor(100 + Math.random() * 900)}`;
}

function generateEngagementId() {
  return `ENG-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function generateImportedContactId() {
  return `IMPCON-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function parseImportedContactsCsv(text: string): CrmImportedContact[] {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length === 0) {
    return [];
  }

  const headerCells = rows[0]
    .split(",")
    .map((cell) => cell.replace(/^"|"$/g, "").trim().toLowerCase());
  const hasHeader = headerCells.some((cell) => cell.includes("company") || cell.includes("first") || cell.includes("email"));
  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows
    .map((row) => {
      const cells = row.split(",").map((cell) => cell.replace(/^"|"$/g, "").trim());
      if (cells.length === 0) {
        return null;
      }

      const [company, firstName, lastName, email, phone, source, status, rawTags] = cells;
      const contactName = [firstName, lastName].filter(Boolean).join(" ").trim();
      const tags = (rawTags ?? "")
        .split(/[,;|]/)
        .map((value) => value.replace(/^#/, "").trim())
        .filter(Boolean);

      return {
        id: generateImportedContactId(),
        company: company || "Unnamed company",
        contact: contactName || email || phone || "Unnamed contact",
        email: email || "",
        phone: phone || "",
        source: source || "CSV import",
        status: status || "New",
        importedAt: new Date().toISOString(),
        tags,
      } satisfies CrmImportedContact;
    })
    .filter((contact): contact is CrmImportedContact => Boolean(contact));
}

const defaultDealForm = (): CrmDealFormState => ({
  company: "",
  contact: "",
  owner: "",
  stage: CRM_STAGE_OPTIONS[0],
  value: "₦0",
  linkedContactId: null,
  description: "",
});

const defaultEngagementForm = (): CrmEngagementFormState => ({
  title: "",
  detail: "",
  channel: "email",
});

const defaultCustomerForm = (): CrmCustomerFormState => ({
  name: "",
  contactFirstName: "",
  contactLastName: "",
  contactEmail: "",
  contactPhone: "",
  status: "Active",
});

const defaultContactImportSample = (): CrmContactImportSampleState => ({
  company: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  tags: "",
});

const NAVIGATION: NavigationSection[] = [
  {
    label: "",
    links: [
      { label: "Overview", key: "overview", icon: LayoutDashboard },
      { label: "CRM", key: "crm", icon: Handshake },
      { label: "Finance", key: "finance", icon: Wallet },
      { label: "Inventory", key: "inventory", icon: Package },
      { label: "Procurement", key: "procurement", icon: Truck },
      { label: "HR & Operations", key: "hr-ops", icon: Users },
      { label: "Projects", key: "projects", icon: KanbanSquare },
      { label: "IT & Support", key: "it-support", icon: Headphones },
      { label: "Marketing & Sales", key: "marketing-sales", icon: Megaphone },
    ],
  },
  {
    label: "Automation",
    links: [
      { label: "Workflows", key: "workflows", icon: Workflow },
      { label: "Approvals", key: "approvals", icon: CheckCircle2 },
      { label: "Automation Rules", key: "automation-rules", icon: Bot },
      { label: "Policies", key: "policies", icon: ScrollText },
      { label: "Reports", key: "reports", icon: BarChart3 },
      { label: "Dashboards", key: "dashboards", icon: Gauge },
    ],
  },
  {
    label: "Admin",
    links: [
      { label: "People & Access", key: "people-access", icon: Users2 },
      { label: "Structure", key: "structure", icon: GitBranch },
      { label: "Modules", key: "modules", icon: Layers3 },
      { label: "Billing", key: "billing", icon: CreditCard },
      { label: "Cost Allocation", key: "cost-allocation", icon: Wallet },
      { label: "Integrations", key: "integrations", icon: PlugZap },
      { label: "Analytics", key: "analytics", icon: BarChart3 },
      { label: "Security", key: "security", icon: ShieldCheck },
    ],
  },
];

const INVOICE_QUEUE = [];

const DEAL_PIPELINE = [];

const APPROVAL_ROUTES = [];

const ALERT_FEED = [];

const INVOICE_STATUS_STYLES: Record<InvoiceRow["status"], string> = {
  ready: "bg-emerald-50 text-emerald-600",
  variance: "bg-amber-50 text-amber-600",
  hold: "bg-rose-50 text-rose-600",
};

const INVOICE_STATUS_LABELS: Record<InvoiceRow["status"], string> = {
  ready: "Ready",
  variance: "Variance",
  hold: "On hold",
};

const ALERT_SEVERITY_STYLES: Record<AlertItem["severity"], { chip: string; icon: string; label: string }> = {
  critical: {
    chip: "bg-rose-50 text-rose-600",
    icon: "bg-rose-100 text-rose-600",
    label: "Critical",
  },
  warning: {
    chip: "bg-amber-50 text-amber-600",
    icon: "bg-amber-100 text-amber-600",
    label: "Warning",
  },
  info: {
    chip: "bg-slate-100 text-slate-500",
    icon: "bg-slate-200 text-slate-500",
    label: "Informational",
  },
};

const ACTIVITY_TONE_CLASSES: Record<(typeof ACTIVITY_LOG)[number]["tone"], string> = {
  emerald: "bg-emerald-400",
  sky: "bg-sky-400",
  rose: "bg-rose-400",
  slate: "bg-slate-400",
};

const HEADLINE_MAP: Record<string, string> = {
  overview: "Overview",
  crm: "CRM",
  finance: "Finance",
  inventory: "Inventory",
  procurement: "Procurement",
  "hr-ops": "HR & Operations",
  projects: "Projects",
  "it-support": "IT & Support",
  "marketing-sales": "Marketing & Sales",
  workflows: "Workflows",
  approvals: "Approvals",
  "automation-rules": "Automation Rules",
  policies: "Policies",
  reports: "Reports",
  dashboards: "Dashboards",
  "people-access": "People & Access",
  structure: "Structure",
  billing: "Billing",
  integrations: "Integrations",
};

const KPI_METRICS = [];

const LIVE_PANELS = [];

const ACTIVITY_LOG = [];

const TIMEFRAME_OPTIONS = ["Last 24 hours", "Last 7 days", "Last 30 days"];

// Map display names to API values
const TIMEFRAME_MAP: Record<string, string> = {
  "Last 24 hours": "last_24_hours",
  "Last 7 days": "last_7_days",
  "Last 30 days": "last_30_days",
};

export default function TenantAdminPage() {
  const [activeNav, setActiveNav] = useState("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState("Axiom Labs");
  const [selectedRegion, setSelectedRegion] = useState("Global HQ");
  const [selectedTimeframe, setSelectedTimeframe] = useState(TIMEFRAME_OPTIONS[1]);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [loadingTenant, setLoadingTenant] = useState(false);
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [crmSnapshot, setCrmSnapshot] = useState<CrmSnapshot>(CRM_BASELINE_SNAPSHOT);
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmError, setCrmError] = useState<string | null>(null);
  const [crmRequestVersion, setCrmRequestVersion] = useState(0);
  const [financeSnapshot, setFinanceSnapshot] = useState<FinanceSnapshot>(FINANCE_BASELINE_SNAPSHOT);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeError, setFinanceError] = useState<string | null>(null);
  const [financeRequestVersion, setFinanceRequestVersion] = useState(0);
  const [financeAccounts, setFinanceAccounts] = useState<FinanceCashAccount[]>(FINANCE_BASELINE_SNAPSHOT.cashAccounts);
  const [financeAccountsLoading, setFinanceAccountsLoading] = useState(false);
  const [financeAccountsError, setFinanceAccountsError] = useState<string | null>(null);
  const [financeAccountsVersion, setFinanceAccountsVersion] = useState(0);

  // Inventory state
  const [inventoryView, setInventoryView] = useState<"products" | "stock" | "transfers" | "alerts">("products");
  const [inventoryProducts, setInventoryProducts] = useState<Array<{ id: string; name: string; sku: string; category: string; currentStock: number; minStock: number; unitCost: number }>>([]);
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [showStockTransferModal, setShowStockTransferModal] = useState(false);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [inventoryToast, setInventoryToast] = useState<string | null>(null);

  // Procurement state
  const [procurementView, setProcurementView] = useState<"vendors" | "purchase-orders" | "invoices" | "approvals">("vendors");
  const [procurementVendors, setProcurementVendors] = useState<Array<{ id: string; name: string; code: string; category: string; paymentTerms: string; status: "active" | "inactive" }>>([]);
  const [showNewVendorModal, setShowNewVendorModal] = useState(false);
  const [showNewPOModal, setShowNewPOModal] = useState(false);
  const [procurementLoading, setProcurementLoading] = useState(false);
  const [procurementError, setProcurementError] = useState<string | null>(null);
  const [procurementToast, setProcurementToast] = useState<string | null>(null);

  const [crmActionType, setCrmActionType] = useState<CrmActionType | null>(null);
  const [crmActionToast, setCrmActionToast] = useState<string | null>(null);
  const [crmView, setCrmView] = useState<CrmView>("dashboard");
  const [financeView, setFinanceView] = useState<FinanceView>("overview");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImportingContacts, setIsImportingContacts] = useState(false);
  const [contactImportSample, setContactImportSample] = useState<CrmContactImportSampleState>(defaultContactImportSample());
  const [importedContacts, setImportedContacts] = useState<CrmImportedContact[]>([]);
  const [contactTagFilter, setContactTagFilter] = useState<string | null>(null);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);

  // Finance quick actions state
  const [showLogInvoiceModal, setShowLogInvoiceModal] = useState(false);
  const [showSchedulePaymentModal, setShowSchedulePaymentModal] = useState(false);
  const [showRecordExpenseModal, setShowRecordExpenseModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [quickActionToast, setQuickActionToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Invoice workspace state
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<InvoiceStatus | "all">("all");
  const [invoiceBranchFilter, setInvoiceBranchFilter] = useState<string>("all");
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");
  const [showInvoiceDrawer, setShowInvoiceDrawer] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoiceFormTab, setInvoiceFormTab] = useState<InvoiceFormTab>("details");
  const [crmContacts, setCrmContacts] = useState<CrmContact[]>([]);
  const [savedLineItems, setSavedLineItems] = useState<SavedLineItem[]>([]);

  const entityOptions = ["Axiom Labs", "Nova Holdings", "Helix Metals"];
  const regionOptions = ["Global HQ", "Americas", "EMEA", "APAC"];

  const headline = useMemo(() => HEADLINE_MAP[activeNav] ?? "Tenant admin", [activeNav]);
  const kpiMetrics = useMemo(() => {
    if (activeNav === "crm") {
      return crmSnapshot.metrics;
    }
    if (activeNav === "finance") {
      return financeSnapshot.metrics;
    }
    return KPI_METRICS;
  }, [activeNav, crmSnapshot.metrics, financeSnapshot.metrics]);

  const handleCrmRetry = useCallback(() => {
    setCrmRequestVersion((prev) => prev + 1);
  }, []);

  const handleFinanceRetry = useCallback(() => {
    setFinanceRequestVersion((prev) => prev + 1);
  }, []);

  const handleFinanceAccountsRefresh = useCallback(() => {
    setFinanceAccountsVersion((prev) => prev + 1);
  }, []);

  // Finance quick action handlers
  const handleLogInvoice = useCallback(() => {
    setFinanceView("invoices");
    setQuickActionToast({ message: "Opening invoices workspace...", type: "success" });
    setTimeout(() => setQuickActionToast(null), 2000);
  }, []);

  const handleSyncToERP = useCallback(() => {
    setQuickActionToast({ message: "Syncing invoice to ERP system...", type: "success" });
    setTimeout(() => setQuickActionToast(null), 3000);
  }, []);

  const handleSchedulePayment = useCallback(() => {
    setFinanceView("payments");
    setQuickActionToast({ message: "Opening payments workspace...", type: "success" });
    setTimeout(() => setQuickActionToast(null), 2000);
  }, []);

  const handleRouteApproval = useCallback(() => {
    setQuickActionToast({ message: "Payment routed for approval", type: "success" });
    setTimeout(() => setQuickActionToast(null), 3000);
  }, []);

  const handleRecordExpense = useCallback(() => {
    setFinanceView("expenses");
    setQuickActionToast({ message: "Opening expenses workspace...", type: "success" });
    setTimeout(() => setQuickActionToast(null), 2000);
  }, []);

  const handleAttachMemo = useCallback(() => {
    setQuickActionToast({ message: "Memo attached to expense record", type: "success" });
    setTimeout(() => setQuickActionToast(null), 3000);
  }, []);

  const handleTriggerPayout = useCallback(() => {
    setFinanceView("payments");
    setQuickActionToast({ message: "Opening payments workspace...", type: "success" });
    setTimeout(() => setQuickActionToast(null), 2000);
  }, []);

  const handleTreasuryMesh = useCallback(() => {
    setQuickActionToast({ message: "Treasury mesh initiated for liquidity management", type: "success" });
    setTimeout(() => setQuickActionToast(null), 3000);
  }, []);

  // Invoice handlers
  const handleSaveInvoice = useCallback(async (invoiceData: {
    customer: string;
    customerEmail?: string;
    contactId?: string;
    contactType?: 'individual' | 'business';
    amount: string;
    issueDate: string;
    dueDate: string;
    branch: string;
    status: InvoiceStatus;
    items: InvoiceLineItem[];
    notes?: string;
    taxRate?: number;
    discount?: number;
  }) => {
    try {
      const invoiceNumber = selectedInvoiceId 
        ? invoices.find(inv => inv.id === selectedInvoiceId)?.invoiceNumber || `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, "0")}`
        : `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, "0")}`;
      
      const amount = parseFloat(invoiceData.amount);
      
      // Prepare the invoice data for the API
      const apiPayload = {
        tenantSlug: tenantSlug || "kreatix-default",
        customerName: invoiceData.customer,
        customerCode: invoiceData.contactId,
        invoiceNumber,
        issuedDate: invoiceData.issueDate,
        dueDate: invoiceData.dueDate,
        amount,
        currency: "₦",
        status: invoiceData.status,
        notes: invoiceData.notes,
        metadata: {
          items: invoiceData.items,
          taxRate: invoiceData.taxRate,
          discount: invoiceData.discount,
          contactType: invoiceData.contactType,
          customerEmail: invoiceData.customerEmail,
          branch: invoiceData.branch,
        },
      };

      // Call the API
      const response = await fetch("/api/finance/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiPayload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.toString() || "Failed to save invoice");
      }

      const result = await response.json();
      
      // Update local state after successful API call
      const newInvoice: InvoiceItem = {
        id: selectedInvoiceId || result.invoice?.id || String(Date.now()),
        invoiceNumber,
        customer: invoiceData.customer,
        customerEmail: invoiceData.customerEmail,
        contactId: invoiceData.contactId,
        contactType: invoiceData.contactType,
        amount: invoiceData.amount,
        status: invoiceData.status,
        dueDate: invoiceData.dueDate,
        issueDate: invoiceData.issueDate,
        branch: invoiceData.branch,
        items: invoiceData.items,
        notes: invoiceData.notes,
        taxRate: invoiceData.taxRate,
        discount: invoiceData.discount,
      };

      if (selectedInvoiceId) {
        setInvoices(invoices.map(inv => inv.id === selectedInvoiceId ? newInvoice : inv));
        setQuickActionToast({ message: `Invoice ${invoiceData.status === 'draft' ? 'draft saved' : 'updated'} successfully`, type: "success" });
      } else {
        setInvoices([...invoices, newInvoice]);
        setQuickActionToast({ message: `Invoice ${invoiceData.status === 'draft' ? 'draft created' : 'created'} successfully`, type: "success" });
      }
      
      setTimeout(() => setQuickActionToast(null), 3000);
      setShowInvoiceDrawer(false);
      setSelectedInvoiceId(null);
      setInvoiceFormTab("details");
    } catch (error) {
      console.error("Error saving invoice:", error);
      setQuickActionToast({ 
        message: `Failed to save invoice: ${error instanceof Error ? error.message : "Unknown error"}`, 
        type: "error" 
      });
      setTimeout(() => setQuickActionToast(null), 5000);
    }
  }, [invoices, selectedInvoiceId, tenantSlug]);

  const handleSaveLineItem = useCallback((description: string, defaultPrice: number, category?: string) => {
    const newItem: SavedLineItem = {
      id: `item-${Date.now()}`,
      description,
      defaultPrice,
      category,
    };
    setSavedLineItems([...savedLineItems, newItem]);
    setQuickActionToast({ message: "Item saved to catalog", type: "success" });
    setTimeout(() => setQuickActionToast(null), 2000);
  }, [savedLineItems]);

  const refreshContacts = useCallback(async () => {
    setContactsLoading(true);
    setContactsError(null);
    try {
      const query = new URLSearchParams({ tenantSlug: tenantSlug ?? "kreatix-default" });
      const response = await fetch(`/api/crm/contacts?${query.toString()}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Contacts sync failed");
      }
      const contactsFromApi = Array.isArray(payload?.contacts) ? (payload.contacts as CrmContactApiResponse[]) : [];
      setImportedContacts(contactsFromApi.map((contact) => mapContactApiToImportedContact(contact)));
    } catch (error) {
      console.error("Contacts fetch failed", error);
      setContactsError(error instanceof Error ? error.message : "Unable to load contacts");
    } finally {
      setContactsLoading(false);
    }
  }, [tenantSlug]);

  const handleImportContacts = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      setIsImportingContacts(true);
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = reader.result as string;
          const parsedContacts = parseImportedContactsCsv(text);
          if (parsedContacts.length === 0) {
            setCrmActionToast("Contact file empty");
          } else {
            const normalizedContacts = parsedContacts.map((contact) => ({
              ...contact,
              tags: Array.isArray(contact.tags) ? contact.tags : [],
            }));
            const payload = {
              tenantSlug: tenantSlug ?? "kreatix-default",
              contacts: normalizedContacts.map((contact) => ({
                company: contact.company,
                contactName: contact.contact,
                contactEmail: contact.email && contact.email.trim() ? contact.email.trim() : undefined,
                contactPhone: contact.phone && contact.phone.trim() ? contact.phone.trim() : undefined,
                source: contact.source,
                status: contact.status,
                tags: contact.tags,
                importedAt: contact.importedAt,
              })),
            };
            fetch("/api/crm/contacts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
              .then((response) => response.json().then((data) => ({ ok: response.ok, data })).catch(() => ({ ok: false, data: null })))
              .then(async ({ ok, data }) => {
                if (!ok) {
                  throw new Error(data?.error ?? "Import failed");
                }
                await refreshContacts();
                setCrmActionToast(`Imported ${(Array.isArray(data?.contacts) ? data.contacts.length : parsedContacts.length).toString()} contacts from ${file.name}`);
                setCrmView("contacts");
              })
              .catch((error) => {
                console.error("Contact import failed", error);
                setCrmActionToast(error instanceof Error ? error.message : "Import failed");
              })
              .finally(() => {
                setIsImportingContacts(false);
                event.target.value = "";
              });
            return;
          }
        } catch (error) {
          console.error("Contact import failed", error);
          setCrmActionToast("Import failed");
        }
        setIsImportingContacts(false);
        event.target.value = "";
      };
      reader.onerror = () => {
        console.error("Contact import read error", reader.error);
        setCrmActionToast("Import failed");
        setIsImportingContacts(false);
        event.target.value = "";
      };
      reader.readAsText(file);
    },
    [refreshContacts, setCrmView, tenantSlug]
  );

  const handleContactSampleChange = useCallback((field: keyof CrmContactImportSampleState, value: string) => {
    setContactImportSample((previous) => ({ ...previous, [field]: value }));
  }, []);

  const handleContactSamplePrefill = useCallback(() => {
    setContactImportSample({
      company: "Nova Retail",
      firstName: "Sara",
      lastName: "Bello",
      email: "sara@nova.io",
      phone: "+234 801 555 9988",
      tags: "Key Account, High Priority",
    });
  }, []);

  const handleContactSampleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const header = ["Company", "First Name", "Last Name", "Email", "Phone", "Tags"];
      const row = [
        contactImportSample.company,
        contactImportSample.firstName,
        contactImportSample.lastName,
        contactImportSample.email,
        contactImportSample.phone,
        contactImportSample.tags,
      ];
      downloadCsvFile([header, row], `crm-contact-sample-${Date.now()}.csv`);
      setCrmActionToast("Sample CSV downloaded");
    },
    [contactImportSample]
  );

  const handleExportContacts = useCallback(() => {
    if (!importedContacts.length) {
      setCrmActionToast("No contacts to export yet");
      return;
    }
    const header = ["Company", "Contact", "Email", "Phone", "Source", "Status", "Tags"];
    const rows = importedContacts.map((contact) => [
      contact.company,
      contact.contact,
      contact.email,
      contact.phone,
      contact.source,
      contact.status,
      contact.tags.join("; "),
    ]);
    downloadCsvFile([header, ...rows], `crm-contacts-${Date.now()}.csv`);
    setCrmActionToast("Contacts exported");
  }, [importedContacts]);

  const handleContactTagToggle = useCallback(
    (contactId: string, tag: string) => {
      const target = importedContacts.find((contact) => contact.id === contactId);
      if (!target) {
        return;
      }
      const currentTags = Array.isArray(target.tags) ? target.tags : [];
      const hasTag = currentTags.includes(tag);
      const nextTags = hasTag ? currentTags.filter((value) => value !== tag) : [...currentTags, tag];

      setImportedContacts((previous) =>
        previous.map((contact) => (contact.id === contactId ? { ...contact, tags: nextTags } : contact))
      );

      fetch(`/api/crm/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: nextTags }),
      })
        .then((response) => response.json().then((data) => ({ ok: response.ok, data })).catch(() => ({ ok: false, data: null })))
        .then(({ ok, data }) => {
          if (!ok) {
            throw new Error(data?.error ?? "Tag update failed");
          }
          if (data?.contact) {
            const normalized = mapContactApiToImportedContact(data.contact as CrmContactApiResponse);
            setImportedContacts((previous) =>
              previous.map((contact) => (contact.id === contactId ? normalized : contact))
            );
          }
        })
        .catch((error) => {
          console.error("Contact tag update failed", error);
          setImportedContacts((previous) =>
            previous.map((contact) => (contact.id === contactId ? { ...contact, tags: currentTags } : contact))
          );
          setCrmActionToast(error instanceof Error ? error.message : "Unable to update tags");
        });
    },
    [importedContacts]
  );

  const handleContactTagFilterChange = useCallback((tag: string | null) => {
    setContactTagFilter(tag);
  }, []);

  const handleCrmActionSubmit = useCallback(
    async (submission: CrmActionSubmission) => {
      if (submission.type === "customer") {
        const regionId = regionToId(selectedRegion);
        const branchId = `${regionId}-branch`;
        const optimisticId = `temp-${Date.now()}`;
        const ownerName = `${submission.payload.contactFirstName} ${submission.payload.contactLastName}`.trim();
        const optimisticCustomer: CrmCustomerView = {
          id: optimisticId,
          name: submission.payload.name,
          region: regionId,
          branch: branchId,
          owner: ownerName,
          status: submission.payload.status,
          contactName: ownerName,
          contactEmail: submission.payload.contactEmail,
          contactPhone: submission.payload.contactPhone,
        };
        let rollbackCustomers: CrmCustomerView[] | null = null;
        setCrmSnapshot((previous) => {
          if (!previous) {
            return previous;
          }
          rollbackCustomers = previous.customers;
          return {
            ...previous,
            customers: [optimisticCustomer, ...previous.customers],
          };
        });
        try {
          const payload = {
            tenantSlug: tenantSlug ?? "kreatix-default",
            regionId,
            branchId,
            name: submission.payload.name,
            contactFirstName: submission.payload.contactFirstName,
            contactLastName: submission.payload.contactLastName,
            contactEmail: submission.payload.contactEmail,
            contactPhone: submission.payload.contactPhone,
            status: submission.payload.status,
          };
          const response = await fetch("/api/crm/customers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(data?.error ?? "Customer creation failed");
          }
          const createdCustomer = mapCustomerRecordToView(data.customer as CrmCustomerRecordNormalized);
          setCrmSnapshot((previous) => {
            if (!previous) {
              return previous;
            }
            return {
              ...previous,
              customers: previous.customers.map((customer) => (customer.id === optimisticId ? createdCustomer : customer)),
            };
          });
          setCrmActionToast("Customer added");
        } catch (error) {
          console.error("Customer create failed", error);
          if (rollbackCustomers) {
            setCrmSnapshot((previous) => {
              if (!previous) {
                return previous;
              }
              return {
                ...previous,
                customers: rollbackCustomers as CrmCustomerView[],
              };
            });
          }
          setCrmActionToast("Unable to save customer");
        } finally {
          setCrmActionType(null);
        }
        return;
      }

      if (submission.type === "contact" || submission.type === "opportunity") {
        try {
          const regionId = regionToId(selectedRegion);
          const payload = {
            tenantSlug: tenantSlug ?? "kreatix-default",
            regionId,
            branchId: `${regionId}-branch`,
            companyName: submission.payload.company || "Untitled Co",
            contactName: submission.payload.contact || "Primary contact",
            stage: submission.payload.stage || "Qualification",
            source: submission.type === "contact" ? "website" : "referral",
            owner: submission.payload.owner,
            expectedValue: parseCurrencyValue(submission.payload.value),
            currency: "₦",
          };

          const response = await fetch("/api/crm/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(data?.error ?? "Lead creation failed");
          }

          const createdLead = mapLeadRecordToView(data.lead as CrmLeadRecord);
          setCrmSnapshot((previous) => {
            if (!previous) {
              return previous;
            }
            return {
              ...previous,
              leads: [createdLead, ...previous.leads],
            };
          });

          if (submission.type === "opportunity") {
            const dealResponse = await fetch("/api/crm/deals", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tenantSlug: payload.tenantSlug,
                leadId: createdLead.id,
                stage: "prospecting",
                value: payload.expectedValue ?? 0,
                currency: payload.currency,
                probability: 40,
                assignedOfficerId: submission.payload.owner,
              }),
            });
            const dealData = await dealResponse.json().catch(() => ({}));
            if (!dealResponse.ok) {
              throw new Error(dealData?.error ?? "Deal creation failed");
            }
            const createdDeal = mapDealRecordToView(dealData.deal as CrmDealRecord);
            setCrmSnapshot((previous) => {
              if (!previous) {
                return previous;
              }
              return {
                ...previous,
                leads: [createdDeal, ...previous.leads],
              };
            });
          }

          setCrmActionToast(submission.type === "contact" ? "Contact added" : "Opportunity registered");
        } catch (error) {
          console.error("Lead create failed", error);
          setCrmActionToast("Unable to save lead");
        } finally {
          setCrmActionType(null);
        }
        return;
      }

      setCrmSnapshot((previous) => {
        if (!previous) {
          return previous;
        }
        const newEngagement: CrmEngagement = {
          id: generateEngagementId(),
          title: submission.payload.title || "Logged touchpoint",
          detail: submission.payload.detail || "Details captured",
          timestamp: "Just now",
          channel: submission.payload.channel,
        };
        return {
          ...previous,
          engagements: [newEngagement, ...previous.engagements].slice(0, Math.max(previous.engagements.length, 5)),
        };
      });
      setCrmActionType(null);
      setCrmActionToast("Engagement logged");
    },
    [selectedRegion, tenantSlug]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("tenantSlug")?.trim();
    if (!slug) {
      setTenantSlug(null);
      return;
    }

    async function fetchTenantContext(value: string) {
      setLoadingTenant(true);
      setTenantError(null);
      try {
        const response = await fetch(`/api/tenant/org-structure?tenantSlug=${encodeURIComponent(value)}`);
        if (!response.ok) {
          throw new Error(`Failed to load tenant context (${response.status})`);
        }
        const payload = await response.json();
        setTenantSlug(payload.tenantSlug ?? value);
      } catch (error) {
        console.error("Tenant context fetch failed", error);
        setTenantSlug(value);
        setTenantError(error instanceof Error ? error.message : "Unable to load tenant context");
      } finally {
        setLoadingTenant(false);
      }
    }

    fetchTenantContext(slug);
  }, []);

  useEffect(() => {
    if (activeNav !== "crm") {
      return;
    }

    let cancelled = false;
    setCrmLoading(true);
    setCrmError(null);

    fetchCrmSnapshot(tenantSlug, selectedTimeframe, selectedRegion)
      .then((snapshot) => {
        if (!cancelled) {
          setCrmSnapshot(snapshot);
        }
      })
      .catch((error) => {
        console.error("CRM snapshot fetch failed", error);
        if (!cancelled) {
          setCrmError(error instanceof Error ? error.message : "Unable to load CRM data");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCrmLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeNav, tenantSlug, selectedTimeframe, selectedRegion, crmRequestVersion]);

  useEffect(() => {
    if (activeNav !== "finance") {
      return;
    }

    let cancelled = false;
    setFinanceLoading(true);
    setFinanceError(null);

    fetchFinanceSnapshot(tenantSlug, selectedTimeframe, selectedRegion)
      .then((snapshot) => {
        if (!cancelled) {
          setFinanceSnapshot(snapshot);
        }
      })
      .catch((error) => {
        console.error("Finance snapshot fetch failed", error);
        if (!cancelled) {
          setFinanceError(error instanceof Error ? error.message : "Unable to load finance data");
          setFinanceSnapshot(FINANCE_BASELINE_SNAPSHOT);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setFinanceLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeNav, tenantSlug, selectedTimeframe, selectedRegion, financeRequestVersion]);

  useEffect(() => {
    if (activeNav !== "finance") {
      return;
    }

    let cancelled = false;
    setFinanceAccountsLoading(true);
    setFinanceAccountsError(null);

    fetchFinanceCashAccounts(tenantSlug, selectedRegion)
      .then((accounts) => {
        if (!cancelled) {
          setFinanceAccounts(accounts);
        }
      })
      .catch((error) => {
        console.error("Finance accounts fetch failed", error);
        if (!cancelled) {
          setFinanceAccountsError(error instanceof Error ? error.message : "Unable to load finance accounts");
          setFinanceAccounts(FINANCE_BASELINE_SNAPSHOT.cashAccounts);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setFinanceAccountsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeNav, tenantSlug, selectedRegion, financeAccountsVersion]);

  useEffect(() => {
    refreshContacts();
  }, [refreshContacts]);

  // Fetch CRM contacts for invoice autocomplete
  useEffect(() => {
    if (!tenantSlug) return;

    fetch(`/api/crm/contacts?tenantSlug=${tenantSlug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.contacts) {
          const contacts: CrmContact[] = data.contacts.map((c: any) => ({
            id: c.id,
            firstName: c.firstName || c.contactName?.split(' ')[0] || "",
            lastName: c.lastName || c.contactName?.split(' ').slice(1).join(' ') || "",
            email: c.email || c.contactEmail || "",
            phone: c.phone || c.contactPhone || "",
            company: c.company || "",
            tags: c.tags || [],
            type: c.company ? 'business' as const : 'individual' as const,  // Distinguish based on company presence
          }));
          setCrmContacts(contacts);
        }
      })
      .catch((err) => console.error("Failed to fetch CRM contacts:", err));
  }, [tenantSlug]);

  useEffect(() => {
    if (!crmActionToast) {
      return;
    }
    const timeout = window.setTimeout(() => setCrmActionToast(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [crmActionToast]);

  // Fetch invoices from database on component mount
  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const response = await fetch("/api/finance/invoices?tenantSlug=default");
        if (response.ok) {
          const data = await response.json();
          if (data.invoices && Array.isArray(data.invoices)) {
            // Convert API format to UI format
            const formattedInvoices = data.invoices.map((inv: any) => ({
              id: inv.id,
              invoiceNumber: inv.invoiceNumber,
              customer: inv.customerName,
              amount: inv.amount.toString(),
              status: inv.status,
              issueDate: inv.issuedDate,
              dueDate: inv.dueDate,
              customerEmail: inv.metadata?.customerEmail,
              contactId: inv.customerCode,
              contactType: inv.metadata?.contactType,
              branch: inv.metadata?.branch,
              items: inv.metadata?.items || inv.lineItems || [],
              taxRate: inv.metadata?.taxRate,
              discount: inv.metadata?.discount,
              notes: inv.notes,
            }));
            setInvoices(formattedInvoices);
          }
        }
      } catch (err) {
        console.error("Failed to fetch invoices:", err);
      }
    };
    fetchInvoices();
  }, []);

  // Fetch payments from database on component mount
  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const response = await fetch("/api/finance/payments?tenantSlug=default");
        if (response.ok) {
          const data = await response.json();
          if (data.payments && Array.isArray(data.payments)) {
            // Convert API format to UI format
            const formattedPayments = data.payments.map((pay: any) => ({
              id: pay.id,
              payableId: `PYB-${Math.random().toString(36).substr(2, 4)}`,
              customerId: pay.customerId,
              invoiceId: pay.invoiceId,
              reference: pay.reference,
              grossAmount: pay.grossAmount.toString(),
              fees: pay.fees.toString(),
              netAmount: pay.netAmount.toString(),
              method: pay.method,
              gateway: pay.gateway,
              gatewayReference: pay.gatewayReference,
              paymentDate: pay.paymentDate,
              settlementDate: pay.settlementDate,
              confirmationDetails: pay.confirmationDetails,
              status: pay.status,
              linkedInvoices: pay.linkedInvoices || [],
              auditTrail: [{ action: "created", timestamp: pay.createdAt, user: "system" }],
              createdAt: pay.createdAt,
              updatedAt: pay.updatedAt,
            }));
            setPayments(formattedPayments);
          }
        }
      } catch (err) {
        console.error("Failed to fetch payments:", err);
      }
    };
    fetchPayments();
  }, []);

  return (
    <div className="min-h-screen bg-[#e9eef5] text-slate-900">
      <div className="flex h-screen flex-col">
        <TopBar
          entityOptions={entityOptions}
          regionOptions={regionOptions}
          selectedEntity={selectedEntity}
          selectedRegion={selectedRegion}
          timeframeOptions={TIMEFRAME_OPTIONS}
          selectedTimeframe={selectedTimeframe}
          onEntityChange={setSelectedEntity}
          onRegionChange={setSelectedRegion}
          onTimeframeChange={setSelectedTimeframe}
        />

        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((prev) => !prev)}
            navigation={NAVIGATION}
            activeKey={activeNav}
            onNavigate={setActiveNav}
          />

          <main className="flex flex-1 flex-col overflow-y-auto">
            <header className="border-b border-slate-200 bg-white/90 px-8 py-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-400">{selectedRegion}</p>
                  <h1 className="text-2xl font-semibold text-slate-900">{headline}</h1>
                  <p className="text-sm text-slate-500">Holistic view into finance + ops health</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {loadingTenant && (
                      <span className="rounded-full bg-slate-900/5 px-3 py-1">Syncing tenant context…</span>
                    )}
                    {tenantSlug && !loadingTenant && (
                      <span className="rounded-full bg-slate-900/5 px-3 py-1">Tenant: {tenantSlug}</span>
                    )}
                    {tenantError && (
                      <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-600">{tenantError}</span>
                    )}
                    {crmActionToast && (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-600">{crmActionToast}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-600 shadow-sm hover:border-slate-300">
                    <CalendarClock className="h-4 w-4" />
                    {selectedTimeframe}
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-600 shadow-sm hover:border-slate-300">
                    <Command className="h-4 w-4" />
                    Launch command palette
                  </button>
                </div>
              </div>
            </header>

            <section className="flex-1 overflow-y-auto px-8 py-10">
              <div className="space-y-10">
                <KpiGrid metrics={kpiMetrics} />

                {activeNav === "crm" ? (
                  <CrmDashboard
                    snapshot={crmSnapshot}
                    loading={crmLoading}
                    error={crmError}
                    onRetry={handleCrmRetry}
                    onAddContact={() => setCrmActionType("contact")}
                    onRegisterOpportunity={() => setCrmActionType("opportunity")}
                    onLogEngagement={() => setCrmActionType("engagement")}
                    onAddCustomer={() => setCrmActionType("customer")}
                    onImportContacts={handleImportContacts}
                    onExportContacts={handleExportContacts}
                    contactSample={contactImportSample}
                    onSampleChange={handleContactSampleChange}
                    onSampleSubmit={handleContactSampleSubmit}
                    onSamplePrefill={handleContactSamplePrefill}
                    importingContacts={isImportingContacts}
                    currentView={crmView}
                    onViewChange={setCrmView}
                    contacts={importedContacts}
                    contactsLoading={contactsLoading}
                    contactsError={contactsError}
                    onContactsRetry={refreshContacts}
                    tagOptions={CRM_CONTACT_TAG_OPTIONS}
                    activeTagFilter={contactTagFilter}
                    onTagFilterChange={handleContactTagFilterChange}
                    onTagToggle={handleContactTagToggle}
                  />
                ) : activeNav === "finance" ? (
                  <FinanceWorkspace
                    snapshot={financeSnapshot}
                    loading={financeLoading}
                    error={financeError}
                    onRetry={handleFinanceRetry}
                    cashAccounts={financeAccounts}
                    cashAccountsLoading={financeAccountsLoading}
                    cashAccountsError={financeAccountsError}
                    onRefreshAccounts={() => setFinanceAccountsVersion((prev) => prev + 1)}
                    onLogInvoice={handleLogInvoice}
                    onSyncToERP={handleSyncToERP}
                    onSchedulePayment={handleSchedulePayment}
                    onRouteApproval={handleRouteApproval}
                    onRecordExpense={handleRecordExpense}
                    onAttachMemo={handleAttachMemo}
                    onTriggerPayout={handleTriggerPayout}
                    onTreasuryMesh={handleTreasuryMesh}
                    currentView={financeView}
                    onViewChange={setFinanceView}
                    invoices={invoices}
                    invoiceStatusFilter={invoiceStatusFilter}
                    invoiceBranchFilter={invoiceBranchFilter}
                    invoiceSearchQuery={invoiceSearchQuery}
                    onInvoiceStatusFilterChange={setInvoiceStatusFilter}
                    onInvoiceBranchFilterChange={setInvoiceBranchFilter}
                    onInvoiceSearchChange={setInvoiceSearchQuery}
                    showInvoiceDrawer={showInvoiceDrawer}
                    onShowInvoiceDrawer={setShowInvoiceDrawer}
                    selectedInvoiceId={selectedInvoiceId}
                    onSelectInvoice={setSelectedInvoiceId}
                    invoiceFormTab={invoiceFormTab}
                    onInvoiceFormTabChange={setInvoiceFormTab}
                    onSaveInvoice={handleSaveInvoice}
                    crmContacts={crmContacts}
                    savedLineItems={savedLineItems}
                    onSaveLineItem={handleSaveLineItem}
                  />
                ) : activeNav === "inventory" ? (
                  <InventoryWorkspace
                    currentView={inventoryView}
                    onViewChange={setInventoryView}
                    products={inventoryProducts}
                    onAddProduct={() => setShowNewProductModal(true)}
                    onTransferStock={() => setShowStockTransferModal(true)}
                    loading={inventoryLoading}
                    error={inventoryError}
                    tenantSlug={tenantSlug}
                    toast={inventoryToast}
                    onToastDismiss={() => setInventoryToast(null)}
                  />
                ) : activeNav === "procurement" ? (
                  <ProcurementWorkspace
                    currentView={procurementView}
                    onViewChange={setProcurementView}
                    vendors={procurementVendors}
                    onAddVendor={() => setShowNewVendorModal(true)}
                    onCreatePO={() => setShowNewPOModal(true)}
                    loading={procurementLoading}
                    error={procurementError}
                    tenantSlug={tenantSlug}
                    toast={procurementToast}
                    onToastDismiss={() => setProcurementToast(null)}
                  />
                ) : activeNav === "structure" ? (
                  <DepartmentManagement tenantSlug={tenantSlug} />
                ) : activeNav === "people-access" ? (
                  <div className="space-y-8">
                    <RoleBuilder tenantSlug={tenantSlug} />
                    <EmployeeConsole tenantSlug={tenantSlug} />
                    <AccessControlPanel tenantSlug={tenantSlug} />
                  </div>
                ) : activeNav === "approvals" ? (
                  <ApprovalDesigner tenantSlug={tenantSlug} />
                ) : activeNav === "workflows" ? (
                  <LifecycleWorkflows tenantSlug={tenantSlug} />
                ) : activeNav === "modules" ? (
                  <ModuleRegistry tenantSlug={tenantSlug} />
                ) : activeNav === "billing" ? (
                  <BillingSection tenantSlug={tenantSlug} />
                ) : activeNav === "cost-allocation" ? (
                  <CostAllocationSection tenantSlug={tenantSlug} />
                ) : activeNav === "integrations" ? (
                  <IntegrationsSection tenantSlug={tenantSlug} />
                ) : activeNav === "analytics" ? (
                  <AnalyticsSection tenantSlug={tenantSlug} />
                ) : activeNav === "security" ? (
                  <SecuritySection tenantSlug={tenantSlug} />
                ) : (
                  <div className="grid gap-8 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
                    <div className="space-y-8">
                      <InvoiceReviewBoard invoices={INVOICE_QUEUE} />
                      <DealPipelineBoard deals={DEAL_PIPELINE} />
                      <LiveOperations panels={LIVE_PANELS} />
                    </div>
                    <div className="space-y-8">
                      <ApprovalsPanel routes={APPROVAL_ROUTES} />
                      <AlertStack alerts={ALERT_FEED} />
                      <ActivityStream />
                    </div>
                  </div>
                )}
              </div>
            </section>
          </main>
        </div>
      </div>
      {crmActionType && (
        <CrmActionModal
          type={crmActionType}
          onClose={() => setCrmActionType(null)}
          onSubmit={handleCrmActionSubmit}
          contacts={importedContacts}
          tagOptions={CRM_CONTACT_TAG_OPTIONS}
        />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={handleImportFileChange}
      />
    </div>
  );
}

function InventoryWorkspace({
  currentView,
  onViewChange,
  products,
  onAddProduct,
  onTransferStock,
  loading,
  error,
  tenantSlug,
  toast,
  onToastDismiss,
}: {
  currentView: "products" | "stock" | "transfers" | "alerts";
  onViewChange: (view: "products" | "stock" | "transfers" | "alerts") => void;
  products: Array<{ id: string; name: string; sku: string; category: string; currentStock: number; minStock: number; unitCost: number }>;
  onAddProduct: () => void;
  onTransferStock: () => void;
  loading: boolean;
  error: string | null;
  tenantSlug: string | null;
  toast: string | null;
  onToastDismiss: () => void;
}) {
  return (
    <div className="space-y-8">
      {/* Toast notification */}
      {toast && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-6 py-4 text-emerald-600">
          <div className="flex items-center justify-between">
            <span>{toast}</span>
            <button onClick={onToastDismiss} className="text-emerald-600 hover:text-emerald-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* View tabs */}
      <div className="flex gap-3 border-b border-slate-200">
        {(["products", "stock", "transfers", "alerts"] as const).map((view) => (
          <button
            key={view}
            onClick={() => onViewChange(view)}
            className={`px-4 py-3 text-sm font-medium transition ${
              currentView === view
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {view.charAt(0).toUpperCase() + view.slice(1)}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 px-6 py-4 text-rose-600">
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Products View */}
      {currentView === "products" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Total Products</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{products.length}</p>
              <p className="mt-2 text-sm text-slate-500">Active SKUs in catalog</p>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Low Stock Items</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{products.filter(p => p.currentStock <= p.minStock).length}</p>
              <p className="mt-2 text-sm text-slate-500">Require replenishment</p>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Inventory Value</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">₦{(products.reduce((sum, p) => sum + (p.currentStock * p.unitCost), 0) / 1000000).toFixed(1)}M</p>
              <p className="mt-2 text-sm text-slate-500">Total asset value</p>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Categories</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{new Set(products.map(p => p.category)).size}</p>
              <p className="mt-2 text-sm text-slate-500">Product categories</p>
            </div>
          </div>

          {/* Add Product Button */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Product Catalog</p>
              <h2 className="text-xl font-semibold text-slate-900">All Products</h2>
            </div>
            <button
              onClick={onAddProduct}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800"
            >
              <Package className="h-4 w-4" />
              Add Product
            </button>
          </div>

          {/* Products Table */}
          <div className="rounded-3xl border border-slate-100 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900">Product</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900">SKU</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900">Category</th>
                  <th className="px-6 py-3 text-right font-semibold text-slate-900">Current Stock</th>
                  <th className="px-6 py-3 text-right font-semibold text-slate-900">Min Level</th>
                  <th className="px-6 py-3 text-right font-semibold text-slate-900">Unit Cost</th>
                  <th className="px-6 py-3 text-center font-semibold text-slate-900">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.length > 0 ? (
                  products.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">{product.name}</td>
                      <td className="px-6 py-4 text-slate-500">{product.sku}</td>
                      <td className="px-6 py-4">{product.category}</td>
                      <td className="px-6 py-4 text-right font-medium">{product.currentStock}</td>
                      <td className="px-6 py-4 text-right text-slate-500">{product.minStock}</td>
                      <td className="px-6 py-4 text-right">₦{product.unitCost.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          product.currentStock > product.minStock
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-rose-50 text-rose-600"
                        }`}>
                          {product.currentStock > product.minStock ? "In Stock" : "Low Stock"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      No products found. Click "Add Product" to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock View */}
      {currentView === "stock" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Stock Levels</p>
              <h2 className="text-xl font-semibold text-slate-900">Inventory Status</h2>
            </div>
            <button
              onClick={onTransferStock}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800"
            >
              <ArrowUpRight className="h-4 w-4" />
              Transfer Stock
            </button>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900">Product</th>
                  <th className="px-6 py-3 text-right font-semibold text-slate-900">Quantity</th>
                  <th className="px-6 py-3 text-right font-semibold text-slate-900">Value</th>
                  <th className="px-6 py-3 text-center font-semibold text-slate-900">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium">{product.name}</td>
                    <td className="px-6 py-4 text-right">{product.currentStock} units</td>
                    <td className="px-6 py-4 text-right">₦{(product.currentStock * product.unitCost).toLocaleString()}</td>
                    <td className="px-6 py-4 text-center text-slate-500">Main Warehouse</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transfers View */}
      {currentView === "transfers" && (
        <div className="space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Stock Movements</p>
            <h2 className="text-xl font-semibold text-slate-900">Transfer History</h2>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center">
            <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-600 font-medium">No transfers recorded yet</p>
            <p className="text-sm text-slate-500 mt-1">Transfers will appear here as you move inventory</p>
            <button
              onClick={onTransferStock}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <ArrowUpRight className="h-4 w-4" />
              Create Transfer
            </button>
          </div>
        </div>
      )}

      {/* Alerts View */}
      {currentView === "alerts" && (
        <div className="space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Notifications</p>
            <h2 className="text-xl font-semibold text-slate-900">Inventory Alerts</h2>
          </div>

          {products.filter(p => p.currentStock <= p.minStock).length > 0 ? (
            <div className="space-y-3">
              {products.filter(p => p.currentStock <= p.minStock).map((product) => (
                <div key={product.id} className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-rose-900">{product.name} - Low Stock Alert</p>
                      <p className="text-sm text-rose-700 mt-1">Current: {product.currentStock} units | Minimum: {product.minStock} units</p>
                    </div>
                    <span className="inline-flex rounded-full bg-rose-100 text-rose-600 px-3 py-1 text-xs font-medium">Critical</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-8 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-4" />
              <p className="text-emerald-900 font-medium">All stock levels are healthy</p>
              <p className="text-sm text-emerald-700 mt-1">No alerts to address at this time</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProcurementWorkspace({
  currentView,
  onViewChange,
  vendors,
  onAddVendor,
  onCreatePO,
  loading,
  error,
  tenantSlug,
  toast,
  onToastDismiss,
}: {
  currentView: "vendors" | "purchase-orders" | "invoices" | "approvals";
  onViewChange: (view: "vendors" | "purchase-orders" | "invoices" | "approvals") => void;
  vendors: Array<{ id: string; name: string; code: string; category: string; paymentTerms: string; status: "active" | "inactive" }>;
  onAddVendor: () => void;
  onCreatePO: () => void;
  loading: boolean;
  error: string | null;
  tenantSlug: string | null;
  toast: string | null;
  onToastDismiss: () => void;
}) {
  return (
    <div className="space-y-8">
      {/* Toast notification */}
      {toast && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-6 py-4 text-emerald-600">
          <div className="flex items-center justify-between">
            <span>{toast}</span>
            <button onClick={onToastDismiss} className="text-emerald-600 hover:text-emerald-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* View tabs */}
      <div className="flex gap-3 border-b border-slate-200">
        {(["vendors", "purchase-orders", "invoices", "approvals"] as const).map((view) => (
          <button
            key={view}
            onClick={() => onViewChange(view)}
            className={`px-4 py-3 text-sm font-medium transition ${
              currentView === view
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {view === "purchase-orders"
              ? "Purchase Orders"
              : view.charAt(0).toUpperCase() + view.slice(1)}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 px-6 py-4 text-rose-600">
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Vendors View */}
      {currentView === "vendors" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Total Vendors</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{vendors.length}</p>
              <p className="mt-2 text-sm text-slate-500">Active suppliers</p>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Active</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{vendors.filter(v => v.status === "active").length}</p>
              <p className="mt-2 text-sm text-slate-500">Approved suppliers</p>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Categories</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{new Set(vendors.map(v => v.category)).size}</p>
              <p className="mt-2 text-sm text-slate-500">Vendor categories</p>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Avg Payment Terms</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">Net 30</p>
              <p className="mt-2 text-sm text-slate-500">Payment window</p>
            </div>
          </div>

          {/* Add Vendor Button */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Vendor Registry</p>
              <h2 className="text-xl font-semibold text-slate-900">All Suppliers</h2>
            </div>
            <button
              onClick={onAddVendor}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800"
            >
              <Truck className="h-4 w-4" />
              Add Vendor
            </button>
          </div>

          {/* Vendors Table */}
          <div className="rounded-3xl border border-slate-100 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900">Vendor Name</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900">Code</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900">Category</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900">Payment Terms</th>
                  <th className="px-6 py-3 text-center font-semibold text-slate-900">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vendors.length > 0 ? (
                  vendors.map((vendor) => (
                    <tr key={vendor.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium">{vendor.name}</td>
                      <td className="px-6 py-4 text-slate-500">{vendor.code}</td>
                      <td className="px-6 py-4">{vendor.category}</td>
                      <td className="px-6 py-4">{vendor.paymentTerms}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          vendor.status === "active"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-slate-50 text-slate-600"
                        }`}>
                          {vendor.status.charAt(0).toUpperCase() + vendor.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      No vendors found. Click "Add Vendor" to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Purchase Orders View */}
      {currentView === "purchase-orders" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Purchase Requisitions</p>
              <h2 className="text-xl font-semibold text-slate-900">Active Orders</h2>
            </div>
            <button
              onClick={onCreatePO}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800"
            >
              <FileText className="h-4 w-4" />
              Create PO
            </button>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-600 font-medium">No purchase orders yet</p>
            <p className="text-sm text-slate-500 mt-1">POs will appear here as you create them</p>
            <button
              onClick={onCreatePO}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <FileText className="h-4 w-4" />
              Create Order
            </button>
          </div>
        </div>
      )}

      {/* Invoices View */}
      {currentView === "invoices" && (
        <div className="space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Vendor Invoices</p>
            <h2 className="text-xl font-semibold text-slate-900">Received Bills</h2>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center">
            <Receipt className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-600 font-medium">No invoices recorded</p>
            <p className="text-sm text-slate-500 mt-1">Vendor invoices will display after PO receipt and invoicing</p>
          </div>
        </div>
      )}

      {/* Approvals View */}
      {currentView === "approvals" && (
        <div className="space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Approval Queue</p>
            <h2 className="text-xl font-semibold text-slate-900">Pending Approvals</h2>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-600 font-medium">All current approvals are complete</p>
            <p className="text-sm text-slate-500 mt-1">Items awaiting approval will appear here</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CrmDashboard({
  snapshot,
  loading,
  error,
  onRetry,
  onAddContact,
  onRegisterOpportunity,
  onLogEngagement,
  onAddCustomer,
  onImportContacts,
  onExportContacts,
  contactSample,
  onSampleChange,
  onSampleSubmit,
  onSamplePrefill,
  importingContacts,
  currentView,
  onViewChange,
  contacts,
  contactsLoading,
  contactsError,
  onContactsRetry,
  tagOptions,
  activeTagFilter,
  onTagFilterChange,
  onTagToggle,
}: {
  snapshot: CrmSnapshot;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onAddContact: () => void;
  onRegisterOpportunity: () => void;
  onLogEngagement: () => void;
  onAddCustomer: () => void;
  onImportContacts: () => void;
  onExportContacts: () => void;
  contactSample: CrmContactImportSampleState;
  onSampleChange: (field: keyof CrmContactImportSampleState, value: string) => void;
  onSampleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSamplePrefill: () => void;
  importingContacts: boolean;
  currentView: CrmView;
  onViewChange: (view: CrmView) => void;
  contacts: CrmImportedContact[];
  contactsLoading: boolean;
  contactsError: string | null;
  onContactsRetry: () => void;
  tagOptions: readonly string[];
  activeTagFilter: string | null;
  onTagFilterChange: (tag: string | null) => void;
  onTagToggle: (contactId: string, tag: string) => void;
}) {
  const viewSwitcher = (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">CRM workspaces</p>
          <p className="text-sm text-slate-500">Choose which customer motion to focus on</p>
        </div>
        <div className="rounded-full bg-white/70 p-1 shadow-sm">
          {CRM_VIEWS.map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => onViewChange(view)}
              className={`px-4 py-2 text-sm font-semibold capitalize ${
                currentView === view ? "rounded-full bg-slate-900 text-white" : "text-slate-600"
              }`}
            >
              {CRM_VIEW_LABELS[view]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (currentView === "contacts") {
    return (
      <div className="space-y-8">
        {viewSwitcher}
        <CrmContactsView
          contacts={contacts}
          importing={importingContacts}
          loading={contactsLoading}
          error={contactsError}
          onRetry={onContactsRetry}
          onImportContacts={onImportContacts}
          onExportContacts={onExportContacts}
          sample={contactSample}
          onSampleChange={onSampleChange}
          onSampleSubmit={onSampleSubmit}
          onSamplePrefill={onSamplePrefill}
          tagOptions={tagOptions}
          activeTagFilter={activeTagFilter}
          onTagFilterChange={onTagFilterChange}
          onTagToggle={onTagToggle}
        />
      </div>
    );
  }

  if (currentView === "opportunities") {
    return (
      <div className="space-y-8">
        {viewSwitcher}
        <CrmOpportunitiesView leads={snapshot.leads} reminders={snapshot.reminders} />
      </div>
    );
  }

  if (currentView === "customers") {
    return (
      <div className="space-y-8">
        {viewSwitcher}
        <CrmCustomersView
          customers={snapshot.customers}
          reminders={snapshot.reminders}
          onAddCustomer={onAddCustomer}
          onImportContacts={onImportContacts}
          importing={importingContacts}
          onExportContacts={onExportContacts}
        />
      </div>
    );
  }

  if (currentView === "reports") {
    return (
      <div className="space-y-8">
        {viewSwitcher}
        <CrmReportsView snapshot={snapshot} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {viewSwitcher}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Quick actions</p>
          <p className="text-sm text-slate-500">Capture CRM updates without leaving the dashboard</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAddContact}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:border-slate-300"
          >
            <Users className="h-4 w-4" />
            Add contact
          </button>
          <button
            type="button"
            onClick={onRegisterOpportunity}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:border-slate-300"
          >
            <Handshake className="h-4 w-4" />
            Register opportunity
          </button>
          <button
            type="button"
            onClick={onLogEngagement}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:border-slate-300"
          >
            <PhoneCall className="h-4 w-4" />
            Log engagement
          </button>
          <button
            type="button"
            onClick={onImportContacts}
            disabled={importingContacts}
            className="inline-flex items-center gap-2 rounded-full border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Users2 className="h-4 w-4" />
            {importingContacts ? "Importing…" : "Import contacts"}
          </button>
        </div>
      </div>

      {(loading || error) && (
        <div className="space-y-3">
          {loading && (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              Syncing CRM snapshot…
            </div>
          )}
          {error && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <span>{error}</span>
              <button
                type="button"
                onClick={onRetry}
                className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 hover:border-rose-300"
              >
                Retry sync
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <CrmChartCard title="Sales funnel" subtitle="Stage distribution">
          <div className="space-y-3">
            {snapshot.charts.funnel.map((stage) => (
              <div key={stage.stage} className="space-y-1">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
                  <span>{stage.stage}</span>
                  <span>{stage.value}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.min(stage.value, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CrmChartCard>

        <div className="space-y-4">
          <CrmChartCard title="Revenue by officer" subtitle="Top performers">
            <div className="space-y-3">
              {snapshot.charts.revenueByOfficer.map((row) => (
                <div key={row.officer} className="flex items-center justify-between text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">{row.officer}</span>
                  <span>{formatCurrency(row.value)}</span>
                </div>
              ))}
            </div>
          </CrmChartCard>

          <CrmChartCard title="Lost reasons" subtitle="Last 30 days">
            <div className="space-y-2">
              {snapshot.charts.lostReasons.map((reason) => (
                <div key={reason.reason} className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
                  <span>{reason.reason}</span>
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[0.65rem] text-white">{reason.count}</span>
                </div>
              ))}
            </div>
          </CrmChartCard>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {snapshot.metrics.map((metric) => (
          <div key={metric.label} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{metric.label}</p>
            <div className="mt-2 flex items-end justify-between">
              <p className="text-2xl font-semibold text-slate-900">{metric.value}</p>
              <span
                className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                  metric.trend === "up" ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {metric.delta}
                {metric.trend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              </span>
            </div>
            <p className="text-xs text-slate-500">{metric.description}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Pipeline</p>
              <h2 className="text-xl font-semibold text-slate-900">Leads in motion</h2>
            </div>
            <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">
              <ArrowUpRight className="h-4 w-4" /> Export leads
            </button>
          </div>
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100">
            <div className="grid grid-cols-[0.9fr_1fr_1fr_0.8fr_0.8fr_0.8fr] bg-slate-50/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              <span>ID</span>
              <span>Company</span>
              <span>Contact</span>
              <span>Stage</span>
              <span>Owner</span>
              <span>Status</span>
            </div>
            <div>
              {snapshot.leads.map((lead, index) => (
                <div
                  key={lead.id}
                  className={`grid grid-cols-[0.9fr_1fr_1fr_0.8fr_0.8fr_0.8fr] items-center px-4 py-3 text-sm text-slate-700 ${
                    index !== snapshot.leads.length - 1 ? "border-b border-slate-100" : ""
                  }`}
                >
                  <p className="font-semibold text-slate-900">{lead.id}</p>
                  <p>{lead.company}</p>
                  <p className="text-slate-500">{lead.contact}</p>
                  <p>{lead.stage}</p>
                  <p>{lead.owner}</p>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${CRM_STATUS_META[lead.status].dot}`} aria-hidden />
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${CRM_STATUS_META[lead.status].chip}`}>
                      {CRM_STATUS_META[lead.status].label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <CrmReminderList reminders={snapshot.reminders} />
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Action queue</p>
                <h2 className="text-xl font-semibold text-slate-900">Rep follow-ups</h2>
              </div>
              <button className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">View all</button>
            </div>
            <div className="mt-4 space-y-3">
              {snapshot.tasks.map((task) => (
                <div key={task.id} className="rounded-2xl border border-slate-100 px-4 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-semibold text-slate-900">{task.title}</p>
                      <p className="text-xs text-slate-500">{task.assignee}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        task.status === "due" ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {task.due}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Engagements</p>
                <h2 className="text-xl font-semibold text-slate-900">Latest touches</h2>
              </div>
              <button className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">See log</button>
            </div>
            <div className="mt-4 space-y-3">
              {snapshot.engagements.map((engagement) => (
                <div key={engagement.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 px-4 py-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-2xl ${
                      engagement.channel === "call"
                        ? "bg-sky-50 text-sky-600"
                        : engagement.channel === "email"
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-amber-50 text-amber-600"
                    }`}
                  >
                    {engagement.channel === "call" && <PhoneCall className="h-4 w-4" />}
                    {engagement.channel === "email" && <Mail className="h-4 w-4" />}
                    {engagement.channel === "meeting" && <Users className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{engagement.title}</p>
                    <p className="text-sm text-slate-500">{engagement.detail}</p>
                    <p className="text-xs text-slate-400">{engagement.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FinanceWorkspace({
  snapshot,
  loading,
  error,
  onRetry,
  cashAccounts,
  cashAccountsLoading,
  cashAccountsError,
  onRefreshAccounts,
  onLogInvoice,
  onSyncToERP,
  onSchedulePayment,
  onRouteApproval,
  onRecordExpense,
  onAttachMemo,
  onTriggerPayout,
  onTreasuryMesh,
  currentView,
  onViewChange,
  invoices,
  invoiceStatusFilter,
  invoiceBranchFilter,
  invoiceSearchQuery,
  onInvoiceStatusFilterChange,
  onInvoiceBranchFilterChange,
  onInvoiceSearchChange,
  showInvoiceDrawer,
  onShowInvoiceDrawer,
  selectedInvoiceId,
  onSelectInvoice,
  invoiceFormTab,
  onInvoiceFormTabChange,
  onSaveInvoice,
  crmContacts,
  savedLineItems,
  onSaveLineItem,
}: {
  snapshot: FinanceSnapshot;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  cashAccounts: FinanceCashAccount[];
  cashAccountsLoading: boolean;
  cashAccountsError: string | null;
  onRefreshAccounts: () => void;
  onLogInvoice: () => void;
  onSyncToERP: () => void;
  onSchedulePayment: () => void;
  onRouteApproval: () => void;
  onRecordExpense: () => void;
  onAttachMemo: () => void;
  onTriggerPayout: () => void;
  onTreasuryMesh: () => void;
  currentView: FinanceView;
  onViewChange: (view: FinanceView) => void;
  invoices: InvoiceItem[];
  invoiceStatusFilter: InvoiceStatus | "all";
  invoiceBranchFilter: string;
  invoiceSearchQuery: string;
  onInvoiceStatusFilterChange: (status: InvoiceStatus | "all") => void;
  onInvoiceBranchFilterChange: (branch: string) => void;
  onInvoiceSearchChange: (query: string) => void;
  showInvoiceDrawer: boolean;
  onShowInvoiceDrawer: (show: boolean) => void;
  selectedInvoiceId: string | null;
  onSelectInvoice: (id: string | null) => void;
  invoiceFormTab: InvoiceFormTab;
  onInvoiceFormTabChange: (tab: InvoiceFormTab) => void;
  onSaveInvoice: (invoiceData: {
    customer: string;
    customerEmail?: string;
    contactId?: string;
    amount: string;
    issueDate: string;
    dueDate: string;
    branch: string;
    status: InvoiceStatus;
    items: Array<{ description: string; quantity: number; unitPrice: number }>;
  }) => void;
  crmContacts: CrmContact[];
  savedLineItems: SavedLineItem[];
  onSaveLineItem: (description: string, defaultPrice: number, category?: string) => void;
}) {
  const quickActions: Array<{ label: string; description: string; icon: ComponentType<{ className?: string }>; action: () => void; secondaryAction?: () => void }> = [
    { label: "Log invoice", description: "Sync to ERP", icon: Receipt, action: onLogInvoice, secondaryAction: onSyncToERP },
    { label: "Schedule payment", description: "Route approval", icon: CalendarClock, action: onSchedulePayment, secondaryAction: onRouteApproval },
    { label: "Record expense", description: "Attach memo", icon: FileSpreadsheet, action: onRecordExpense, secondaryAction: onAttachMemo },
    { label: "Trigger payout", description: "Treasury mesh", icon: PiggyBank, action: onTriggerPayout, secondaryAction: onTreasuryMesh },
  ];

  return (
    <div className="space-y-8">
      {/* Finance Workspace Switcher */}
      <div className="rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="flex gap-1 border-b border-slate-100 p-2">
          {FINANCE_VIEWS.map((view) => (
            <button
              key={view}
              onClick={() => onViewChange(view)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition-colors ${
                currentView === view
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
              type="button"
            >
              {FINANCE_VIEW_LABELS[view]}
            </button>
          ))}
        </div>
      </div>

      {currentView === "overview" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Finance quick actions</p>
              <p className="text-sm text-slate-500">Capture ledger updates without leaving command view</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={() => {
                      action.action();
                      action.secondaryAction?.();
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:border-slate-300"
                    type="button"
                  >"
                <Icon className="h-4 w-4" />
                <div className="text-left">
                  <p className="font-semibold leading-none">{action.label}</p>
                  <p className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-400">{action.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {(loading || error) && (
        <div className="space-y-2">
          {loading && (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              Syncing finance snapshot…
            </div>
          )}
          {error && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <span>{error}</span>
              <button
                type="button"
                onClick={onRetry}
                className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 hover:border-rose-300"
              >
                Retry sync
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <FinanceScheduleCard 
          title="Receivables radar" 
          items={snapshot.receivables.slice(0, 3)} 
          totalCount={snapshot.receivables.length}
          accent="text-emerald-600"
          onViewAll={() => onViewChange("invoices")}
        />
        <FinanceScheduleCard 
          title="Payables runway" 
          items={snapshot.payables.slice(0, 3)}
          totalCount={snapshot.payables.length}
          accent="text-amber-600"
          onViewAll={() => onViewChange("payments")}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
        <FinanceTrendCard trend={snapshot.trend} />
        <div className="space-y-6">
          <FinanceCashAccounts
            accounts={cashAccounts}
            loading={cashAccountsLoading}
            error={cashAccountsError}
            onRefresh={onRefreshAccounts}
          />
          <FinanceExpenseBreakdownCard expenses={snapshot.expenseBreakdown} />
        </div>
      </div>
        </>
      ) : currentView === "invoices" ? (
        <FinanceInvoicesWorkspace 
          invoices={invoices}
          statusFilter={invoiceStatusFilter}
          branchFilter={invoiceBranchFilter}
          searchQuery={invoiceSearchQuery}
          onStatusFilterChange={onInvoiceStatusFilterChange}
          onBranchFilterChange={onInvoiceBranchFilterChange}
          onSearchChange={onInvoiceSearchChange}
          onCreateInvoice={() => {
            onSelectInvoice(null);
            onShowInvoiceDrawer(true);
            onInvoiceFormTabChange("details");
          }}
          onEditInvoice={(id) => {
            onSelectInvoice(id);
            onShowInvoiceDrawer(true);
            onInvoiceFormTabChange("details");
          }}
        />
      ) : currentView === "payments" ? (
        <FinancePaymentsWorkspace />
      ) : currentView === "expenses" ? (
        <FinanceExpensesWorkspace />
      ) : currentView === "accounting" ? (
        <FinanceAccountingWorkspace />
      ) : currentView === "reports" ? (
        <FinanceReportsWorkspace />
      ) : null}

      {/* Invoice Drawer */}
      {showInvoiceDrawer && (
        <InvoiceDrawer
          invoiceId={selectedInvoiceId}
          invoice={selectedInvoiceId ? invoices.find((inv) => inv.id === selectedInvoiceId) : null}
          currentTab={invoiceFormTab}
          onTabChange={onInvoiceFormTabChange}
          onClose={() => {
            onShowInvoiceDrawer(false);
            onSelectInvoice(null);
          }}
          onSaveInvoice={onSaveInvoice}
          crmContacts={crmContacts}
          savedLineItems={savedLineItems}
          onSaveLineItem={onSaveLineItem}
        />
      )}
    </div>
  );
}

function FinanceInvoicesWorkspace({
  invoices,
  statusFilter,
  branchFilter,
  searchQuery,
  onStatusFilterChange,
  onBranchFilterChange,
  onSearchChange,
  onCreateInvoice,
  onEditInvoice,
}: {
  invoices: InvoiceItem[];
  statusFilter: InvoiceStatus | "all";
  branchFilter: string;
  searchQuery: string;
  onStatusFilterChange: (status: InvoiceStatus | "all") => void;
  onBranchFilterChange: (branch: string) => void;
  onSearchChange: (query: string) => void;
  onCreateInvoice: () => void;
  onEditInvoice: (id: string) => void;
}) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const handlePrintInvoice = (invoice: InvoiceItem) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const subtotal = invoice.items?.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) || 0;
    const taxRate = invoice.taxRate ?? 7.5;
    const discount = invoice.discount ?? 0;
    const taxAmount = subtotal * (taxRate / 100);
    const discountAmount = subtotal * (discount / 100);
    const total = subtotal + taxAmount - discountAmount;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoice.invoiceNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
            .header { border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
            .invoice-title { font-size: 28px; font-weight: bold; }
            .invoice-number { font-size: 16px; color: #666; margin-top: 5px; }
            .section { margin: 20px 0; }
            .section-title { font-size: 14px; font-weight: bold; margin-bottom: 10px; text-transform: uppercase; color: #666; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { background: #f5f5f5; padding: 12px; text-align: left; font-weight: bold; border-bottom: 2px solid #ddd; }
            td { padding: 10px 12px; border-bottom: 1px solid #eee; }
            .total-row { font-weight: bold; font-size: 16px; }
            .text-right { text-align: right; }
            .summary { float: right; width: 300px; margin-top: 30px; }
            .summary-row { display: flex; justify-content: space-between; padding: 8px 0; }
            .summary-total { border-top: 2px solid #000; margin-top: 10px; padding-top: 10px; font-weight: bold; font-size: 18px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="invoice-title">INVOICE</div>
            <div class="invoice-number">${invoice.invoiceNumber}</div>
          </div>
          
          <div class="section">
            <div class="section-title">Bill To</div>
            <div><strong>${invoice.customer}</strong></div>
            ${invoice.customerEmail ? `<div>${invoice.customerEmail}</div>` : ''}
            ${invoice.contactType ? `<div style="margin-top: 5px; color: #666; font-size: 12px;">${invoice.contactType === 'business' ? '🏢 Business' : '👤 Individual'}</div>` : ''}
          </div>
          
          <div class="section">
            <div style="display: flex; justify-content: space-between;">
              <div>
                <div class="section-title">Issue Date</div>
                <div>${invoice.issueDate}</div>
              </div>
              <div>
                <div class="section-title">Due Date</div>
                <div>${invoice.dueDate}</div>
              </div>
              <div>
                <div class="section-title">Branch</div>
                <div>${invoice.branch}</div>
              </div>
              <div>
                <div class="section-title">Status</div>
                <div>${INVOICE_STATUS_META[invoice.status].label}</div>
              </div>
            </div>
          </div>
          
          ${invoice.items && invoice.items.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th class="text-right">Quantity</th>
                <th class="text-right">Unit Price</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items.map(item => `
                <tr>
                  <td>${item.description}</td>
                  <td class="text-right">${item.quantity}</td>
                  <td class="text-right">₦${item.unitPrice.toLocaleString()}</td>
                  <td class="text-right">₦${(item.quantity * item.unitPrice).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="summary">
            <div class="summary-row">
              <span>Subtotal:</span>
              <span>₦${subtotal.toLocaleString()}</span>
            </div>
            <div class="summary-row">
              <span>Tax (${taxRate}%):</span>
              <span>₦${taxAmount.toLocaleString()}</span>
            </div>
            ${discount > 0 ? `
            <div class="summary-row">
              <span>Discount (${discount}%):</span>
              <span>-₦${discountAmount.toLocaleString()}</span>
            </div>
            ` : ''}
            <div class="summary-row summary-total">
              <span>Total:</span>
              <span>₦${total.toLocaleString()}</span>
            </div>
          </div>
          ` : ''}
          
          ${invoice.notes ? `
          <div class="section" style="clear: both; margin-top: 60px;">
            <div class="section-title">Notes</div>
            <div>${invoice.notes}</div>
          </div>
          ` : ''}
        </body>
      </html>
    `;
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
    setOpenMenuId(null);
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    const matchesBranch = branchFilter === "all" || invoice.branch === branchFilter;
    const matchesSearch =
      searchQuery === "" ||
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.customer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesBranch && matchesSearch;
  });

  const branches = Array.from(new Set(invoices.map((inv) => inv.branch)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Revenue operations</p>
          <h2 className="text-2xl font-semibold text-slate-900">Invoices</h2>
        </div>
        <button
          onClick={onCreateInvoice}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          type="button"
        >
          <Receipt className="h-4 w-4" />
          New Invoice
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search invoices or customers..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as InvoiceStatus | "all")}
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-slate-300 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            {INVOICE_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {INVOICE_STATUS_META[status].label}
              </option>
            ))}
          </select>
          <select
            value={branchFilter}
            onChange={(e) => onBranchFilterChange(e.target.value)}
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-slate-300 focus:outline-none"
          >
            <option value="all">All Branches</option>
            {branches.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Invoice #
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Customer
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Amount
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Issue Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Due Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="space-y-2">
                      <Receipt className="mx-auto h-10 w-10 text-slate-300" />
                      <p className="text-sm font-semibold text-slate-900">No invoices found</p>
                      <p className="text-xs text-slate-500">Try adjusting your filters or create a new invoice</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice, index) => {
                  const statusMeta = INVOICE_STATUS_META[invoice.status];
                  return (
                    <tr
                      key={invoice.id}
                      className={`${index !== filteredInvoices.length - 1 ? "border-b border-slate-100" : ""} hover:bg-slate-50/50`}
                    >
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900">{invoice.invoiceNumber}</p>
                        <p className="text-xs text-slate-500">{invoice.branch}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">{invoice.customer}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">{invoice.amount}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.chip}`}>
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{invoice.issueDate}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{invoice.dueDate}</td>
                      <td className="px-6 py-4 relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === invoice.id ? null : invoice.id)}
                          className="rounded-full p-2 hover:bg-slate-100"
                          type="button"
                        >
                          <svg className="h-5 w-5 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                            <circle cx="10" cy="4" r="1.5" />
                            <circle cx="10" cy="10" r="1.5" />
                            <circle cx="10" cy="16" r="1.5" />
                          </svg>
                        </button>
                        {openMenuId === invoice.id && (
                          <>
                            <div 
                              className="fixed inset-0 z-10" 
                              onClick={() => setOpenMenuId(null)}
                            />
                            <div className="absolute right-0 top-12 z-20 w-48 rounded-xl border border-slate-200 bg-white shadow-lg">
                              <button
                                onClick={() => {
                                  onEditInvoice(invoice.id);
                                  setOpenMenuId(null);
                                }}
                                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 rounded-t-xl"
                                type="button"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit Invoice
                              </button>
                              <button
                                onClick={() => handlePrintInvoice(invoice)}
                                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 rounded-b-xl"
                                type="button"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                                Print Invoice
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredInvoices.length > 0 && (
          <div className="border-t border-slate-100 px-6 py-4">
            <p className="text-sm text-slate-600">
              Showing {filteredInvoices.length} of {invoices.length} invoices
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function FinancePaymentsWorkspace() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [methodFilter, setMethodFilter] = useState<string | null>(null);
  const [gatewayFilter, setGatewayFilter] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [recordForm, setRecordForm] = useState({
    method: "bank_transfer" as const,
    grossAmount: "",
    fees: "",
    paymentDate: new Date().toISOString().split('T')[0],
    reference: "",
    gatewayReference: "",
    confirmationDetails: "",
  });

  // Load payments from API
  useEffect(() => {
    const fetchPayments = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/finance/vendor-payments?tenantSlug=kreatix-default");
        if (!response.ok) throw new Error("Failed to fetch payments");
        const data = await response.json();
        const paymentsList = data.data || data.payments || [];
        if (Array.isArray(paymentsList)) {
          setPayments(paymentsList);
        }
      } catch (err) {
        console.error("Failed to load payments:", err);
        setError("Failed to load payments");
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, []);

  // Filter payments
  const filteredPayments = payments.filter((payment) => {
    const matchesSearch = (payment.reference || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter ? payment.status === statusFilter : true;
    const matchesMethod = methodFilter ? payment.method === methodFilter : true;
    const matchesGateway = gatewayFilter ? payment.gateway === gatewayFilter : true;
    return matchesSearch && matchesStatus && matchesMethod && matchesGateway;
  });

  // Calculate metrics
  const metrics = {
    totalReceived: payments
      .filter(p => p.status === "successful" || p.status === "settled")
      .reduce((sum, p) => sum + p.netAmount, 0),
    pendingAmount: payments
      .filter(p => p.status === "pending")
      .reduce((sum, p) => sum + p.grossAmount, 0),
    failedAmount: payments
      .filter(p => p.status === "failed")
      .reduce((sum, p) => sum + p.grossAmount, 0),
    totalFees: payments.reduce((sum, p) => sum + p.fees, 0),
    successRate: payments.length > 0 
      ? ((payments.filter(p => p.status === "successful" || p.status === "settled").length / payments.length) * 100).toFixed(1)
      : "0",
  };

  const handleOpenRecord = (payment?: PaymentRecord) => {
    if (payment) {
      setSelectedPayment(payment);
      setRecordForm({
        method: "bank_transfer",
        grossAmount: payment.grossAmount.toString(),
        fees: payment.fees.toString(),
        paymentDate: payment.paymentDate,
        reference: payment.reference,
        gatewayReference: payment.gatewayReference || "",
        confirmationDetails: "",
      });
    }
    setShowRecordModal(true);
  };

  const handleSaveRecord = async () => {
    if (!recordForm.reference || !recordForm.confirmationDetails || !recordForm.grossAmount) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      const fees = parseFloat(recordForm.fees) || 0;
      const grossAmount = parseFloat(recordForm.grossAmount);
      const netAmount = grossAmount - fees;

      // Call the API to save payment
      const response = await fetch("/api/finance/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: tenantSlug || "kreatix-default",
          customerId: `CUST-${Math.random().toString(36).substr(2, 9)}`,
          invoiceId: selectedPayment?.invoiceId,
          reference: recordForm.reference,
          grossAmount,
          fees,
          method: recordForm.method,
          gatewayReference: recordForm.gatewayReference,
          paymentDate: recordForm.paymentDate,
          confirmationDetails: recordForm.confirmationDetails,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.toString() || error.details || "Failed to save payment");
      }

      const result = await response.json();

      // Update local state after successful API call
      const newPayment: PaymentRecord = {
        id: result.payment?.id || `PAY-${Date.now()}`,
        payableId: `PYB-${Math.random().toString(36).substr(2, 4)}`,
        customerId: `CUST-${Math.random().toString(36).substr(2, 9)}`,
        invoiceId: selectedPayment?.invoiceId || `INV-${Math.random().toString(36).substr(2, 9)}`,
        reference: recordForm.reference,
        grossAmount: grossAmount.toLocaleString(),
        fees: fees.toLocaleString(),
        netAmount: netAmount.toLocaleString(),
        method: recordForm.method,
        gateway: recordForm.method === "paystack" ? "paystack" : 
                 recordForm.method === "flutterwave" ? "flutterwave" :
                 recordForm.method === "stripe" ? "stripe" : "manual",
        gatewayReference: recordForm.gatewayReference,
        paymentDate: recordForm.paymentDate,
        settlementDate: recordForm.paymentDate,
        status: "successful",
        linkedInvoices: selectedPayment?.linkedInvoices || [],
        auditTrail: [
          {
            action: "created",
            timestamp: new Date().toISOString(),
            user: "Current User",
          },
        ],
        confirmationDetails: recordForm.confirmationDetails,
        referenceNumber: recordForm.reference,
        currency: "NGN",
        recordedBy: "Current User",
        recordedDate: new Date().toISOString().split('T')[0],
      };

      setPayments([...payments, newPayment]);
      setShowRecordModal(false);
      setSelectedPayment(null);
      setOpenMenuId(null);
      setRecordForm({
        method: "bank_transfer",
        grossAmount: "",
        fees: "",
        paymentDate: new Date().toISOString().split('T')[0],
        reference: "",
        gatewayReference: "",
        confirmationDetails: "",
      });
    } catch (error) {
      console.error("Error saving payment:", error);
      alert(`Failed to save payment: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "successful":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "settled":
        return "bg-green-50 text-green-700 border-green-200";
      case "failed":
        return "bg-red-50 text-red-700 border-red-200";
      case "reversed":
        return "bg-slate-50 text-slate-700 border-slate-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getGatewayLabel = (gateway: string) => {
    switch (gateway) {
      case "paystack":
        return "Paystack";
      case "flutterwave":
        return "Flutterwave";
      case "stripe":
        return "Stripe";
      case "manual":
        return "Manual";
      default:
        return gateway;
    }
  };

  const getMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      bank_transfer: "Bank Transfer",
      check: "Check",
      cash: "Cash",
      pos: "POS",
      mobile_money: "Mobile Money",
      wire: "Wire Transfer",
      paystack: "Paystack",
      flutterwave: "Flutterwave",
      stripe: "Stripe",
    };
    return labels[method] || method;
  };

  const formatCurrency = (amount: number) => {
    return `₦${(amount / 1000000).toFixed(2)}M`;
  };

  return (
    <div className="space-y-6">
      {/* Dashboard Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Total Received</p>
          <p className="text-2xl font-semibold text-slate-900 mt-2">{formatCurrency(metrics.totalReceived)}</p>
          <p className="text-xs text-slate-500 mt-1">From {payments.filter(p => p.status === "successful" || p.status === "settled").length} payments</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Pending Amount</p>
          <p className="text-2xl font-semibold text-yellow-600 mt-2">{formatCurrency(metrics.pendingAmount)}</p>
          <p className="text-xs text-slate-500 mt-1">Awaiting settlement</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Fees Charged</p>
          <p className="text-2xl font-semibold text-slate-900 mt-2">{formatCurrency(metrics.totalFees)}</p>
          <p className="text-xs text-slate-500 mt-1">Processing fees</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Success Rate</p>
          <p className="text-2xl font-semibold text-green-600 mt-2">{metrics.successRate}%</p>
          <p className="text-xs text-slate-500 mt-1">Of all payments</p>
        </div>
      </div>

      {/* Payments Table */}
      <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Payment Records</h3>
          <button
            onClick={() => handleOpenRecord()}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            + Record Payment
          </button>
        </div>

        {loading && <p className="text-slate-600 py-8 text-center">Loading payments...</p>}
        {error && <p className="text-rose-600 py-8 text-center">{error}</p>}
        
        {!loading && filteredPayments.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500 text-sm">No payments recorded yet</p>
            <p className="text-xs text-slate-400 mt-1">Payments will appear here once recorded</p>
          </div>
        )}

        {filteredPayments.length > 0 && (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-slate-700">Reference</th>
                <th className="text-right py-3 px-4 font-medium text-slate-700">Gross Amount</th>
                <th className="text-right py-3 px-4 font-medium text-slate-700">Fees</th>
                <th className="text-right py-3 px-4 font-medium text-slate-700">Net Amount</th>
                <th className="text-left py-3 px-4 font-medium text-slate-700">Method</th>
                <th className="text-left py-3 px-4 font-medium text-slate-700">Status</th>
                <th className="text-left py-3 px-4 font-medium text-slate-700">Date</th>
                <th className="text-center py-3 px-4 font-medium text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 text-slate-900 font-medium">{payment.reference}</td>
                  <td className="py-3 px-4 text-right text-slate-900">₦{typeof payment.grossAmount === 'string' ? payment.grossAmount : payment.grossAmount.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-slate-600">₦{typeof payment.fees === 'string' ? payment.fees : payment.fees.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-slate-900 font-medium">₦{typeof payment.netAmount === 'string' ? payment.netAmount : payment.netAmount.toLocaleString()}</td>
                  <td className="py-3 px-4 text-slate-600">{getMethodLabel(payment.method)}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium border ${getStatusColor(payment.status)}`}>
                      {getStatusLabel(payment.status)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 text-xs">{payment.paymentDate}</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => setSelectedPayment(payment)}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Record Payment Modal */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Record Payment</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reference</label>
                <input
                  type="text"
                  value={recordForm.reference}
                  onChange={(e) => setRecordForm({ ...recordForm, reference: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  placeholder="e.g., TRF-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Method</label>
                <select
                  value={recordForm.method}
                  onChange={(e) => setRecordForm({ ...recordForm, method: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="corporate_card">Corporate Card</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Gross Amount</label>
                <input
                  type="number"
                  value={recordForm.grossAmount}
                  onChange={(e) => setRecordForm({ ...recordForm, grossAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fees</label>
                <input
                  type="number"
                  value={recordForm.fees}
                  onChange={(e) => setRecordForm({ ...recordForm, fees: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={recordForm.paymentDate}
                  onChange={(e) => setRecordForm({ ...recordForm, paymentDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirmation Details</label>
                <textarea
                  value={recordForm.confirmationDetails}
                  onChange={(e) => setRecordForm({ ...recordForm, confirmationDetails: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  placeholder="Receipt #, notes, etc."
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRecordModal(false)}
                className="flex-1 px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRecord}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FinanceExpensesWorkspace() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({
    code: '',
    name: '',
    accountId: '',
  });
  const [recordForm, setRecordForm] = useState({
    type: 'reimbursement',
    amount: '',
    taxType: 'NONE',
    category: 'Meals & Entertainment',
    categoryId: 'cat_meals',
    description: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch categories first
        const categoriesResponse = await fetch("/api/finance/expense-categories?tenantSlug=kreatix-default").catch(err => {
          console.error("Fetch categories error:", err);
          return null;
        });
        
        if (categoriesResponse?.ok) {
          const catData = await categoriesResponse.json();
          setCategories(Array.isArray(catData.categories) ? catData.categories : catData.data || []);
        }
        
        // Fetch expenses
        const response = await fetch("/api/finance/expenses?tenantSlug=kreatix-default").catch(err => {
          console.error("Fetch error:", err);
          throw err;
        });
        if (response.ok) {
          const data = await response.json();
          setExpenses(Array.isArray(data.expenses) ? data.expenses : data.data || []);
        } else {
          const errData = await response.json().catch(() => ({}));
          console.error("API error:", errData);
          setError(`Error loading expenses: ${response.status}`);
          setExpenses([]);
        }
      } catch (err) {
        console.error("Failed to load expenses:", err);
        setError("Failed to load expenses");
        setExpenses([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleOpenRecord = () => {
    setRecordForm({
      type: 'reimbursement',
      amount: '',
      taxType: 'NONE',
      category: 'Meals & Entertainment',
      categoryId: 'cat_meals',
      description: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setShowRecordModal(true);
  };

  const handleSaveRecord = async () => {
    if (!recordForm.description || !recordForm.amount) {
      alert('Please fill in description and amount');
      return;
    }

    console.log('Submitting expense with category:', recordForm.categoryId, recordForm.category);

    try {
      const response = await fetch('/api/finance/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: 'kreatix-default',
          type: recordForm.type,
          amount: parseFloat(recordForm.amount),
          taxType: recordForm.taxType,
          category: recordForm.category,
          categoryId: recordForm.categoryId,
          description: recordForm.description,
          date: recordForm.date,
          notes: recordForm.notes,
          createdBy: 'kreatix-default-user',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const newExpense = data.expense || data;
        setExpenses([newExpense, ...expenses]);
        setShowRecordModal(false);
        setRecordForm({
          type: 'reimbursement',
          amount: '',
          taxType: 'NONE',
          category: 'Meals & Entertainment',
          categoryId: 'cat_meals',
          description: '',
          date: new Date().toISOString().split('T')[0],
          notes: '',
        });
      } else {
        const errData = await response.json().catch(() => ({}));
        console.error('API error:', errData);
        alert('Failed to record expense: ' + JSON.stringify(errData));
      }
    } catch (err) {
      console.error('Error recording expense:', err);
      alert('Error recording expense: ' + String(err));
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategory.code || !newCategory.name || !newCategory.accountId) {
      alert('Please fill in all category fields');
      return;
    }

    try {
      const response = await fetch('/api/finance/expense-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCategory.code.toUpperCase(),
          name: newCategory.name,
          accountId: newCategory.accountId,
          requiresVendor: true,
          requiresReceipt: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const createdCategory = data.category;
        
        // Add to categories list
        setCategories([...categories, createdCategory]);
        
        // Select the newly created category
        setRecordForm({
          ...recordForm,
          categoryId: createdCategory.id,
          category: createdCategory.name,
        });
        
        // Reset and close category form
        setNewCategory({ code: '', name: '', accountId: '' });
        setShowCreateCategory(false);
      } else {
        const errData = await response.json().catch(() => ({}));
        alert('Failed to create category: ' + JSON.stringify(errData));
      }
    } catch (err) {
      console.error('Error creating category:', err);
      alert('Error creating category: ' + String(err));
    }
  };

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Expenses</h2>
          <p className="text-sm text-slate-500 mt-1">Track and manage expense records</p>
        </div>
        <button
          onClick={handleOpenRecord}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          Record Expense
        </button>
      </div>

      {loading && <p className="text-slate-600 py-8 text-center">Loading expenses...</p>}
      {error && <p className="text-rose-600 py-8 text-center text-sm">{error}</p>}

      {!loading && !error && expenses.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500">No expenses recorded yet</p>
          <p className="text-xs text-slate-400 mt-1">Expense records will appear here once submitted</p>
        </div>
      )}

      {expenses.length > 0 && (
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-slate-700">ID</th>
              <th className="text-left py-3 px-4 font-medium text-slate-700">Description</th>
              <th className="text-right py-3 px-4 font-medium text-slate-700">Amount</th>
              <th className="text-left py-3 px-4 font-medium text-slate-700">Category</th>
              <th className="text-left py-3 px-4 font-medium text-slate-700">Status</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense: any) => (
              <tr key={expense.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3 px-4 text-slate-900 font-medium">{expense.id?.slice(0, 8)}</td>
                <td className="py-3 px-4 text-slate-600">{expense.description || 'N/A'}</td>
                <td className="py-3 px-4 text-right text-slate-900 font-medium">₦{(expense.amount || 0).toLocaleString()}</td>
                <td className="py-3 px-4 text-slate-600">{expense.categoryId || 'Other'}</td>
                <td className="py-3 px-4"><span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-full">{expense.approvalStatus || 'pending'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Record Expense</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={recordForm.description}
                  onChange={(e) => setRecordForm({...recordForm, description: e.target.value})}
                  placeholder="e.g., Office supplies"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                <input
                  type="number"
                  value={recordForm.amount}
                  onChange={(e) => setRecordForm({...recordForm, amount: e.target.value})}
                  placeholder="0.00"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select
                    value={recordForm.type}
                    onChange={(e) => setRecordForm({...recordForm, type: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="reimbursement">Reimbursement</option>
                    <option value="vendor">Vendor</option>
                    <option value="cash">Cash</option>
                    <option value="prepaid">Prepaid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tax Type</label>
                  <select
                    value={recordForm.taxType}
                    onChange={(e) => setRecordForm({...recordForm, taxType: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="NONE">None</option>
                    <option value="VAT">VAT</option>
                    <option value="WHT">WHT</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={recordForm.categoryId}
                    onChange={(e) => {
                      if (e.target.value === '__create_new__') {
                        setShowCreateCategory(true);
                      } else {
                        const selectedCategory = categories.find(cat => cat.id === e.target.value);
                        setRecordForm({
                          ...recordForm, 
                          categoryId: e.target.value, 
                          category: selectedCategory?.name || e.target.value
                        });
                      }
                    }}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.length > 0 ? (
                      <>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                        <option value="__create_new__" className="font-semibold text-blue-600">
                          + Create new category...
                        </option>
                      </>
                    ) : (
                      <>
                        <option value="cat_meals">Meals & Entertainment</option>
                        <option value="cat_travel">Travel</option>
                        <option value="cat_supplies">Office Supplies</option>
                        <option value="cat_insurance">Insurance</option>
                        <option value="cat_professional">Professional Services</option>
                        <option value="__create_new__" className="font-semibold text-blue-600">
                          + Create new category...
                        </option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={recordForm.date}
                    onChange={(e) => setRecordForm({...recordForm, date: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={recordForm.notes}
                  onChange={(e) => setRecordForm({...recordForm, notes: e.target.value})}
                  placeholder="Additional details..."
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRecordModal(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRecord}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
              >
                Save Expense
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateCategory && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Create New Category</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category Name</label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                  placeholder="e.g., Marketing, Equipment, Software"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category Code</label>
                <input
                  type="text"
                  value={newCategory.code}
                  onChange={(e) => setNewCategory({...newCategory, code: e.target.value.toUpperCase()})}
                  placeholder="e.g., MKTG, EQUIP, SOFT"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">GL Account Code</label>
                <input
                  type="text"
                  value={newCategory.accountId}
                  onChange={(e) => setNewCategory({...newCategory, accountId: e.target.value})}
                  placeholder="e.g., 6060, 6070"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateCategory(false);
                  setNewCategory({ code: '', name: '', accountId: '' });
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCategory}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition"
              >
                Create Category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FinanceAccountingWorkspace() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [newAccount, setNewAccount] = useState({
    code: '',
    name: '',
    type: 'asset',
    balance: '',
    description: '',
  });

  const accountTypes = [
    { value: 'asset', label: 'Asset' },
    { value: 'liability', label: 'Liability' },
    { value: 'equity', label: 'Equity' },
    { value: 'revenue', label: 'Revenue' },
    { value: 'expense', label: 'Expense' },
  ];

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/accounting/accounts?tenantSlug=kreatix-default").catch(err => {
          console.error("Fetch error:", err);
          throw err;
        });
        if (response.ok) {
          const data = await response.json();
          setAccounts(Array.isArray(data.accounts) ? data.accounts : data.data || []);
        } else {
          const errData = await response.json().catch(() => ({}));
          console.error("API error:", errData);
          setError(`Error loading accounts: ${response.status}`);
          setAccounts([]);
        }
      } catch (err) {
        console.error("Failed to load accounts:", err);
        setError("Failed to load accounts");
        setAccounts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAccounts();
  }, []);

  const handleAddAccount = async () => {
    if (!newAccount.code || !newAccount.name) {
      alert('Please fill in account code and name');
      return;
    }

    try {
      const response = await fetch('/api/accounting/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: 'kreatix-default',
          code: newAccount.code,
          name: newAccount.name,
          type: newAccount.type,
          balance: parseFloat(newAccount.balance || '0'),
          description: newAccount.description,
          currency: '₦',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const createdAccount = data.account || data;
        setAccounts([createdAccount, ...accounts]);
        setShowAddAccount(false);
        setNewAccount({
          code: '',
          name: '',
          type: 'asset',
          balance: '',
          description: '',
        });
      } else {
        const errData = await response.json().catch(() => ({}));
        console.error('API error:', errData);
        alert('Failed to add account: ' + JSON.stringify(errData));
      }
    } catch (err) {
      console.error('Error adding account:', err);
      alert('Error adding account: ' + String(err));
    }
  };

  const filteredAccounts = accountFilter === 'all' 
    ? accounts 
    : accounts.filter((acc: any) => acc.type?.toLowerCase() === accountFilter);

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Chart of Accounts</h2>
          <p className="text-sm text-slate-500 mt-1">Manage accounting GL structure</p>
        </div>
        <button
          onClick={() => setShowAddAccount(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          Add Account
        </button>
      </div>

      {/* Filter buttons */}
      <div className="mb-6 flex gap-2 flex-wrap">
        <button
          onClick={() => setAccountFilter('all')}
          className={`px-3 py-1 rounded-full text-sm font-medium transition ${
            accountFilter === 'all' 
              ? 'bg-blue-100 text-blue-700' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All
        </button>
        {accountTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => setAccountFilter(type.value)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition ${
              accountFilter === type.value
                ? 'bg-blue-100 text-blue-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-slate-600 py-8 text-center">Loading accounts...</p>}
      {error && <p className="text-rose-600 py-8 text-center text-sm">{error}</p>}

      {!loading && !error && filteredAccounts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500">No accounts found</p>
          <p className="text-xs text-slate-400 mt-1">
            {accountFilter === 'all' 
              ? 'Accounts will appear here once added' 
              : `No ${accountTypes.find(t => t.value === accountFilter)?.label.toLowerCase()} accounts yet`}
          </p>
        </div>
      )}

      {filteredAccounts.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-slate-700">Code</th>
                <th className="text-left py-3 px-4 font-medium text-slate-700">Name</th>
                <th className="text-left py-3 px-4 font-medium text-slate-700">Type</th>
                <th className="text-left py-3 px-4 font-medium text-slate-700">Description</th>
                <th className="text-right py-3 px-4 font-medium text-slate-700">Balance</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((account: any) => (
                <tr key={account.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td className="py-3 px-4 text-slate-900 font-semibold">{account.code || account.id?.slice(0, 8)}</td>
                  <td className="py-3 px-4 text-slate-900">{account.name || 'N/A'}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-full">
                      {account.type ? account.type.charAt(0).toUpperCase() + account.type.slice(1) : 'Asset'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 text-xs">{account.description || '-'}</td>
                  <td className="py-3 px-4 text-right text-slate-900 font-medium">
                    ₦{(account.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Account</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Account Code</label>
                <input
                  type="text"
                  value={newAccount.code}
                  onChange={(e) => setNewAccount({...newAccount, code: e.target.value.toUpperCase()})}
                  placeholder="e.g., 1000, 2100"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Account Name</label>
                <input
                  type="text"
                  value={newAccount.name}
                  onChange={(e) => setNewAccount({...newAccount, name: e.target.value})}
                  placeholder="e.g., Cash, Accounts Payable"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Account Type</label>
                <select
                  value={newAccount.type}
                  onChange={(e) => setNewAccount({...newAccount, type: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {accountTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Opening Balance</label>
                <input
                  type="number"
                  value={newAccount.balance}
                  onChange={(e) => setNewAccount({...newAccount, balance: e.target.value})}
                  placeholder="0.00"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  value={newAccount.description}
                  onChange={(e) => setNewAccount({...newAccount, description: e.target.value})}
                  placeholder="e.g., Operating cash account"
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddAccount(false);
                  setNewAccount({
                    code: '',
                    name: '',
                    type: 'asset',
                    balance: '',
                    description: '',
                  });
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAccount}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
              >
                Add Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FinanceReportsWorkspace() {
  const [reportType, setReportType] = useState<'pl' | 'balance' | 'cashflow' | 'aged'>('pl');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportTypes = [
    { value: 'pl', label: 'Profit & Loss', icon: '📊' },
    { value: 'balance', label: 'Balance Sheet', icon: '⚖️' },
    { value: 'cashflow', label: 'Cash Flow', icon: '💰' },
    { value: 'aged', label: 'Aged Receivables', icon: '📋' },
  ];

  const handleGenerateReport = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        `/api/finance/reports?tenantSlug=kreatix-default&type=${reportType}&startDate=${startDate}&endDate=${endDate}`
      );

      if (response.ok) {
        const data = await response.json();
        setReportData(data.report || data.data || {});
      } else {
        const errData = await response.json().catch(() => ({}));
        console.error('API error:', errData);
        setError(`Error generating report: ${response.status}`);
      }
    } catch (err) {
      console.error('Error generating report:', err);
      setError('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format: 'pdf' | 'excel') => {
    const params = new URLSearchParams({
      tenantSlug: 'kreatix-default',
      type: reportType,
      startDate,
      endDate,
      format,
    });
    window.location.href = `/api/finance/reports/export?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Report Type Selector */}
      <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-slate-900">Financial Reports</h2>
          <p className="text-sm text-slate-500 mt-1">Generate and analyze financial statements</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {reportTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => {
                setReportType(type.value as any);
                setReportData(null);
              }}
              className={`p-4 rounded-lg border-2 transition text-center ${
                reportType === type.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="text-2xl mb-2">{type.icon}</div>
              <div className="text-sm font-semibold text-slate-900">{type.label}</div>
            </button>
          ))}
        </div>

        {/* Date Range Controls */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setReportData(null);
              }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setReportData(null);
              }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleGenerateReport}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
          {reportData && (
            <>
              <button
                onClick={() => handleExport('pdf')}
                className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                📄 PDF
              </button>
              <button
                onClick={() => handleExport('excel')}
                className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                📊 Excel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Report Content */}
      {error && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8">
          <p className="text-rose-600 text-sm">{error}</p>
        </div>
      )}

      {loading && (
        <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
          <p className="text-slate-600 py-8 text-center">Generating report...</p>
        </div>
      )}

      {reportData && !loading && (
        <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-slate-900">
              {reportTypes.find(t => t.value === reportType)?.label}
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {startDate} to {endDate}
            </p>
          </div>

          {/* Summary Metrics */}
          {reportData.metrics && reportData.metrics.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {reportData.metrics.map((metric: any, idx: number) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">{metric.label}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-2">₦{metric.value?.toLocaleString() || '0'}</p>
                  {metric.change !== undefined && (
                    <p className={`text-xs mt-2 ${metric.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {metric.change >= 0 ? '+' : ''}{metric.change}%
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Report Table */}
          {reportData.items && reportData.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-slate-700">Item</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-700">Amount</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-700">% of Total</th>
                    {reportData.items[0]?.priorAmount !== undefined && (
                      <th className="text-right py-3 px-4 font-medium text-slate-700">Prior Period</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {reportData.items.map((item: any, idx: number) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-slate-900">{item.name || item.label}</td>
                      <td className="py-3 px-4 text-right text-slate-900 font-medium">
                        ₦{(item.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600">
                        {item.percentage !== undefined ? `${item.percentage}%` : '-'}
                      </td>
                      {item.priorAmount !== undefined && (
                        <td className="py-3 px-4 text-right text-slate-600">
                          ₦{(item.priorAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-500">No data available for the selected period</p>
            </div>
          )}
        </div>
      )}

      {!reportData && !loading && !error && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <p className="text-slate-600">Select report type and date range, then click "Generate Report"</p>
        </div>
      )}
    </div>
  );
}

function InvoiceDrawer({
  invoiceId,
  invoice,
  currentTab,
  onTabChange,
  onClose,
  onSaveInvoice,
  crmContacts,
  savedLineItems,
  onSaveLineItem,
}: {
  invoiceId: string | null;
  invoice: InvoiceItem | null | undefined;
  currentTab: InvoiceFormTab;
  onTabChange: (tab: InvoiceFormTab) => void;
  onClose: () => void;
  onSaveInvoice: (invoiceData: {
    customer: string;
    customerEmail?: string;
    contactId?: string;
    contactType?: 'individual' | 'business';
    amount: string;
    issueDate: string;
    dueDate: string;
    branch: string;
    status: InvoiceStatus;
    items: InvoiceLineItem[];
    notes?: string;
    taxRate?: number;
    discount?: number;
  }) => void;
  crmContacts: CrmContact[];
  savedLineItems: SavedLineItem[];
  onSaveLineItem: (description: string, defaultPrice: number, category?: string) => void;
}) {
  const [formData, setFormData] = useState({
    customer: invoice?.customer || "",
    customerEmail: invoice?.customerEmail || "",
    contactId: invoice?.contactId || "",
    contactType: invoice?.contactType as 'individual' | 'business' | undefined,
    amount: invoice?.amount || "",
    issueDate: invoice?.issueDate || new Date().toISOString().split("T")[0],
    dueDate: invoice?.dueDate || "",
    branch: invoice?.branch || "Lagos HQ",
    status: invoice?.status || "draft" as InvoiceStatus,
    notes: invoice?.notes || "",
    items: invoice?.items && invoice.items.length > 0 
      ? invoice.items 
      : [{ description: "", quantity: 1, unitPrice: 0 }],
    taxRate: invoice?.taxRate ?? 7.5,
    discount: invoice?.discount ?? 0,
  });
  
  const [customerSearch, setCustomerSearch] = useState("");
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [itemSearch, setItemSearch] = useState<Record<number, string>>({});
  const [showItemDropdown, setShowItemDropdown] = useState<Record<number, boolean>>({});

  const tabs: { id: InvoiceFormTab; label: string }[] = [
    { id: "details", label: "Details" },
    { id: "items", label: "Line Items" },
    { id: "taxes", label: "Taxes & Discount" },
    { id: "preview", label: "Preview" },
  ];

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: "", quantity: 1, unitPrice: 0 }],
    });
  };

  const handleRemoveItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const subtotal = formData.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = subtotal * (formData.taxRate / 100);
  const discountAmount = subtotal * (formData.discount / 100);
  const total = subtotal + taxAmount - discountAmount;

  // Validation functions
  const validateDetails = () => {
    return (
      formData.customer.trim() !== "" &&
      formData.issueDate !== "" &&
      formData.dueDate !== "" &&
      formData.branch !== "" &&
      new Date(formData.dueDate) >= new Date(formData.issueDate)
    );
  };

  const validateItems = () => {
    return (
      formData.items.length > 0 &&
      formData.items.every((item) => item.description.trim() !== "" && item.unitPrice > 0 && item.quantity > 0)
    );
  };

  const canProceedToTab = (tab: InvoiceFormTab): boolean => {
    const tabOrder: InvoiceFormTab[] = ["details", "items", "taxes", "preview"];
    const currentIndex = tabOrder.indexOf(currentTab);
    const targetIndex = tabOrder.indexOf(tab);

    // Can always go back
    if (targetIndex <= currentIndex) return true;

    // Can only proceed if current and all previous tabs are valid
    if (currentTab === "details") return validateDetails();
    if (currentTab === "items") return validateDetails() && validateItems();
    if (currentTab === "taxes") return validateDetails() && validateItems();

    return false;
  };

  const handleNext = () => {
    const tabOrder: InvoiceFormTab[] = ["details", "items", "taxes", "preview"];
    const currentIndex = tabOrder.indexOf(currentTab);
    
    if (currentIndex < tabOrder.length - 1) {
      const nextTab = tabOrder[currentIndex + 1];
      if (canProceedToTab(nextTab)) {
        onTabChange(nextTab);
      }
    }
  };

  const handlePrevious = () => {
    const tabOrder: InvoiceFormTab[] = ["details", "items", "taxes", "preview"];
    const currentIndex = tabOrder.indexOf(currentTab);
    
    if (currentIndex > 0) {
      onTabChange(tabOrder[currentIndex - 1]);
    }
  };

  const handleSave = (status: InvoiceStatus) => {
    if (!validateDetails() || !validateItems()) return;

    // Validate email when sending invoice
    if (status === "sent" && !formData.customerEmail) {
      alert("Customer email is required to send invoice");
      return;
    }

    onSaveInvoice({
      customer: formData.customer,
      customerEmail: formData.customerEmail,
      contactId: formData.contactId,
      contactType: formData.contactType,
      amount: total.toFixed(2),
      issueDate: formData.issueDate,
      dueDate: formData.dueDate,
      branch: formData.branch,
      status: status,
      items: formData.items,
      notes: formData.notes,
      taxRate: formData.taxRate,
      discount: formData.discount,
    });

    onClose();
  };

  const handlePrintInvoice = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const invoiceNumber = invoice?.invoiceNumber || "DRAFT";
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoiceNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
            h1 { color: #1e293b; margin-bottom: 10px; }
            .header { margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
            .details { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .details div { flex: 1; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            th { background-color: #f8fafc; font-weight: 600; }
            .totals { margin-top: 20px; text-align: right; }
            .totals div { margin: 8px 0; }
            .grand-total { font-size: 1.2em; font-weight: bold; color: #1e293b; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Invoice ${invoiceNumber}</h1>
            <p><strong>Status:</strong> ${INVOICE_STATUS_META[formData.status].label}</p>
          </div>
          <div class="details">
            <div>
              <h3>Bill To:</h3>
              <p><strong>${formData.customer}</strong></p>
              ${formData.customerEmail ? `<p>${formData.customerEmail}</p>` : ''}
            </div>
            <div>
              <h3>Invoice Details:</h3>
              <p><strong>Issue Date:</strong> ${formData.issueDate}</p>
              <p><strong>Due Date:</strong> ${formData.dueDate}</p>
              <p><strong>Branch:</strong> ${formData.branch}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${formData.items.map(item => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.quantity}</td>
                  <td>₦${item.unitPrice.toLocaleString()}</td>
                  <td>₦${(item.quantity * item.unitPrice).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="totals">
            <div><strong>Subtotal:</strong> ₦${subtotal.toLocaleString()}</div>
            <div><strong>Tax (${formData.taxRate}%):</strong> ₦${taxAmount.toLocaleString()}</div>
            ${formData.discount > 0 ? `<div><strong>Discount (${formData.discount}%):</strong> -₦${discountAmount.toLocaleString()}</div>` : ''}
            <div class="grand-total"><strong>Total:</strong> ₦${total.toLocaleString()}</div>
          </div>
          ${formData.notes ? `<div style="margin-top: 30px;"><strong>Notes:</strong><p>${formData.notes}</p></div>` : ''}
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  // Filter contacts based on search
  const filteredContacts = crmContacts.filter(contact => {
    const searchLower = customerSearch.toLowerCase();
    return (
      contact.firstName.toLowerCase().includes(searchLower) ||
      contact.lastName.toLowerCase().includes(searchLower) ||
      contact.email.toLowerCase().includes(searchLower) ||
      (contact.company && contact.company.toLowerCase().includes(searchLower))
    );
  });

  const handleSelectContact = (contact: CrmContact) => {
    // Determine contact type: business if they have a company, individual otherwise
    const contactType: 'individual' | 'business' = contact.company ? 'business' : 'individual';
    const displayName = contact.company || `${contact.firstName} ${contact.lastName}`;
    
    setFormData({
      ...formData,
      customer: displayName,
      customerEmail: contact.email,
      contactId: contact.id,
      contactType: contactType,
    });
    setCustomerSearch("");
    setShowContactDropdown(false);
  };

  const handleSelectSavedItem = (item: SavedLineItem, index: number) => {
    const newItems = [...formData.items];
    newItems[index] = {
      ...newItems[index],
      description: item.description,
      unitPrice: item.defaultPrice,
    };
    setFormData({ ...formData, items: newItems });
    setItemSearch({ ...itemSearch, [index]: "" });
    setShowItemDropdown({ ...showItemDropdown, [index]: false });
  };

  const handleSaveCurrentItem = (index: number) => {
    const item = formData.items[index];
    if (item.description && item.unitPrice > 0) {
      onSaveLineItem(item.description, item.unitPrice);
    }
  };

  // Filter saved items for dropdown
  const getFilteredItems = (index: number) => {
    const search = itemSearch[index] || "";
    if (!search) return savedLineItems;
    const searchLower = search.toLowerCase();
    return savedLineItems.filter(item =>
      item.description.toLowerCase().includes(searchLower) ||
      (item.category && item.category.toLowerCase().includes(searchLower))
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-8 py-6">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              {invoiceId ? `Edit Invoice` : "New Invoice"}
            </h2>
            <p className="text-sm text-slate-500">
              {invoiceId ? invoice?.invoiceNumber : "Create a new invoice for your customer"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            type="button"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation - Progress Indicator */}
        <div className="border-b border-slate-200 px-8 py-6">
          <div className="flex items-center justify-between">
            {tabs.map((tab, index) => {
              const tabOrder: InvoiceFormTab[] = ["details", "items", "taxes", "preview"];
              const currentIndex = tabOrder.indexOf(currentTab);
              const tabIndex = tabOrder.indexOf(tab.id);
              const isCompleted = tabIndex < currentIndex;
              const isCurrent = tab.id === currentTab;
              
              return (
                <div key={tab.id} className="flex flex-1 items-center">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                        isCurrent
                          ? "bg-slate-900 text-white"
                          : isCompleted
                          ? "bg-green-500 text-white"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {isCompleted ? "✓" : index + 1}
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        isCurrent ? "text-slate-900" : isCompleted ? "text-green-600" : "text-slate-500"
                      }`}
                    >
                      {tab.label}
                    </span>
                  </div>
                  {index < tabs.length - 1 && (
                    <div className={`mx-4 h-0.5 flex-1 ${isCompleted ? "bg-green-500" : "bg-slate-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {currentTab === "details" && (
            <div className="space-y-6">
              <div className="relative">
                <label className="block text-sm font-semibold text-slate-900">
                  Customer <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerSearch || formData.customer}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setFormData({ ...formData, customer: e.target.value, customerEmail: "", contactId: "" });
                    setShowContactDropdown(e.target.value.length > 0);
                  }}
                  onFocus={() => setShowContactDropdown(customerSearch.length > 0 || formData.customer.length > 0)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-slate-300 focus:outline-none"
                  placeholder="Search CRM contacts..."
                />
                {showContactDropdown && filteredContacts.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-2xl border border-slate-200 bg-white shadow-lg max-h-60 overflow-y-auto">
                    {filteredContacts.map((contact) => {
                      const isBusiness = !!contact.company;
                      return (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => handleSelectContact(contact)}
                          className="w-full px-4 py-3 text-left hover:bg-slate-50 flex flex-col gap-1"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">
                              {contact.firstName} {contact.lastName}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              isBusiness 
                                ? 'bg-blue-50 text-blue-600' 
                                : 'bg-emerald-50 text-emerald-600'
                            }`}>
                              {isBusiness ? '🏢 Business' : '👤 Individual'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500">{contact.email}</div>
                          {contact.company && <div className="text-xs font-medium text-slate-600">Company: {contact.company}</div>}
                        </button>
                      );
                    })}
                  </div>
                )}
                {formData.customer.trim() === "" && (
                  <p className="mt-1 text-xs text-red-500">Customer name is required</p>
                )}
                {formData.contactId && formData.contactType && (
                  <p className="mt-1 text-xs text-slate-500">
                    {formData.contactType === 'business' ? '🏢 Business contact from CRM' : '👤 Individual contact from CRM'}
                  </p>
                )}
                {formData.customer && !formData.contactId && (
                  <p className="mt-1 text-xs text-amber-600">
                    ⚠️ New contact - will be created manually
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900">
                  Customer Email {formData.status === "sent" && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-slate-300 focus:outline-none"
                  placeholder="customer@example.com"
                />
                <p className="mt-1 text-xs text-slate-500">Required to send invoice via email</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900">
                    Issue Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.issueDate}
                    onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-slate-300 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900">
                    Due Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-slate-300 focus:outline-none"
                  />
                  {formData.dueDate && formData.issueDate && new Date(formData.dueDate) < new Date(formData.issueDate) && (
                    <p className="mt-1 text-xs text-red-500">Due date must be after issue date</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900">
                  Branch <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-slate-300 focus:outline-none"
                >
                  <option>Lagos HQ</option>
                  <option>Abuja</option>
                  <option>Port Harcourt</option>
                  <option>Kano</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-slate-300 focus:outline-none"
                  placeholder="Add any additional notes or payment instructions"
                />
              </div>
            </div>
          )}

          {currentTab === "items" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Line Items</h3>
                <button
                  onClick={handleAddItem}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  type="button"
                >
                  + Add Item
                </button>
              </div>

              {formData.items.map((item, index) => (
                <div key={index} className="rounded-2xl border border-slate-200 p-4">
                  <div className="space-y-4">
                    <div className="relative">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Description
                        </label>
                        <button
                          onClick={() => handleSaveCurrentItem(index)}
                          className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                          type="button"
                        >
                          Save to catalog
                        </button>
                      </div>
                      <input
                        type="text"
                        value={itemSearch[index] !== undefined ? itemSearch[index] : item.description}
                        onChange={(e) => {
                          setItemSearch({ ...itemSearch, [index]: e.target.value });
                          handleItemChange(index, "description", e.target.value);
                          setShowItemDropdown({ ...showItemDropdown, [index]: e.target.value.length > 0 });
                        }}
                        onFocus={() => setShowItemDropdown({ ...showItemDropdown, [index]: true })}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-300 focus:outline-none"
                        placeholder="Search catalog or enter new item..."
                      />
                      {showItemDropdown[index] && getFilteredItems(index).length > 0 && (
                        <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                          {getFilteredItems(index).map((savedItem) => (
                            <button
                              key={savedItem.id}
                              type="button"
                              onClick={() => handleSelectSavedItem(savedItem, index)}
                              className="w-full px-3 py-2 text-left hover:bg-slate-50 flex justify-between items-center"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-900">{savedItem.description}</span>
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
                                    📦 From Catalog
                                  </span>
                                </div>
                                {savedItem.category && <div className="text-xs text-slate-400 mt-0.5">{savedItem.category}</div>}
                              </div>
                              <div className="text-sm font-semibold text-slate-600 ml-3">₦{savedItem.defaultPrice.toLocaleString()}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Quantity
                        </label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, "quantity", parseInt(e.target.value) || 0)}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-300 focus:outline-none"
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Unit Price (₦)
                        </label>
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, "unitPrice", parseFloat(e.target.value) || 0)}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-300 focus:outline-none"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Total
                        </label>
                        <div className="mt-1 flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                          <span className="text-sm font-semibold text-slate-900">
                            ₦{(item.quantity * item.unitPrice).toLocaleString()}
                          </span>
                          {formData.items.length > 1 && (
                            <button
                              onClick={() => handleRemoveItem(index)}
                              className="text-rose-600 hover:text-rose-700"
                              type="button"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-600">Subtotal</span>
                  <span className="text-lg font-semibold text-slate-900">₦{subtotal.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {currentTab === "taxes" && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-900">Tax Rate (%)</label>
                <input
                  type="number"
                  value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-slate-300 focus:outline-none"
                  min="0"
                  step="0.1"
                />
                <p className="mt-1 text-xs text-slate-500">Tax amount: ₦{taxAmount.toLocaleString()}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900">Discount (%)</label>
                <input
                  type="number"
                  value={formData.discount}
                  onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-slate-300 focus:outline-none"
                  min="0"
                  max="100"
                  step="0.1"
                />
                <p className="mt-1 text-xs text-slate-500">Discount amount: ₦{discountAmount.toLocaleString()}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-semibold text-slate-900">₦{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Tax ({formData.taxRate}%)</span>
                  <span className="font-semibold text-emerald-600">+₦{taxAmount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Discount ({formData.discount}%)</span>
                  <span className="font-semibold text-rose-600">-₦{discountAmount.toLocaleString()}</span>
                </div>
                <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                  <span className="text-lg font-semibold text-slate-900">Total</span>
                  <span className="text-2xl font-bold text-slate-900">₦{total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {currentTab === "preview" && (
            <div className="space-y-6">
              <div className="rounded-2xl border-2 border-slate-200 bg-white p-8">
                <div className="space-y-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">INVOICE</h3>
                      <p className="mt-1 text-sm text-slate-600">{invoiceId ? invoice?.invoiceNumber : "INV-DRAFT"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{formData.branch}</p>
                      <p className="text-xs text-slate-500">Branch</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 border-y border-slate-200 py-6">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bill To</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{formData.customer || "N/A"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Dates</p>
                      <p className="mt-1 text-sm text-slate-700">Issued: {formData.issueDate}</p>
                      <p className="text-sm text-slate-700">Due: {formData.dueDate}</p>
                    </div>
                  </div>

                  <div>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Item</th>
                          <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Qty</th>
                          <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Price</th>
                          <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.items.map((item, index) => (
                          <tr key={index} className="border-b border-slate-100">
                            <td className="py-3 text-sm text-slate-900">{item.description || "Untitled Item"}</td>
                            <td className="py-3 text-right text-sm text-slate-700">{item.quantity}</td>
                            <td className="py-3 text-right text-sm text-slate-700">₦{item.unitPrice.toLocaleString()}</td>
                            <td className="py-3 text-right text-sm font-semibold text-slate-900">
                              ₦{(item.quantity * item.unitPrice).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Subtotal</span>
                        <span className="font-semibold text-slate-900">₦{subtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Tax ({formData.taxRate}%)</span>
                        <span className="font-semibold text-slate-900">₦{taxAmount.toLocaleString()}</span>
                      </div>
                      {formData.discount > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">Discount ({formData.discount}%)</span>
                          <span className="font-semibold text-rose-600">-₦{discountAmount.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                        <span className="font-semibold text-slate-900">Total</span>
                        <span className="text-xl font-bold text-slate-900">₦{total.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {formData.notes && (
                    <div className="border-t border-slate-200 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</p>
                      <p className="mt-1 text-sm text-slate-700">{formData.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-200 px-8 py-6">
          <div className="flex items-center justify-between gap-4">
            {currentTab === "preview" ? (
              <>
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="rounded-full border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    type="button"
                  >
                    Cancel
                  </button>
                  {invoiceId && (
                    <button
                      onClick={handlePrintInvoice}
                      className="rounded-full border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      type="button"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Print
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleSave("draft")}
                    className="rounded-full border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    type="button"
                  >
                    Save Draft
                  </button>
                  <button
                    onClick={() => handleSave("sent")}
                    className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                    type="button"
                  >
                    {invoiceId ? "Update Invoice" : "Send Invoice"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={currentTab === "details" ? onClose : handlePrevious}
                  className="rounded-full border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  type="button"
                >
                  {currentTab === "details" ? "Cancel" : "Previous"}
                </button>
                <button
                  onClick={handleNext}
                  disabled={!canProceedToTab(
                    currentTab === "details" ? "items" : 
                    currentTab === "items" ? "taxes" : 
                    currentTab === "taxes" ? "preview" : "preview"
                  )}
                  className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  type="button"
                >
                  Next
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function FinanceScheduleCard({
  title,
  items,
  totalCount,
  accent,
  onViewAll,
}: {
  title: string;
  items: FinanceScheduleItem[];
  totalCount: number;
  accent: string;
  onViewAll: () => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{title}</p>
          <p className="text-sm text-slate-500">Multi-entity status</p>
        </div>
        <div className={`rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold ${accent}`}>{totalCount} total</div>
      </div>
      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const meta = FINANCE_SCHEDULE_STATUS_META[item.status];
          return (
            <div key={item.id} className="rounded-2xl border border-slate-100 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">{item.entity}</p>
                  <p className="text-xs text-slate-500">{item.branch}</p>
                </div>
                <div className="text-right text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">{item.amount}</p>
                  <p className="text-xs text-slate-500">{item.dueDate}</p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className={`rounded-full px-3 py-1 font-semibold ${meta.chip}`}>{meta.label}</span>
                <span className="rounded-full bg-slate-900/5 px-3 py-1 text-slate-600">{item.id}</span>
              </div>
            </div>
          );
        })}
        {totalCount > items.length && (
          <button
            onClick={onViewAll}
            className="mt-2 w-full rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-900"
            type="button"
          >
            View all {totalCount} items →
          </button>
        )}
      </div>
    </div>
  );
}

function FinanceTrendCard({ trend }: { trend: FinanceTrendSnapshot }) {
  const maxValue = Math.max(1, ...trend.revenue, ...trend.expenses);
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Revenue vs expense</p>
          <h2 className="text-xl font-semibold text-slate-900">Weekly pacing</h2>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>
      <div className="mt-6 space-y-4">
        {trend.labels.map((label, index) => {
          const revenue = trend.revenue[index] ?? 0;
          const expenses = trend.expenses[index] ?? 0;
          const revenuePct = `${(revenue / maxValue) * 100}%`;
          const expensePct = `${(expenses / maxValue) * 100}%`;
          return (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
                <span>{label}</span>
                <span>
                  ₦{revenue.toLocaleString()} · ₦{expenses.toLocaleString()}
                </span>
              </div>
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-900" style={{ width: revenuePct }} />
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-400" style={{ width: expensePct }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FinanceCashAccounts({
  accounts,
  loading,
  error,
  onRefresh,
}: {
  accounts: FinanceCashAccount[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Cash positions</p>
          <h2 className="text-xl font-semibold text-slate-900">Bank + treasury</h2>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600"
            type="button"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                Syncing
              </span>
            ) : (
              "Refresh"
            )}
          </button>
          <button className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600" type="button">
            Manage accounts
          </button>
        </div>
      </div>
      {error && (
        <div className="mt-3 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}
      <div className="mt-4 space-y-3">
        {accounts.length === 0 && !loading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
            No accounts yet. Add your first bank or cash entity to see realtime balances.
          </div>
        ) : (
          accounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{account.name}</p>
                <p className="text-xs text-slate-500">{account.region} · {account.type === "bank" ? "Bank" : "Cash"}</p>
              </div>
              <div className="text-right text-sm text-slate-600">
                <p className="text-lg font-semibold text-slate-900">{account.balance}</p>
                <p className={`text-xs font-semibold ${account.trend === "up" ? "text-emerald-600" : "text-rose-600"}`}>{account.change}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FinanceExpenseBreakdownCard({ expenses }: { expenses: FinanceExpenseBreakdown[] }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Expense breakdown</p>
          <h2 className="text-xl font-semibold text-slate-900">Operating layers</h2>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
          <LineChart className="h-4 w-4" />
          View report
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {expenses.map((expense) => (
          <div
            key={expense.label}
            className="rounded-2xl border border-slate-100 px-4 py-2 text-sm text-slate-700"
          >
            <p className="font-semibold text-slate-900">{expense.label}</p>
            <div className="flex items-center gap-2 text-xs">
              <span>{expense.amount}</span>
              <span className={`font-semibold ${expense.direction === "up" ? "text-rose-600" : "text-emerald-600"}`}>
                {expense.delta}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CrmActionModal({
  type,
  onClose,
  onSubmit,
  contacts,
  tagOptions,
}: {
  type: CrmActionType;
  onClose: () => void;
  onSubmit: (submission: CrmActionSubmission) => void;
  contacts: CrmImportedContact[];
  tagOptions: readonly string[];
}) {
  const [dealForm, setDealForm] = useState<CrmDealFormState>(() => defaultDealForm());
  const [engagementForm, setEngagementForm] = useState<CrmEngagementFormState>(() => defaultEngagementForm());
  const [customerForm, setCustomerForm] = useState<CrmCustomerFormState>(() => defaultCustomerForm());
  const [contactSearch, setContactSearch] = useState("");
  const [contactTagFilter, setContactTagFilter] = useState<string | null>(null);

  useEffect(() => {
    if (type === "engagement") {
      setEngagementForm(defaultEngagementForm());
    } else if (type === "customer") {
      setCustomerForm(defaultCustomerForm());
    } else {
      setDealForm(defaultDealForm());
    }
    setContactSearch("");
    setContactTagFilter(null);
  }, [type]);

  const linkedContact = dealForm.linkedContactId
    ? contacts.find((contact) => contact.id === dealForm.linkedContactId) ?? null
    : null;

  const contactMatches = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    return contacts
      .filter((contact) => {
        const tags = Array.isArray(contact.tags) ? contact.tags : [];
        if (contactTagFilter && !tags.includes(contactTagFilter)) {
          return false;
        }
        if (!query) {
          return true;
        }
        const haystack = `${contact.company} ${contact.contact} ${contact.email} ${contact.phone} ${tags.join(" ")}`.toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 5);
  }, [contacts, contactSearch, contactTagFilter]);

  const handleLinkContact = useCallback((contact: CrmImportedContact) => {
    setDealForm((previous) => ({
      ...previous,
      company: contact.company || previous.company,
      contact: contact.contact || previous.contact,
      linkedContactId: contact.id,
    }));
  }, []);

  const handleClearLinkedContact = useCallback(() => {
    setDealForm((previous) => ({ ...previous, linkedContactId: null }));
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (type === "engagement") {
      onSubmit({ type, payload: engagementForm });
      return;
    }
    if (type === "customer") {
      onSubmit({ type, payload: customerForm });
      return;
    }
    onSubmit({ type, payload: dealForm });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">CRM action</p>
            <h2 className="text-xl font-semibold text-slate-900">
              {type === "contact" && "Add contact"}
              {type === "opportunity" && "Register opportunity"}
              {type === "engagement" && "Log engagement"}
              {type === "customer" && "Add customer"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-900"
            aria-label="Close CRM action modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {type === "engagement" ? (
            <>
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Title
                <input
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none"
                  value={engagementForm.title}
                  onChange={(event) => setEngagementForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Proposal emailed"
                  required
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Detail
                <textarea
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none"
                  value={engagementForm.detail}
                  onChange={(event) => setEngagementForm((prev) => ({ ...prev, detail: event.target.value }))}
                  placeholder="Nova Retail · Contracting phase"
                  rows={4}
                  required
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Channel
                <select
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none"
                  value={engagementForm.channel}
                  onChange={(event) =>
                    setEngagementForm((prev) => ({ ...prev, channel: event.target.value as CrmEngagement["channel"] }))
                  }
                >
                  {CRM_CHANNEL_OPTIONS.map((channel) => (
                    <option key={channel}>{channel}</option>
                  ))}
                </select>
              </label>
            </>
          ) : type === "customer" ? (
            <>
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Customer name
                <input
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none"
                  value={customerForm.name}
                  onChange={(event) => setCustomerForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Ex: Nova Telecom"
                  required
                />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Contact first name
                  <input
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none"
                    value={customerForm.contactFirstName}
                    onChange={(event) => setCustomerForm((prev) => ({ ...prev, contactFirstName: event.target.value }))}
                    placeholder="Sara"
                    required
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Contact last name
                  <input
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none"
                    value={customerForm.contactLastName}
                    onChange={(event) => setCustomerForm((prev) => ({ ...prev, contactLastName: event.target.value }))}
                    placeholder="Bello"
                    required
                  />
                </label>
              </div>
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Contact email
                <input
                  type="email"
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none"
                  value={customerForm.contactEmail}
                  onChange={(event) => setCustomerForm((prev) => ({ ...prev, contactEmail: event.target.value }))}
                  placeholder="sara@nova.io"
                  required
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Contact phone
                <input
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none"
                  value={customerForm.contactPhone}
                  onChange={(event) => setCustomerForm((prev) => ({ ...prev, contactPhone: event.target.value }))}
                  placeholder="+234 801 555 9988"
                  required
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Status
                <select
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none"
                  value={customerForm.status}
                  onChange={(event) => setCustomerForm((prev) => ({ ...prev, status: event.target.value }))}
                >
                  {CRM_CUSTOMER_STATUS_OPTIONS.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Company
                <input
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none"
                  value={dealForm.company}
                  onChange={(event) => setDealForm((prev) => ({ ...prev, company: event.target.value }))}
                  placeholder="Helios Parts"
                  required
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Primary contact
                <input
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none"
                  value={dealForm.contact}
                  onChange={(event) => setDealForm((prev) => ({ ...prev, contact: event.target.value }))}
                  placeholder="Sara Bello"
                  required
                />
              </label>
              {type === "opportunity" && (
                <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Link existing contact</p>
                      <p className="text-sm text-slate-500">Search by name, company, or tag</p>
                    </div>
                    {linkedContact && (
                      <button
                        type="button"
                        onClick={handleClearLinkedContact}
                        className="text-xs font-semibold text-rose-500"
                      >
                        Clear link
                      </button>
                    )}
                  </div>
                  {linkedContact ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                      <p className="text-sm font-semibold text-slate-900">{linkedContact.contact}</p>
                      <p>{linkedContact.company}</p>
                      <p className="text-xs text-slate-500">{linkedContact.email || linkedContact.phone || "No contact info"}</p>
                      {linkedContact.tags && linkedContact.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {linkedContact.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-slate-900/5 px-2 py-0.5 text-[0.65rem] font-semibold text-slate-600">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : contacts.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-3 text-xs text-slate-500">
                      Import contacts to enable quick linking.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <input
                        className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                        placeholder="Search contacts by name or company"
                        value={contactSearch}
                        onChange={(event) => setContactSearch(event.target.value)}
                      />
                      <div className="flex flex-wrap gap-1 text-[0.65rem]">
                        <button
                          type="button"
                          onClick={() => setContactTagFilter(null)}
                          className={`rounded-full border px-3 py-1 font-semibold ${
                            contactTagFilter === null
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 text-slate-600"
                          }`}
                        >
                          All tags
                        </button>
                        {tagOptions.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setContactTagFilter(contactTagFilter === tag ? null : tag)}
                            className={`rounded-full border px-3 py-1 font-semibold ${
                              contactTagFilter === tag
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 text-slate-600"
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                      {contactMatches.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-3 text-xs text-slate-500">
                          No contacts match those filters yet.
                        </p>
                      ) : (
                        <ul className="space-y-2 text-sm">
                          {contactMatches.map((contact) => (
                            <li key={contact.id}>
                              <button
                                type="button"
                                onClick={() => handleLinkContact(contact)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left text-slate-700 hover:border-slate-300"
                              >
                                <p className="font-semibold text-slate-900">{contact.contact}</p>
                                <p className="text-xs text-slate-500">{contact.company}</p>
                                {contact.tags && contact.tags.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {contact.tags.slice(0, 3).map((tag) => (
                                      <span
                                        key={`${contact.id}-${tag}`}
                                        className="rounded-full bg-slate-900/5 px-2 py-0.5 text-[0.6rem] font-semibold text-slate-600"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Owner
                  <input
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none"
                    value={dealForm.owner}
                    onChange={(event) => setDealForm((prev) => ({ ...prev, owner: event.target.value }))}
                    placeholder="D. Ibarra"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Stage
                  <select
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none"
                    value={dealForm.stage}
                    onChange={(event) => setDealForm((prev) => ({ ...prev, stage: event.target.value }))}
                  >
                    {CRM_STAGE_OPTIONS.map((stage) => (
                      <option key={stage}>{stage}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Deal value
                <input
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none"
                  value={dealForm.value}
                  onChange={(event) => setDealForm((prev) => ({ ...prev, value: event.target.value }))}
                  placeholder="₦2.4M"
                />
              </label>
              {type === "opportunity" && (
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Deal description
                  <textarea
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none"
                    value={dealForm.description}
                    onChange={(event) => setDealForm((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Summarize the opportunity scope"
                    rows={3}
                  />
                </label>
              )}
            </>
          )}
          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Save entry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InvoiceReviewBoard({ invoices }: { invoices: InvoiceRow[] }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm shadow-slate-200/60">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Invoice queue</p>
          <h2 className="text-xl font-semibold text-slate-900">Ready for sync</h2>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">
          <ArrowUpRight className="h-4 w-4" /> Export batch
        </button>
      </div>
      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100">
        <div className="grid grid-cols-[1.1fr_1.2fr_0.8fr_0.7fr_0.6fr_1.4fr] bg-slate-50/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          <span>Invoice</span>
          <span>Vendor</span>
          <span>Amount</span>
          <span>Channel</span>
          <span>ETA</span>
          <span>Status</span>
        </div>
        <div>
          {invoices.map((invoice, index) => (
            <div
              key={invoice.id}
              className={`grid grid-cols-[1.1fr_1.2fr_0.8fr_0.7fr_0.6fr_1.4fr] items-center px-4 py-3 text-sm text-slate-700 ${
                index !== invoices.length - 1 ? "border-b border-slate-100" : ""
              }`}
            >
              <div className="font-semibold text-slate-900">{invoice.id}</div>
              <div>{invoice.vendor}</div>
              <div>{invoice.amount}</div>
              <div className="text-slate-500">{invoice.channel}</div>
              <div className="text-slate-500">{invoice.eta}</div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${INVOICE_STATUS_STYLES[invoice.status]}`}>
                  {INVOICE_STATUS_LABELS[invoice.status]}
                </span>
                <span className="text-xs text-slate-400">{invoice.notes}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DealPipelineBoard({ deals }: { deals: DealOpportunity[] }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm shadow-slate-200/60">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Strategic deals</p>
          <h2 className="text-xl font-semibold text-slate-900">Diligence + sourcing</h2>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">
          <Layers3 className="h-4 w-4" /> Configure views
        </button>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {deals.map((deal) => (
          <div key={deal.name} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{deal.region}</p>
                <p className="text-lg font-semibold text-slate-900">{deal.name}</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">{deal.stage}</span>
            </div>
            <div className="mt-3 flex items-center gap-4 text-sm text-slate-600">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Value</p>
                <p className="text-base font-semibold text-slate-900">{deal.value}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Owner</p>
                <p>{deal.owner}</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Probability</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-2 flex-1 rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-slate-900"
                    style={{ width: `${deal.probability}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-slate-900">{deal.probability}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ApprovalsPanel({ routes }: { routes: ApprovalRoute[] }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm shadow-slate-200/60">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Routing lanes</p>
          <h2 className="text-xl font-semibold text-slate-900">Approval orchestration</h2>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">
          <ClipboardList className="h-4 w-4" /> View runbook
        </button>
      </div>
      <div className="mt-6 space-y-3">
        {routes.map((route) => (
          <div
            key={route.name}
            className={`rounded-2xl border border-slate-100 px-4 py-3 ${route.critical ? "bg-rose-50/70" : "bg-slate-50/60"}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{route.name}</p>
                <p className="text-xs text-slate-500">Updated {route.updated}</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                {route.pending} pending
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 font-semibold text-slate-700">
                {route.owners.join(" · ")}
              </div>
              <span className="rounded-full bg-slate-900/5 px-3 py-1">ETA {route.eta}</span>
              {route.critical && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-rose-600">
                  <AlertTriangle className="h-3.5 w-3.5" /> Critical
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertStack({ alerts }: { alerts: AlertItem[] }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm shadow-slate-200/60">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">System alerts</p>
          <h2 className="text-xl font-semibold text-slate-900">Risk + compliance</h2>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">
          <ShieldCheck className="h-4 w-4" /> Auto-mitigations
        </button>
      </div>
      <div className="mt-6 space-y-3">
        {alerts.map((alert) => {
          const severity = ALERT_SEVERITY_STYLES[alert.severity];
          return (
            <div key={alert.label} className="rounded-2xl border border-slate-100 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${severity.icon}`}>
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{alert.label}</p>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${severity.chip}`}>
                      {severity.label}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">{alert.detail}</p>
                  <p className="text-xs text-slate-400">{alert.timestamp}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type SelectorProps = {
  value: string;
  options: string[];
  label: string;
  onChange: (value: string) => void;
};

function TopBar({
  entityOptions,
  regionOptions,
  timeframeOptions,
  selectedEntity,
  selectedRegion,
  selectedTimeframe,
  onEntityChange,
  onRegionChange,
  onTimeframeChange,
}: {
  entityOptions: string[];
  regionOptions: string[];
  timeframeOptions: string[];
  selectedEntity: string;
  selectedRegion: string;
  selectedTimeframe: string;
  onEntityChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onTimeframeChange: (value: string) => void;
}) {
  return (
    <div className="z-20 border-b border-white/40 bg-white/70 backdrop-blur-lg">
      <div className="flex items-center justify-between px-6 py-4 lg:px-10">
        <div className="flex items-center gap-4">
          <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold tracking-[0.3em] text-white">
            SYS
          </div>
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.4em] text-slate-400">Tenant Admin</p>
            <p className="text-lg font-semibold text-slate-900">Global Control Mesh</p>
          </div>
        </div>

        <div className="hidden items-center gap-4 lg:flex">
          <ContextSelector
            label="Entity"
            value={selectedEntity}
            onChange={onEntityChange}
            options={entityOptions}
          />
          <ContextSelector
            label="Region"
            value={selectedRegion}
            onChange={onRegionChange}
            options={regionOptions}
          />
          <ContextSelector
            label="Timeframe"
            value={selectedTimeframe}
            onChange={onTimeframeChange}
            options={timeframeOptions}
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 lg:flex">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Multi-tenant secure
          </div>
          <button className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-900">
            <Search className="h-4 w-4" />
          </button>
          <button className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-900">
            <Bell className="h-4 w-4" />
          </button>
          <button className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-900 lg:hidden">
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-900 to-slate-600" />
            <div className="text-left text-xs text-slate-500">
              <p className="font-semibold text-slate-700">Ops persona</p>
              <p>Myra Lane</p>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ContextSelector({ label, value, options, onChange }: SelectorProps) {
  return (
    <div className="flex flex-col text-xs text-slate-500">
      <span className="uppercase tracking-[0.25em]">{label}</span>
      <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:border-slate-300">
        {value}
        <ChevronDown className="h-4 w-4" />
      </button>
      <select
        className="sr-only"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}

function Sidebar({
  collapsed,
  onToggle,
  navigation,
  activeKey,
  onNavigate,
}: {
  collapsed: boolean;
  onToggle: () => void;
  navigation: NavigationSection[];
  activeKey: string;
  onNavigate: (key: string) => void;
}) {
  return (
    <aside
      className={`relative flex flex-col border-r border-slate-200 bg-white/90 backdrop-blur-xl transition-all duration-300 ${
        collapsed ? "w-20" : "w-72"
      }`}
    >
      <div className="flex items-center justify-between px-4 py-4">
        <p className={`text-xs uppercase tracking-[0.3em] text-slate-400 ${collapsed ? "hidden" : "block"}`}>
          Modules
        </p>
        <button
          className="rounded-full border border-slate-200 p-1 text-slate-500 hover:text-slate-900"
          onClick={onToggle}
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-6">
        {navigation.map((section) => (
          <div key={section.label} className="mb-6">
            {!collapsed && (
              <p className="px-3 text-[0.65rem] uppercase tracking-[0.3em] text-slate-400">
                {section.label}
              </p>
            )}
            <div className="mt-2 space-y-1">
              {section.links.map((link) => {
                const Icon = link.icon;
                const active = activeKey === link.key;
                return (
                  <button
                    key={link.key}
                    onClick={() => onNavigate(link.key)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm transition hover:bg-slate-100 ${
                      active ? "bg-slate-900 text-white shadow-lg" : "text-slate-600"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {!collapsed && (
                      <span className="flex-1 text-left">
                        {link.label}
                        {link.badge && (
                          <span className="ml-2 rounded-full bg-white/30 px-2 py-0.5 text-xs">
                            {link.badge}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 p-4 text-xs text-slate-500">
        {!collapsed ? (
          <div className="space-y-1">
            <p className="font-semibold text-slate-700">Pinned contexts</p>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <PinIndicator />
              <div>
                <p className="text-sm text-slate-900">Operations mesh</p>
                <p>4 live filters</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <PinIndicator />
          </div>
        )}
      </div>
    </aside>
  );
}

function PinIndicator() {
  return (
    <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/10 text-slate-700">
      <ChevronRight className="h-4 w-4" />
    </div>
  );
}

function KpiGrid({ metrics }: { metrics: KpiMetric[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm shadow-slate-200/50"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{metric.label}</p>
          <div className="mt-3 flex items-center gap-3">
            <p className="text-3xl font-semibold text-slate-900">{metric.value}</p>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                metric.trend === "up"
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-rose-50 text-rose-600"
              }`}
            >
              {metric.delta}
              {metric.trend === "up" ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500">{metric.description}</p>
        </div>
      ))}
    </div>
  );
}

function LiveOperations({ panels }: { panels: LiveOperationPanel[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Live operations</p>
          <h2 className="text-xl font-semibold text-slate-900">Command mesh lenses</h2>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
          <Zap className="h-4 w-4 text-emerald-500" />
          Trigger automation
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {panels.map((panel) => (
          <div
            key={panel.title}
            className={`rounded-3xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-200/60 ${panel.primaryColor}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{panel.title}</p>
                <p className="text-lg font-semibold text-slate-900">{panel.countLabel}</p>
              </div>
              <div className="flex gap-2">
                {panel.pills.map((pill) => (
                  <span key={pill} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                    {pill}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {panel.items.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-slate-100 bg-slate-50/40 px-4 py-3"
                >
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="text-sm text-slate-500">{item.meta}</p>
                  <p className={`text-xs font-semibold ${item.statusColor}`}>{item.supporting}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityStream() {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm shadow-slate-200/60">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Activity stream</p>
          <h2 className="text-xl font-semibold text-slate-900">System signals</h2>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">
          <Bell className="h-4 w-4" />
          Subscribe
        </button>
      </div>
      <div className="mt-6 space-y-4">
        {ACTIVITY_LOG.map((event, index) => (
          <Fragment key={`${event.title}-${index}`}>
            {index > 0 && <div className="border-t border-dashed border-slate-100" />}
            <div className="flex items-start gap-3">
              <div className={`mt-1 h-2.5 w-2.5 rounded-full ${ACTIVITY_TONE_CLASSES[event.tone]}`} />
              <div>
                <p className="font-semibold text-slate-900">{event.title}</p>
                <p className="text-sm text-slate-500">{event.detail}</p>
                <p className="text-xs text-slate-400">{event.timestamp}</p>
              </div>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
