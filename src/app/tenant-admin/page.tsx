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
  DollarSign,
  Download,
  CreditCard,
  FileSpreadsheet,
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
  Receipt,
  Megaphone,
  Menu,
  PhoneCall,
  PiggyBank,
  PlugZap,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  Users2,
  Wallet,
  Workflow,
  Zap,
  X,
} from "lucide-react";
import { Component, Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ComponentType, FormEvent } from "react";
import DepartmentManagement from "@/app/tenant-admin/sections/department-management";
import RoleBuilder from "@/app/tenant-admin/sections/role-builder";
import ApprovalDesigner from "@/app/tenant-admin/sections/approval-designer";
import EmployeeConsole from "@/app/tenant-admin/sections/employee-console";
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

const CRM_METRICS: KpiMetric[] = [
  { label: "Leads created", value: "42", delta: "+8.2%", trend: "up", description: "vs yesterday" },
  { label: "Open pipeline", value: "₦18.4M", delta: "+3.1%", trend: "up", description: "17 opps" },
  { label: "Conversion rate", value: "26%", delta: "-1.2%", trend: "down", description: "Last 30d" },
  { label: "Follow-ups due", value: "12", delta: "+4", trend: "down", description: "Need touch today" },
];

const CRM_LEADS: CrmLead[] = [
  {
    id: "PIPE-982",
    company: "Nova Retail",
    contact: "Sara Bello",
    stage: "Contracting",
    owner: "S. Patel",
    value: "₦4.2M",
    status: "overdue",
  },
  {
    id: "PIPE-977",
    company: "Helios Parts",
    contact: "Marcus Lee",
    stage: "Diligence",
    owner: "D. Ibarra",
    value: "₦2.8M",
    status: "pending",
  },
  {
    id: "PIPE-971",
    company: "Bright Innovations",
    contact: "Joan Adu",
    stage: "Proposal",
    owner: "M. Byrne",
    value: "₦3.1M",
    status: "pending",
  },
  {
    id: "PIPE-965",
    company: "Axiom Mobility",
    contact: "Hassan Okoro",
    stage: "Won",
    owner: "L. Gomez",
    value: "₦6.5M",
    status: "won",
  },
];

const CRM_TASKS: CrmTask[] = [
  { id: "TASK-01", title: "Send pricing deck to Nova Retail", due: "Today · 2 PM", assignee: "S. Patel", status: "due" },
  { id: "TASK-02", title: "Schedule EMEA compliance call", due: "Today · 4 PM", assignee: "D. Ibarra", status: "upcoming" },
  { id: "TASK-03", title: "Log APAC rollout notes", due: "Tomorrow", assignee: "M. Byrne", status: "upcoming" },
];

const CRM_ENGAGEMENTS: CrmEngagement[] = [
  {
    id: "ENG-01",
    title: "Discovery call completed",
    detail: "Helios Parts · 45 min",
    timestamp: "1h ago",
    channel: "call",
  },
  {
    id: "ENG-02",
    title: "Proposal emailed",
    detail: "Nova Retail · Contracting",
    timestamp: "3h ago",
    channel: "email",
  },
  {
    id: "ENG-03",
    title: "Demo scheduled",
    detail: "Bright Innovations · Tomorrow 10a",
    timestamp: "Yesterday",
    channel: "meeting",
  },
];

const CRM_STATUS_META: Record<CrmLead["status"], { label: string; chip: string; dot: string }> = {
  overdue: { label: "Overdue", chip: "bg-rose-50 text-rose-600", dot: "bg-rose-500" },
  pending: { label: "Pending", chip: "bg-amber-50 text-amber-600", dot: "bg-amber-500" },
  won: { label: "Won", chip: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" },
};

const CRM_REMINDERS: CrmReminder[] = [
  { id: "REM-01", label: "Follow up Nova Retail", dueAt: new Date().toISOString(), slaSeconds: 7200 },
  { id: "REM-02", label: "SLA risk · Tembea Steel", dueAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), slaSeconds: 3600 },
];

