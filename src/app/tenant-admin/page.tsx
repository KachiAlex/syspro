"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BellRing,
  Building2,
  ChevronDown,
  Globe2,
  Grid2X2,
  Layers3,
  Shield,
  Users2,
} from "lucide-react";
import { Panel, SectionHeading, Tag } from "@/components/ui/primitives";

const MOCK_REGIONS = ["Global", "Africa", "Europe", "North America"];
const REGION_KEY_MAP = {
  Global: "global",
  Africa: "africa",
  Europe: "europe",
  "North America": "northAmerica",
} as const;

const NAV_LINKS = [
  { label: "Overview", description: "KPIs & alerts" },
  { label: "Organization", description: "Hierarchy" },
  { label: "Subsidiaries", description: "Legal entities" },
  { label: "Regions", description: "Policies" },
  { label: "Modules", description: "Feature flags" },
  { label: "Billing", description: "Subscriptions" },
  { label: "Integrations", description: "APIs" },
  { label: "Security", description: "Audit" },
];

const TIMEFRAME_OPTIONS = [
  { label: "Month to date", value: "mtd" },
  { label: "Quarter to date", value: "qtd" },
  { label: "Year to date", value: "ytd" },
] as const;

type TimeframeKey = (typeof TIMEFRAME_OPTIONS)[number]["value"];
type RegionKey = (typeof REGION_KEY_MAP)[keyof typeof REGION_KEY_MAP];

type SnapshotBundle = {
  subsidiaries: number;
  subsidiariesContext: string;
  regions: number;
  regionsContext: string;
  branches: number;
  branchesContext: string;
  employees: number;
  employeesContext: string;
  modulesActive: number;
  modulesTotal: number;
  modulesContext: string;
  monthlyCost: number;
  billingContext: string;
};

type KpiRow = {
  title: string;
  detail: string;
};

type MetricSet = {
  snapshot: SnapshotBundle;
  kpis: KpiRow[];
};

