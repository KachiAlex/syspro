"use client";

import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Command,
  FileText,
  Globe2,
  Layers3,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users2,
  Zap,
} from "lucide-react";
import { Fragment, useMemo, useState } from "react";
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

const NAVIGATION: NavigationSection[] = [
  {
    label: "Operations",
    links: [
      { label: "Command Center", key: "command-center", icon: LayoutDashboard },
      { label: "Live Runs", key: "live-runs", icon: Zap, badge: "42" },
      { label: "Approvals", key: "approvals", icon: CheckCircle2 },
      { label: "Case Queue", key: "case-queue", icon: MessageSquare },
    ],
  },
  {
    label: "Automation",
    links: [
      { label: "Journeys", key: "journeys", icon: Layers3 },
      { label: "Workflows", key: "workflows", icon: ClipboardList },
      { label: "Runbooks", key: "runbooks", icon: FileText },
    ],
  },
  {
    label: "Analytics",
    links: [
      { label: "Insights", key: "insights", icon: Activity },
      { label: "Dashboards", key: "dashboards", icon: Globe2 },
    ],
  },
  {
    label: "Admin",
    links: [
      { label: "Directory", key: "directory", icon: Users2 },
      { label: "Integrations", key: "integrations", icon: ShieldCheck },
      { label: "Settings", key: "settings", icon: Settings },
    ],
  },
];

const ACTIVITY_TONE_CLASSES: Record<(typeof ACTIVITY_LOG)[number]["tone"], string> = {
  emerald: "bg-emerald-400",
  sky: "bg-sky-400",
  rose: "bg-rose-400",
  slate: "bg-slate-400",
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

const MODULE_TABS = ["Overview", "Policies", "Automation", "Audit"];

const TIMEFRAME_OPTIONS = ["Last 24 hours", "Last 7 days", "Last 30 days"];

export default function TenantAdminPage() {
  const [activeNav, setActiveNav] = useState("command-center");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState("Axiom Labs");
  const [selectedRegion, setSelectedRegion] = useState("Global HQ");
  const [selectedTimeframe, setSelectedTimeframe] = useState(TIMEFRAME_OPTIONS[1]);

  const entityOptions = ["Axiom Labs", "Nova Holdings", "Helix Metals"];
  const regionOptions = ["Global HQ", "Americas", "EMEA", "APAC"];

  const headline = useMemo(() => {
    switch (activeNav) {
      case "command-center":
        return "Operations Command Center";
      case "live-runs":
        return "Live automation runs";
      case "approvals":
        return "Approval orchestration";
      default:
        return "Tenant admin";
    }
  }, [activeNav]);

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

                <div className="flex flex-col gap-8 xl:flex-row">
                  <div className="flex-1 space-y-8">
                    <LiveOperations panels={LIVE_PANELS} />
                    <ModuleScaffold />
                  </div>
                  <div className="w-full xl:w-[28rem]">
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

function ModuleScaffold() {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm shadow-slate-200/60">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Reusable module shell</p>
          <h2 className="text-xl font-semibold text-slate-900">Policies · Automation · Audits</h2>
        </div>
        <div className="flex gap-2">
          {MODULE_TABS.map((tab) => (
            <button
              key={tab}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                tab === "Overview"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 text-slate-600"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Filters</p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p className="flex items-center justify-between">
              Geography <span className="rounded-full bg-white px-3 py-1">EMEA</span>
            </p>
            <p className="flex items-center justify-between">
              Module <span className="rounded-full bg-white px-3 py-1">Finance</span>
            </p>
            <p className="flex items-center justify-between">
              Persona <span className="rounded-full bg-white px-3 py-1">Ops</span>
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Primary view</p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> SLA exceptions
            </p>
            <p className="flex items-center gap-2">
              <Users2 className="h-4 w-4 text-slate-500" /> Stakeholders
            </p>
            <p className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" /> Automation health
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Actions</p>
          <div className="mt-3 flex flex-col gap-2">
            <button className="inline-flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600">
              Launch workflow <ChevronRight className="h-4 w-4" />
            </button>
            <button className="inline-flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600">
              Export bundle <ArrowUpRight className="h-4 w-4" />
            </button>
            <button className="inline-flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600">
              Share context <Users2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