const CRM_CUSTOMERS: CrmCustomerView[] = [
  {
    id: "CUST-001",
    name: "Nova Retail",
    region: "emea",
    branch: "lagos",
    owner: "Sara Bello",
    status: "Active",
    contactName: "Sara Bello",
    contactEmail: "sara@nova.io",
    contactPhone: "+234 801 555 9988",
  },
  {
    id: "CUST-002",
    name: "Helios Grid",
    region: "apac",
    branch: "nairobi",
    owner: "Marcus Lee",
    status: "Onboarding",
    contactName: "Marcus Lee",
    contactEmail: "marcus@heliosgrid.com",
    contactPhone: "+254 701 222 445",
  },
  {
    id: "CUST-003",
    name: "Tembea Steel",
    region: "americas",
    branch: "houston",
    owner: "Joan Adu",
    status: "Churn risk",
    contactName: "Joan Adu",
    contactEmail: "joan@tembea.steel",
    contactPhone: "+1 713 555 9000",
  },
];

const CRM_CHARTS_BASELINE: CrmChartSnapshot = {
  funnel: [
    { stage: "New", value: 120 },
    { stage: "Qualified", value: 80 },
    { stage: "Proposal", value: 48 },
    { stage: "Negotiation", value: 30 },
    { stage: "Converted", value: 18 },
  ],
  revenueByOfficer: [
    { officer: "Officer 1", value: 120000 },
    { officer: "Officer 2", value: 86000 },
    { officer: "Officer 3", value: 54000 },
  ],
  lostReasons: [
    { reason: "Budget", count: 12 },
    { reason: "Timeline", count: 6 },
    { reason: "No decision", count: 4 },
  ],
};

const CRM_BASELINE_SNAPSHOT: CrmSnapshot = {
  metrics: CRM_METRICS,
  leads: CRM_LEADS,
  tasks: CRM_TASKS,
  engagements: CRM_ENGAGEMENTS,
  reminders: CRM_REMINDERS,
  charts: CRM_CHARTS_BASELINE,
  customers: CRM_CUSTOMERS,
};