const METRIC_DATA: Record<RegionKey, Record<TimeframeKey, MetricSet>> = {
  global: {
    mtd: {
      snapshot: {
        subsidiaries: 8,
        subsidiariesContext: "+2 QoQ",
        regions: 24,
        regionsContext: "6 continents",
        branches: 143,
        branchesContext: "18 countries",
        employees: 18402,
        employeesContext: "Global headcount",
        modulesActive: 11,
        modulesTotal: 14,
        modulesContext: "ERP suite",
        monthlyCost: 482000,
        billingContext: "Next bill · Feb 1",
      },
      kpis: [
        { title: "Workforce distribution", detail: "Africa 28% · Europe 24% · NAM 18% · LATAM 11%" },
        { title: "Revenue per region", detail: "West Africa +14% · DACH +8% · ANZ -3%" },
        { title: "Active projects", detail: "Branches with >5 programs: Nairobi, Frankfurt, Atlanta" },
        { title: "Support tickets", detail: "APAC backlog down 23% after automation rollout" },
        { title: "Attendance & HR", detail: "Global PTO burn 62% of allocation · 4 audits due" },
      ],
    },
    qtd: {
      snapshot: {
        subsidiaries: 9,
        subsidiariesContext: "+1 onboarding",
        regions: 25,
        regionsContext: "Added LATAM south",
        branches: 151,
        branchesContext: "+4 greenfield",
        employees: 19210,
        employeesContext: "+4% QoQ",
        modulesActive: 12,
        modulesTotal: 14,
        modulesContext: "Finance pilot live",
        monthlyCost: 505000,
        billingContext: "Next bill · Apr 1",
      },
      kpis: [
        { title: "Workforce distribution", detail: "Africa 26% · Europe 27% · NAM 19%" },
        { title: "Revenue per region", detail: "MEA +12% · NAM +6% · APAC +3%" },
        { title: "Active projects", detail: "Global PMO overseeing 312 initiatives" },
        { title: "Support tickets", detail: "Avg SLA 43m · automation covering 41%" },
        { title: "Attendance & HR", detail: "Attrition 7.2% · mobility 11 transfers" },
      ],
    },
    ytd: {
      snapshot: {
        subsidiaries: 11,
        subsidiariesContext: "Target 13",
        regions: 27,
        regionsContext: "Expanding MENA",
        branches: 165,
        branchesContext: "+12 since Jan",
        employees: 20550,
        employeesContext: "+11% YoY",
        modulesActive: 12,
        modulesTotal: 14,
        modulesContext: "ITSM + LMS staged",
        monthlyCost: 518000,
        billingContext: "Next bill · Jul 1",
      },
      kpis: [
        { title: "Workforce distribution", detail: "Africa 24% · Europe 29% · NAM 20%" },
        { title: "Revenue per region", detail: "Europe 42% share · Africa fastest growth" },
        { title: "Active projects", detail: "Strategic programs: 48 · Local rollouts: 126" },
        { title: "Support tickets", detail: "Global CSAT 4.6 · Automation deflected 61%" },
        { title: "Attendance & HR", detail: "Compliance training 88% complete" },
      ],
    },
  },
  africa: {
    mtd: {
      snapshot: {
        subsidiaries: 3,
        subsidiariesContext: "Core markets",
        regions: 7,
        regionsContext: "West/East/South",
        branches: 38,
        branchesContext: "+1 Kigali",
        employees: 5200,
        employeesContext: "+6% YoY",
        modulesActive: 10,
        modulesTotal: 14,
        modulesContext: "HR + Finance core",
        monthlyCost: 98000,
        billingContext: "Next bill · Jan 28",
      },
      kpis: [
        { title: "Workforce distribution", detail: "Nigeria 34% · Kenya 26% · Ghana 18%" },
        { title: "Revenue per region", detail: "West Africa +18% · East +9%" },
        { title: "Active projects", detail: "12 ERP rollouts across logistics" },
        { title: "Support tickets", detail: "Automation deflecting 37% of HR cases" },
        { title: "Attendance & HR", detail: "Overtime trending 4% below cap" },
      ],
    },
    qtd: {
      snapshot: {
        subsidiaries: 3,
        subsidiariesContext: "Expanding francophone",
        regions: 8,
        regionsContext: "Added Sahel cluster",
        branches: 45,
        branchesContext: "Target 52",
        employees: 5425,
        employeesContext: "+3.8%",
        modulesActive: 11,
        modulesTotal: 14,
        modulesContext: "Projects module piloting",
        monthlyCost: 104000,
        billingContext: "Next bill · Mar 28",
      },
      kpis: [
        { title: "Workforce distribution", detail: "Anglophone 62% · Francophone 38%" },
        { title: "Revenue per region", detail: "Distribution margin +240 bps" },
        { title: "Active projects", detail: "Six ESG initiatives with PMO" },
        { title: "Support tickets", detail: "Avg SLA 38m · 5 escalations" },
        { title: "Attendance & HR", detail: "Leave compliance 91%" },
      ],
    },
    ytd: {
      snapshot: {
        subsidiaries: 4,
        subsidiariesContext: "New energy JV",
        regions: 9,
        regionsContext: "Central hub ready",
        branches: 58,
        branchesContext: "Build-out funded",
        employees: 5870,
        employeesContext: "+7.6% YoY",
        modulesActive: 12,
        modulesTotal: 14,
        modulesContext: "ITSM live",
        monthlyCost: 111000,
        billingContext: "Next bill · Jun 28",
      },
      kpis: [
        { title: "Workforce distribution", detail: "Ops 48% · Corporate 19% · Tech 33%" },
        { title: "Revenue per region", detail: "Energy services outperform plan +11%" },
        { title: "Active projects", detail: "24 modernization programs" },
        { title: "Support tickets", detail: "Self-service adoption 63%" },
        { title: "Attendance & HR", detail: "Training completion 92%" },
      ],
    },
  },
  europe: {
    mtd: {
      snapshot: {
        subsidiaries: 2,
        subsidiariesContext: "DACH & Nordics",
        regions: 5,
        regionsContext: "EU regulated",
        branches: 26,
        branchesContext: "3 compliance hubs",
        employees: 4200,
        employeesContext: "Stable headcount",
        modulesActive: 11,
        modulesTotal: 14,
        modulesContext: "Finance + Projects",
        monthlyCost: 132000,
        billingContext: "Next bill · Feb 4",
      },
      kpis: [
        { title: "Workforce distribution", detail: "Germany 41% · Sweden 22%" },
        { title: "Revenue per region", detail: "Tier-1 clients +9% pipeline" },
        { title: "Active projects", detail: "31 manufacturing digitization" },
        { title: "Support tickets", detail: "ISO incident log clean" },
        { title: "Attendance & HR", detail: "Union compliance 100%" },
      ],
    },
    qtd: {
      snapshot: {
        subsidiaries: 3,
        subsidiariesContext: "Southern EU entry",
        regions: 6,
        regionsContext: "UK onboarding",
        branches: 31,
        branchesContext: "+2 labs",
        employees: 4380,
        employeesContext: "+4%",
        modulesActive: 12,
        modulesTotal: 14,
        modulesContext: "CRM enablement",
        monthlyCost: 145000,
        billingContext: "Next bill · Apr 4",
      },
      kpis: [
        { title: "Workforce distribution", detail: "Consulting 48% · Delivery 39%" },
        { title: "Revenue per region", detail: "Recurring ARR +12%" },
        { title: "Active projects", detail: "Digital twins across 9 plants" },
        { title: "Support tickets", detail: "Critical issues 0 · SLA 36m" },
        { title: "Attendance & HR", detail: "Hybrid compliance 86%" },
      ],
    },
    ytd: {
      snapshot: {
        subsidiaries: 3,
        subsidiariesContext: "Benelux pending",
        regions: 7,
        regionsContext: "CEE integration",
        branches: 36,
        branchesContext: "Post-merger",
        employees: 4620,
        employeesContext: "+9% YoY",
        modulesActive: 12,
        modulesTotal: 14,
        modulesContext: "ITSM roll-out",
        monthlyCost: 151000,
        billingContext: "Next bill · Jul 4",
      },
      kpis: [
        { title: "Workforce distribution", detail: "Tech 44% · Ops 31% · G&A 25%" },
        { title: "Revenue per region", detail: "High-margin services 38% mix" },
        { title: "Active projects", detail: "Sustainability roadmap 7 regions" },
        { title: "Support tickets", detail: "Audit controls pass 99.2%" },
        { title: "Attendance & HR", detail: "Professional dev 74% uptake" },
      ],
    },
  },
  northAmerica: {
    mtd: {
      snapshot: {
        subsidiaries: 2,
        subsidiariesContext: "US + Canada",
        regions: 4,
        regionsContext: "East/West",
        branches: 29,
        branchesContext: "+1 Dallas",
        employees: 3700,
        employeesContext: "Contract mix 22%",
        modulesActive: 9,
        modulesTotal: 14,
        modulesContext: "Finance scaling",
        monthlyCost: 121000,
        billingContext: "Next bill · Jan 30",
      },
      kpis: [
        { title: "Workforce distribution", detail: "US East 46% · US West 29%" },
        { title: "Revenue per region", detail: "Enterprise SaaS +17%" },
        { title: "Active projects", detail: "Client onboarding factory 18 streams" },
        { title: "Support tickets", detail: "Escalations 3 (finance)" },
        { title: "Attendance & HR", detail: "Hybrid policy adherence 91%" },
      ],
    },
    qtd: {
      snapshot: {
        subsidiaries: 2,
        subsidiariesContext: "Mexico JV exploring",
        regions: 4,
        regionsContext: "Stable",
        branches: 33,
        branchesContext: "Partner pods",
        employees: 3890,
        employeesContext: "+5%",
        modulesActive: 10,
        modulesTotal: 14,
        modulesContext: "Projects + CRM",
        monthlyCost: 134000,
        billingContext: "Next bill · Mar 30",
      },
      kpis: [
        { title: "Workforce distribution", detail: "US 82% · Canada 18%" },
        { title: "Revenue per region", detail: "SLED vertical +11%" },
        { title: "Active projects", detail: "Cloud migrations 27 clients" },
        { title: "Support tickets", detail: "Backlog cleared weekly" },
        { title: "Attendance & HR", detail: "Voluntary exits 3.1%" },
      ],
    },
    ytd: {
      snapshot: {
        subsidiaries: 3,
        subsidiariesContext: "Mexico JV signed",
        regions: 5,
        regionsContext: "LATAM pilot",
        branches: 41,
        branchesContext: "Field offices",
        employees: 4180,
        employeesContext: "+12% YoY",
        modulesActive: 11,
        modulesTotal: 14,
        modulesContext: "LMS adoption",
        monthlyCost: 149000,
        billingContext: "Next bill · Jun 30",
      },
      kpis: [
        { title: "Workforce distribution", detail: "US 74% · Canada 16% · MX 10%" },
        { title: "Revenue per region", detail: "Cross-border programs +22%" },
        { title: "Active projects", detail: "Client success pods 44 squads" },
        { title: "Support tickets", detail: "Automation 58% deflection" },
        { title: "Attendance & HR", detail: "Onboarding NPS 72" },
      ],
    },
  },
};

const integerFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compactFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const ALERTS = [
  {
    title: "Branch setup pending",
    detail: "Kigali logistics plays waiting for finance approval",
  },
  {
    title: "License usage",
    detail: "Treasury seats at 96% capacity in EMEA",
  },
  {
    title: "Compliance audit",
    detail: "GDPR evidence package required for Paris branch",
  },
];

function NavLink({ label, description, active }: { label: string; description: string; active?: boolean }) {
  return (
    <button
      className={`flex flex-col rounded-2xl border px-4 py-3 text-left transition ${
        active
          ? "border-white/40 bg-white/10 text-white"
          : "border-white/10 text-white/70 hover:border-white/20 hover:text-white"
      }`}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-xs text-white/60">{description}</span>
    </button>
  );
}

function SnapshotCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Panel variant="glass" className="space-y-1">
      <p className="text-xs uppercase tracking-[0.35em] text-white/50">{label}</p>
      <p className="text-2xl font-semibold text-white">{value}</p>
      <p className="text-xs text-white/60">{sub}</p>
    </Panel>
  );
}

export default function TenantAdminPage() {
  const [region, setRegion] = useState(MOCK_REGIONS[0]);
  const [timeframe, setTimeframe] = useState<TimeframeKey>(TIMEFRAME_OPTIONS[0].value);
  const [metricState, setMetricState] = useState<MetricSet>(() => METRIC_DATA.global.mtd);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);

  const normalizedRegion: RegionKey = useMemo(() => {
    const key = REGION_KEY_MAP[region as keyof typeof REGION_KEY_MAP];
    return key ?? "global";
  }, [region]);

  useEffect(() => {
    setIsLoadingMetrics(true);
    const handle = setTimeout(() => {
      const dataset = METRIC_DATA[normalizedRegion]?.[timeframe] ?? METRIC_DATA.global.mtd;
      setMetricState(dataset);
      setIsLoadingMetrics(false);
    }, 220);

    return () => clearTimeout(handle);
  }, [normalizedRegion, timeframe]);

  const snapshotCards = useMemo(() => {
    const snapshot = metricState.snapshot;

    return [
      {
        label: "Subsidiaries",
        value: integerFormatter.format(snapshot.subsidiaries).padStart(2, "0"),
        sub: snapshot.subsidiariesContext,
      },
      {
        label: "Regions",
        value: integerFormatter.format(snapshot.regions),
        sub: snapshot.regionsContext,
      },
      {
        label: "Branches",
        value: integerFormatter.format(snapshot.branches),
        sub: snapshot.branchesContext,
      },
      {
        label: "Employees",
        value: compactFormatter.format(snapshot.employees),
        sub: snapshot.employeesContext,
      },
      {
        label: "Active modules",
        value: `${snapshot.modulesActive}/${snapshot.modulesTotal}`,
        sub: snapshot.modulesContext,
      },
      {
        label: "Monthly cost",
        value: currencyFormatter.format(snapshot.monthlyCost),
        sub: snapshot.billingContext,
      },
    ];
  }, [metricState.snapshot]);

  return (
    <div className="min-h-screen bg-[#03030c] text-white">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-[#42e9e0]/20 via-transparent to-transparent" />
        <div
          className="absolute left-[-15%] top-1/3 h-80 w-80 rounded-full blur-[180px]"
          style={{ background: "rgba(110, 91, 255, 0.35)" }}
        />
      </div>

      <main className="mx-auto flex max-w-7xl gap-6 px-4 py-10 lg:px-10">
        <aside className="hidden w-64 flex-col gap-6 lg:flex">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.35em] text-white/50">Region switcher</p>
            <button className="mt-3 flex w-full items-center justify-between rounded-2xl border border-white/20 bg-black/20 px-4 py-3 text-sm font-semibold">
              <span>{region}</span>
              <ChevronDown className="h-4 w-4" />
            </button>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/60">
              {MOCK_REGIONS.slice(1).map((option) => (
                <button
                  key={option}
                  onClick={() => setRegion(option)}
                  className={`rounded-full border px-3 py-1 ${
                    region === option ? "border-white text-white" : "border-white/15 hover:border-white/40"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <nav className="flex flex-col gap-3">
            {NAV_LINKS.map((link, idx) => (
              <NavLink key={link.label} {...link} active={idx === 0} />
            ))}
          </nav>
        </aside>

        <section className="flex-1 space-y-8">
          <header className="rounded-[40px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <Tag tone="teal">Tenant admin</Tag>
                <h1 className="text-3xl font-semibold tracking-tight">Command the entire organization</h1>
                <p className="text-sm text-white/70">
                  Define subsidiaries, regulate modules, control billing, and grant access—all inside one canonical
                  workspace for your tenant super admins.
                </p>
                <div className="flex flex-wrap gap-3 text-xs text-white/60">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5">
                    <Globe2 className="h-3.5 w-3.5" /> Global overview
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5">
                    <Layers3 className="h-3.5 w-3.5" /> Hierarchy builder
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5">
                    <Shield className="h-3.5 w-3.5" /> Audit-ready
                  </span>
                </div>
              </div>
              <div className="grid gap-3 text-sm text-white/70">
                <button className="flex items-center justify-center gap-2 rounded-2xl border border-white/30 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em]">
                  <Grid2X2 className="h-4 w-4" /> Switch branch
                </button>
                <button className="group flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 font-semibold text-[#04040a]">
                  Open approvals
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </button>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-white/50">
              <span className="text-white/70">Breadcrumbs:</span>
              <span className="text-white">Kreatix Holdings</span>
              <span>/</span>
              <span className="text-white/80">{region}</span>
              <span>/</span>
              <span className="text-white/50">All subsidiaries</span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/60">
              <span className="text-white/70">Reporting window:</span>
              <div className="flex flex-wrap gap-2">
                {TIMEFRAME_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className={`rounded-full border px-3 py-1.5 transition ${
                      timeframe === option.value
                        ? "border-white bg-white/10 text-white"
                        : "border-white/20 text-white/60 hover:border-white/40"
                    }`}
                    onClick={() => setTimeframe(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <span className="flex items-center gap-2 text-white/40">
                <span className={`h-2 w-2 rounded-full ${isLoadingMetrics ? "bg-amber-300 animate-pulse" : "bg-emerald-300"}`} />
                {isLoadingMetrics ? "Refreshing metrics" : "Synced 4m ago"}
              </span>
            </div>
          </header>

          <section
            className={`grid gap-4 md:grid-cols-2 xl:grid-cols-3 ${isLoadingMetrics ? "opacity-60 transition" : ""}`}
          >
            {snapshotCards.map((card) => (
              <SnapshotCard key={card.label} {...card} />
            ))}
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <Panel variant="glass" className="space-y-6">
              <SectionHeading
                eyebrow="Executive KPIs"
                title="Global performance snapshot"
                description="Track people, revenue, delivery, and support across every region."
              />
              <div className={`space-y-4 ${isLoadingMetrics ? "opacity-60" : ""}`}>
                {metricState.kpis.map((row) => (
                  <div key={row.title} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm font-semibold text-white">{row.title}</p>
                    <p className="text-xs text-white/60">{row.detail}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel variant="glass" className="space-y-4">
              <SectionHeading eyebrow="Alerts" title="What needs attention" description="24h operations feed" />
              <div className="space-y-3">
                {ALERTS.map((alert) => (
                  <div key={alert.title} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm">
                    <BellRing className="mt-0.5 h-5 w-5 text-amber-300" />
                    <div>
                      <p className="font-semibold text-white">{alert.title}</p>
                      <p className="text-xs text-white/60">{alert.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <Panel variant="glass" className="space-y-6">
              <SectionHeading
                eyebrow="Hierarchy"
                title="Global org blueprint"
                description="Tenant → Subsidiary → Region → Branch"
              />
              <div className="rounded-3xl border border-dashed border-white/20 bg-black/10 p-6 text-sm text-white/70">
                Drag-and-drop tree builder placeholder. We will inject the interactive org canvas in the next phase.
                Include color-coded nodes, activation toggles, and manager avatars.
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-white/60">
                  <p className="text-white">Next steps</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    <li>Integrate real hierarchy data</li>
                    <li>Support activate/deactivate toggles</li>
                    <li>Assign regional managers inline</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-white/60">
                  <p className="text-white">Upcoming builders</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    <li>Subsidiary configuration</li>
                    <li>Region policy designer</li>
                    <li>Approval flow editor</li>
                  </ul>
                </div>
              </div>
            </Panel>

            <Panel variant="glass" className="space-y-6">
              <SectionHeading eyebrow="Roadmap" title="Tenant admin backlog" description="Phase 0 scaffolding" />
              <ol className="space-y-3 text-sm text-white/70">
                <li className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="font-semibold text-white">Phase 1 · Executive data</p>
                  <p className="text-xs text-white/60">Wire KPIs to live APIs, add filtering controls, expose export actions.</p>
                </li>
                <li className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="font-semibold text-white">Phase 2 · Org builder</p>
                  <p className="text-xs text-white/60">Add drag/drop tree, node creation modals, and reporting-line visuals.</p>
                </li>
                <li className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="font-semibold text-white">Phase 3 · Controls</p>
                  <p className="text-xs text-white/60">Subsidiary + module management panes, RBAC mapping, and billing overlays.</p>
                </li>
              </ol>
            </Panel>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <Panel variant="glass" className="space-y-3">
              <SectionHeading eyebrow="Quick actions" title="Admin shortcuts" description="One-click ops" />
              <div className="grid gap-3 text-sm">
                <button className="flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-left text-white/80 hover:border-white/40">
                  <Building2 className="h-4 w-4" /> Create subsidiary
                </button>
                <button className="flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-left text-white/80 hover:border-white/40">
                  <Users2 className="h-4 w-4" /> Assign branch head
                </button>
                <button className="flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-left text-white/80 hover:border-white/40">
                  <Shield className="h-4 w-4" /> Configure MFA policy
                </button>
              </div>
            </Panel>
            <Panel variant="glass" className="space-y-3">
              <SectionHeading eyebrow="Integrations" title="Connected services" description="API status" />
              <div className="space-y-2 text-sm text-white/70">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <span>Payment gateway</span>
                  <span className="text-emerald-300">Live</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <span>Email service</span>
                  <span className="text-amber-300">Rate limits</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <span>LMS provider</span>
                  <span className="text-rose-300">Attention</span>
                </div>
              </div>
            </Panel>
            <Panel variant="glass" className="space-y-3">
              <SectionHeading eyebrow="Security" title="Compliance posture" description="Live checks" />
              <div className="space-y-2 text-sm text-white/60">
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <Shield className="h-4 w-4 text-emerald-300" /> MFA enforced tenant-wide
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <Globe2 className="h-4 w-4 text-sky-300" /> Data residency: EU West, us-east
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <Shield className="h-4 w-4 text-amber-200" /> Audit logs syncing to compliance lake
                </div>
              </div>
            </Panel>
          </section>
        </section>
      </main>
    </div>
  );
}

