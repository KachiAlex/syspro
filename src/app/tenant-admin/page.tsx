"use client";

import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bot,
  ClipboardList,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Command,
  CreditCard,
  Gauge,
  GitBranch,
  Handshake,
  Headphones,
  Layers3,
  KanbanSquare,
  LayoutDashboard,
  Megaphone,
  Menu,
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
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";

type NavigationLink = {
  label: string;
  key: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string;
};

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
      { label: "Billing", key: "billing", icon: CreditCard },
      { label: "Integrations", key: "integrations", icon: PlugZap },
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

  const entityOptions = ["Axiom Labs", "Nova Holdings", "Helix Metals"];
  const regionOptions = ["Global HQ", "Americas", "EMEA", "APAC"];

  const headline = useMemo(() => HEADLINE_MAP[activeNav] ?? "Tenant admin", [activeNav]);

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
                <KpiGrid metrics={KPI_METRICS} />

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
              </div>
            </section>
          </main>
        </div>
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