const FINANCE_TREND_BASELINE: FinanceTrendSnapshot = {
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

const DEFAULT_FINANCE_CURRENCY = "₦";

const FINANCE_CASH_ACCOUNTS_BASELINE: FinanceCashAccount[] = [
  {
    id: "ACC-01",
    name: "Zenith Treasury",
    type: "bank",
    balance: "₦312.4M",
    currency: "₦",
    trend: "up",
    change: "+₦8.2M vs last week",
    region: "Global",
  },
  {
    id: "ACC-02",
    name: "Ecobank Ops",
    type: "bank",
    balance: "₦148.0M",
    currency: "₦",
    trend: "down",
    change: "-₦3.6M vs last week",
    region: "EMEA",
  },
  {
    id: "ACC-03",
    name: "Cash-in-Transit",
    type: "cash",
    balance: "₦42.6M",
    currency: "₦",
    trend: "up",
    change: "+₦1.4M vs last week",
    region: "APAC",
  },
];

const FINANCE_EXPENSE_BREAKDOWN_BASELINE: FinanceExpenseBreakdown[] = [
  { label: "Cloud infrastructure", amount: "₦48.2M", delta: "+6.4%", direction: "up" },
  { label: "Logistics + freight", amount: "₦34.6M", delta: "-2.1%", direction: "down" },
  { label: "Payroll", amount: "₦128.9M", delta: "+1.2%", direction: "up" },
  { label: "Vendors & services", amount: "₦26.4M", delta: "-3.8%", direction: "down" },
];

const FINANCE_BASELINE_SNAPSHOT: FinanceSnapshot = {
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
  const params = new URLSearchParams({ tenantSlug: tenantSlug ?? "kreatix-default", timeframe });
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
  params.set("timeframe", timeframe);

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

const INVOICE_QUEUE: InvoiceRow[] = [
  {
    id: "INV-98231",
    vendor: "Apex Suppliers",
    amount: "$184,200",
    channel: "NetSuite",
    eta: "12m",
    status: "ready",
    notes: "3-way match complete",
  },
  {
    id: "INV-98244",
    vendor: "Forge Parts",
    amount: "$96,440",
    channel: "Coupa",
    eta: "45m",
    status: "variance",
    notes: "Tax variance flagged",
  },
  {
    id: "INV-98257",
    vendor: "Atlas Metals",
    amount: "$62,010",
    channel: "SAP",
    eta: "1h 12m",
    status: "hold",
    notes: "Awaiting compliance",
  },
  {
    id: "INV-98273",
    vendor: "Helix Freight",
    amount: "$48,870",
    channel: "QuickBooks",
    eta: "28m",
    status: "ready",
    notes: "Payment run S-14",
  },
];

const DEAL_PIPELINE: DealOpportunity[] = [
  {
    name: "Kreatix Metals",
    stage: "Diligence",
    value: "$18.2M",
    owner: "D. Ibarra",
    probability: 68,
    region: "EMEA",
  },
  {
    name: "Nova Retail",
    stage: "Contracting",
    value: "$11.4M",
    owner: "S. Patel",
    probability: 54,
    region: "APAC",
  },
  {
    name: "Axiom Mobility",
    stage: "Sourcing",
    value: "$6.8M",
    owner: "L. Gomez",
    probability: 41,
    region: "AMER",
  },
  {
    name: "Helios Parts",
    stage: "Negotiation",
    value: "$22.6M",
    owner: "M. Byrne",
    probability: 73,
    region: "Global",
  },
];

const APPROVAL_ROUTES: ApprovalRoute[] = [
  {
    name: "Finance · CapEx ladder",
    pending: 6,
    owners: ["Aria S.", "Myra L."],
    updated: "8m ago",
    eta: "2h SLA",
  },
  {
    name: "Legal · Vendor onboarding",
    pending: 4,
    owners: ["Khalid P.", "Nita R."],
    updated: "22m ago",
    eta: "45m",
    critical: true,
  },
  {
    name: "HR · Global policy",
    pending: 8,
    owners: ["D. Ibarra"],
    updated: "1h ago",
    eta: "6h",
  },
];

const ALERT_FEED: AlertItem[] = [
  {
    label: "Payroll queue saturation",
    detail: "NA payroll connector retrying",
    severity: "critical",
    timestamp: "Active now",
  },
  {
    label: "Webhook latency",
    detail: "Billing events lagging by 2.8m",
    severity: "warning",
    timestamp: "12 min ago",
  },
  {
    label: "Policy evidence expiring",
    detail: "SOC Type II package needs refresh",
    severity: "info",
    timestamp: "56 min ago",
  },
  {
    label: "Regional approval reroutes",
    detail: "EMEA policy toggled to OPS",
    severity: "warning",
    timestamp: "1 hr ago",
  },
];

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

const KPI_METRICS: KpiMetric[] = [
  {
    label: "Invoices cleared",
    value: "1,284",
    delta: "+12.4%",
    trend: "up",
    description: "Since last 7 days",
  },
  {
    label: "Deals in diligence",
    value: "$38.2M",
    delta: "+4.1%",
    trend: "up",
    description: "Avg. daily volume",
  },
  {
    label: "Payroll readiness",
    value: "98.1%",
    delta: "-1.4%",
    trend: "down",
    description: "Cutoff in 36h",
  },
  {
    label: "Critical alerts",
    value: "7",
    delta: "+2",
    trend: "down",
    description: "Cleared past hour",
  },
];

const LIVE_PANELS: LiveOperationPanel[] = [
  {
    title: "Invoice stream",
    countLabel: "224 ready for sync",
    primaryColor: "border-l-4 border-emerald-300",
    pills: ["NetSuite", "Sync pending"],
    items: [
      {
        title: "PO-44819",
        meta: "Apex Suppliers",
        supporting: "$184K · Aging 12h",
        statusColor: "text-emerald-600",
      },
      {
        title: "PO-44820",
        meta: "Forge Parts",
        supporting: "$96K · Aging 4h",
        statusColor: "text-emerald-600",
      },
      {
        title: "PO-44821",
        meta: "Atlas Metals",
        supporting: "$62K · Aging 36h",
        statusColor: "text-amber-500",
      },
    ],
  },
  {
    title: "Approvals",
    countLabel: "18 routing",
    primaryColor: "border-l-4 border-sky-300",
    pills: ["Finance", "Ops"],
    items: [
      {
        title: "Expansion budget",
        meta: "Subsidiary · EMEA",
        supporting: "Step 2 of 4",
        statusColor: "text-sky-600",
      },
      {
        title: "HR policy update",
        meta: "Global · Legal",
        supporting: "Pending CFO",
        statusColor: "text-sky-600",
      },
      {
        title: "Supplier onboarding",
        meta: "APAC · Ops",
        supporting: "Awaiting security",
        statusColor: "text-amber-500",
      },
    ],
  },
  {
    title: "System alerts",
    countLabel: "5 SLA risk",
    primaryColor: "border-l-4 border-rose-300",
    pills: ["SLA", "Latency"],
    items: [
      {
        title: "Webhook lag",
        meta: "Billing · 2.8m",
        supporting: "Auto-mitigated",
        statusColor: "text-rose-500",
      },
      {
        title: "Payroll queue",
        meta: "NA Payroll",
        supporting: "Manual override",
        statusColor: "text-rose-500",
      },
      {
        title: "Contract sync",
        meta: "CRM connector",
        supporting: "Retrying",
        statusColor: "text-amber-500",
      },
    ],
  },
];

const ACTIVITY_LOG = [
  {
    title: "Invoice batch posted",
    detail: "NetSuite · 248 docs",
    timestamp: "8 min ago",
    tone: "emerald" as const,
  },
  {
    title: "EMEA approvals rerouted",
    detail: "Policy change by D. Ibarra",
    timestamp: "14 min ago",
    tone: "sky" as const,
  },
  {
    title: "SLA breach mitigated",
    detail: "API latency normalized",
    timestamp: "23 min ago",
    tone: "rose" as const,
  },
  {
    title: "Security review completed",
    detail: "SOC evidence bundle",
    timestamp: "1 hr ago",
    tone: "slate" as const,
  },
];

const TIMEFRAME_OPTIONS = ["Last 24 hours", "Last 7 days", "Last 30 days"];

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
  const [crmActionType, setCrmActionType] = useState<CrmActionType | null>(null);
  const [crmActionToast, setCrmActionToast] = useState<string | null>(null);
  const [crmView, setCrmView] = useState<CrmView>("dashboard");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImportingContacts, setIsImportingContacts] = useState(false);
  const [contactImportSample, setContactImportSample] = useState<CrmContactImportSampleState>(defaultContactImportSample());
  const [importedContacts, setImportedContacts] = useState<CrmImportedContact[]>([]);
  const [contactTagFilter, setContactTagFilter] = useState<string | null>(null);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);

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
                contactEmail: contact.email || undefined,
                contactPhone: contact.phone || undefined,
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

  useEffect(() => {
    if (!crmActionToast) {
      return;
    }
    const timeout = window.setTimeout(() => setCrmActionToast(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [crmActionToast]);

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
}: {
  snapshot: FinanceSnapshot;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  cashAccounts: FinanceCashAccount[];
  cashAccountsLoading: boolean;
  cashAccountsError: string | null;
  onRefreshAccounts: () => void;
}) {
  const quickActions: Array<{ label: string; description: string; icon: ComponentType<{ className?: string }> }> = [
    { label: "Log invoice", description: "Sync to ERP", icon: Receipt },
    { label: "Schedule payment", description: "Route approval", icon: CalendarClock },
    { label: "Record expense", description: "Attach memo", icon: FileSpreadsheet },
    { label: "Trigger payout", description: "Treasury mesh", icon: PiggyBank },
  ];

  return (
    <div className="space-y-8">
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
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:border-slate-300"
                type="button"
              >
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
        <FinanceScheduleCard title="Receivables radar" items={snapshot.receivables} accent="text-emerald-600" />
        <FinanceScheduleCard title="Payables runway" items={snapshot.payables} accent="text-amber-600" />
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
    </div>
  );
}

function FinanceScheduleCard({
  title,
  items,
  accent,
}: {
  title: string;
  items: FinanceScheduleItem[];
  accent: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{title}</p>
          <p className="text-sm text-slate-500">Multi-entity status</p>
        </div>
        <div className={`rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold ${accent}`}>{items.length} entries</div>
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
