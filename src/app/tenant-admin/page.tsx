"use client";

import { ChangeEvent, DragEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BellRing,
  Building2,
  ChevronDown,
  GripVertical,
  Globe2,
  Grid2X2,
  Layers3,
  Loader2,
  Plus,
  Shield,
  ShieldCheck,
  Shuffle,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  UserRound,
  Users2,
  X,
} from "lucide-react";
import { Panel, SectionHeading, Tag } from "@/components/ui/primitives";
import { FALLBACK_ORG_TREE, OrgNode, OrgNodeType, ORG_NODE_STATUSES, ORG_NODE_TYPES } from "@/lib/org-tree";

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


function findNodeById(node: OrgNode, id: string): OrgNode | null {
  if (node.id === id) {
    return node;
  }
  if (!node.children) {
    return null;
  }
  for (const child of node.children) {
    const match = findNodeById(child, id);
    if (match) {
      return match;
    }
  }
  return null;
}

function collectDescendantsOfType(node: OrgNode, targetType: OrgNodeType, acc: OrgNode[] = []): OrgNode[] {
  node.children?.forEach((child) => {
    if (child.type === targetType) {
      acc.push(child);
    }
    collectDescendantsOfType(child, targetType, acc);
  });
  return acc;
}

const NODE_TYPE_ORDER: OrgNodeType[] = [...ORG_NODE_TYPES];
const MODULE_LIBRARY = ["HR", "Finance", "Projects", "CRM", "ITSM", "LMS"];
const MODULE_PAYLOAD_LIMIT = 12;
const REGION_ACCENTS: Record<string, { pill: string; halo: string }> = {
  global: { pill: "border-sky-400/40 bg-sky-400/10 text-sky-100", halo: "shadow-sky-500/20" },
  africa: { pill: "border-emerald-400/50 bg-emerald-400/10 text-emerald-100", halo: "shadow-emerald-500/20" },
  europe: { pill: "border-indigo-400/50 bg-indigo-400/10 text-indigo-100", halo: "shadow-indigo-500/20" },
  "north america": { pill: "border-cyan-400/50 bg-cyan-400/10 text-cyan-100", halo: "shadow-cyan-500/20" },
  "south america": { pill: "border-orange-400/50 bg-orange-400/10 text-orange-100", halo: "shadow-orange-500/20" },
  "middle east": { pill: "border-amber-400/50 bg-amber-400/10 text-amber-100", halo: "shadow-amber-500/20" },
  asia: { pill: "border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-100", halo: "shadow-fuchsia-500/20" },
  "asia-pacific": { pill: "border-pink-400/50 bg-pink-400/10 text-pink-100", halo: "shadow-pink-500/20" },
};
const DEFAULT_REGION_ACCENT = { pill: "border-white/10 text-white/70", halo: "" };

function getRegionAccent(region?: string) {
  if (!region) {
    return DEFAULT_REGION_ACCENT;
  }
  const key = region.toLowerCase();
  return REGION_ACCENTS[key] ?? DEFAULT_REGION_ACCENT;
}
type OrgColumn = { type: OrgNodeType; nodes: OrgNode[]; anchorName: string };
type ChildBreakdown = { type: OrgNodeType; nodes: OrgNode[] } | null;

type NodeModalMode = "create" | "edit" | "delete";
type NodeModalState = { mode: NodeModalMode; contextNode: OrgNode } | null;
type NodeModalForm = {
  name: string;
  manager: string;
  status: OrgNode["status"];
  region: string;
  timezone: string;
  headcount: string;
  modules: string[];
  type: OrgNodeType;
};

type SubsidiaryFormState = {
  legalEntity: string;
  taxId: string;
  currency: string;
  timezone: string;
  brandColor: string;
  autonomy: string;
};

type RegionPolicyFormState = {
  policy: string;
  escalation: string;
  residency: string;
};

type CountryFormState = {
  taxRate: string;
  holidays: string;
  payroll: string;
};

type BranchFormState = {
  code: string;
  address: string;
  siteLead: string;
  hours: string;
  compliance: string;
};

type FormInputEvent = ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

type NodeOverrideKey = "status" | "manager" | "modules" | "metadata" | "timezone";

const DEFAULT_MODAL_FORM: NodeModalForm = {
  name: "",
  manager: "",
  status: "Planning",
  region: "",
  timezone: "",
  headcount: "",
  modules: [],
  type: "subsidiary",
};

const DEFAULT_SUBSIDIARY_FORM: SubsidiaryFormState = {
  legalEntity: "",
  taxId: "",
  currency: "USD",
  timezone: "GMT",
  brandColor: "#0ea5e9",
  autonomy: "standard",
};

const DEFAULT_REGION_POLICY_FORM: RegionPolicyFormState = {
  policy: "",
  escalation: "",
  residency: "",
};

const DEFAULT_COUNTRY_FORM: CountryFormState = {
  taxRate: "",
  holidays: "",
  payroll: "",
};

const DEFAULT_BRANCH_FORM: BranchFormState = {
  code: "",
  address: "",
  siteLead: "",
  hours: "",
  compliance: "",
};

function toFormValue(node: OrgNode): NodeModalForm {
  return {
    name: node.name,
    manager: node.manager,
    status: node.status,
    region: node.region ?? "",
    timezone: node.timezone ?? "",
    headcount: node.headcount ? String(node.headcount) : "",
    modules: node.modules ?? [],
    type: node.type,
  };
}

const NODE_TYPE_LABELS: Record<OrgNodeType, string> = {
  tenant: "Tenant",
  subsidiary: "Subsidiaries",
  region: "Regions",
  country: "Countries",
  branch: "Branches",
  department: "Departments",
  team: "Teams",
};

const STATUS_TONES: Record<OrgNode["status"], string> = {
  Live: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  Planning: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  Paused: "border-rose-400/30 bg-rose-400/10 text-rose-200",
};

function flattenTree(node: OrgNode, acc: OrgNode[] = []): OrgNode[] {
  acc.push(node);
  node.children?.forEach((child) => flattenTree(child, acc));
  return acc;
}

function findLineage(node: OrgNode, targetId: string, path: OrgNode[] = []): OrgNode[] | null {
  const nextPath = [...path, node];
  if (node.id === targetId) {
    return nextPath;
  }
  if (!node.children) {
    return null;
  }
  for (const child of node.children) {
    const candidate = findLineage(child, targetId, nextPath);
    if (candidate) {
      return candidate;
    }
  }
  return null;
}

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

function OrgNodeCard({
  node,
  selected,
  onSelect,
  partOfLineage,
  dragSource,
  dragTarget,
  draggable,
  droppable,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
}: {
  node: OrgNode;
  selected?: boolean;
  partOfLineage?: boolean;
  dragSource?: boolean;
  dragTarget?: boolean;
  draggable?: boolean;
  droppable?: boolean;
  onSelect: (node: OrgNode) => void;
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnter?: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: () => void;
  onDrop?: (event: DragEvent<HTMLButtonElement>) => void;
}) {
  const tone = STATUS_TONES[node.status];
  const regionAccent = getRegionAccent(node.region);
  const surfaceClasses = selected
    ? "border-emerald-400/70 bg-white/10 shadow-lg shadow-emerald-500/20"
    : dragSource
    ? "border-emerald-400/60 bg-emerald-400/10"
    : dragTarget
    ? "border-amber-400/50 bg-amber-400/10"
    : partOfLineage
    ? "border-white/40 bg-white/5"
    : "border-white/10 bg-black/20 hover:border-white/30";

  return (
    <button
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnter={(event) => {
        if (!droppable) {
          return;
        }
        onDragEnter?.(event);
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        if (droppable) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        if (!droppable) {
          return;
        }
        event.preventDefault();
        onDrop?.(event);
      }}
      onClick={() => onSelect(node)}
      className={`w-full rounded-3xl border px-4 py-4 text-left text-sm transition ${surfaceClasses}`}
    >
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-white/50">
        <span className="inline-flex items-center gap-1 text-white/70">
          {draggable ? <GripVertical className="h-3.5 w-3.5 text-white/40" /> : null}
          {NODE_TYPE_LABELS[node.type]}
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${tone}`}>{node.status}</span>
      </div>
      <p className="mt-2 text-base font-semibold text-white">{node.name}</p>
      <p className="text-xs text-white/60">{node.manager}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/60">
        {node.region ? <span className={`rounded-full border px-3 py-1 ${regionAccent.pill}`}>{node.region}</span> : null}
        {typeof node.headcount === "number" ? (
          <span className="rounded-full border border-white/10 px-3 py-1">{node.headcount.toLocaleString()} people</span>
        ) : null}
        {node.modules?.slice(0, 2).map((module) => (
          <span key={module} className="rounded-full border border-white/10 px-3 py-1">
            {module}
          </span>
        ))}
      </div>
    </button>
  );
}

export default function TenantAdminPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const initialRegion = useMemo(() => {
    const param = searchParams.get("region");
    return param && MOCK_REGIONS.includes(param) ? param : MOCK_REGIONS[0];
  }, [searchParams]);

  const initialTimeframe = useMemo<TimeframeKey>(() => {
    const param = searchParams.get("timeframe") as TimeframeKey | null;
    const valid = TIMEFRAME_OPTIONS.some((option) => option.value === param);
    return valid && param ? param : TIMEFRAME_OPTIONS[0].value;
  }, [searchParams]);

  const initialNodeId = useMemo(() => {
    const param = searchParams.get("node");
    return param && findNodeById(FALLBACK_ORG_TREE, param) ? param : FALLBACK_ORG_TREE.id;
  }, [searchParams]);

  const [region, setRegion] = useState(initialRegion);
  const [timeframe, setTimeframe] = useState<TimeframeKey>(initialTimeframe);
  const [metricState, setMetricState] = useState<MetricSet>(() => METRIC_DATA.global.mtd);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [orgTree, setOrgTree] = useState<OrgNode>(FALLBACK_ORG_TREE);
  const [isOrgLoading, setIsOrgLoading] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState(initialNodeId);
  const [nodeOverrides, setNodeOverrides] = useState<Record<string, Partial<Pick<OrgNode, "status" | "manager" | "modules" | "metadata" | "timezone">>>>(
    {}
  );
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [nodeModal, setNodeModal] = useState<NodeModalState>(null);
  const [modalForm, setModalForm] = useState<NodeModalForm>(DEFAULT_MODAL_FORM);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [dragPreview, setDragPreview] = useState<{ sourceId: string; targetId: string | null } | null>(null);
  const [orgReloadKey, setOrgReloadKey] = useState(0);
  const [subsidiaryFocusId, setSubsidiaryFocusId] = useState<string | null>(null);
  const [subsidiaryForm, setSubsidiaryForm] = useState(DEFAULT_SUBSIDIARY_FORM);
  const [isSubsidiarySaving, setIsSubsidiarySaving] = useState(false);
  const [regionFocusId, setRegionFocusId] = useState<string | null>(null);
  const [regionPolicyForm, setRegionPolicyForm] = useState(DEFAULT_REGION_POLICY_FORM);
  const [isRegionSaving, setIsRegionSaving] = useState(false);
  const [countryFocusId, setCountryFocusId] = useState<string | null>(null);
  const [countryForm, setCountryForm] = useState(DEFAULT_COUNTRY_FORM);
  const [isCountrySaving, setIsCountrySaving] = useState(false);
  const [branchFocusId, setBranchFocusId] = useState<string | null>(null);
  const [branchForm, setBranchForm] = useState(DEFAULT_BRANCH_FORM);
  const [isBranchSaving, setIsBranchSaving] = useState(false);

  const updateSearchParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (!value) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const handleRegionChange = useCallback(
    (value: string) => {
      setRegion(value);
      updateSearchParams({ region: value });
    },
    [updateSearchParams]
  );

  const handleTimeframeChange = useCallback(
    (value: TimeframeKey) => {
      setTimeframe(value);
      updateSearchParams({ timeframe: value });
    },
    [updateSearchParams]
  );

  const handleNodeSelect = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      updateSearchParams({ node: nodeId });
    },
    [updateSearchParams]
  );

  const flattenedTree = useMemo(() => {
    const bucket: OrgNode[] = [];
    flattenTree(orgTree, bucket);
    return bucket;
  }, [orgTree]);

  const subsidiaries = useMemo(() => flattenedTree.filter((node) => node.type === "subsidiary").map((node) => getDecoratedNode(node)), [flattenedTree, getDecoratedNode]);
  const regions = useMemo(() => flattenedTree.filter((node) => node.type === "region").map((node) => getDecoratedNode(node)), [flattenedTree, getDecoratedNode]);
  const countries = useMemo(() => flattenedTree.filter((node) => node.type === "country").map((node) => getDecoratedNode(node)), [flattenedTree, getDecoratedNode]);
  const branches = useMemo(() => flattenedTree.filter((node) => node.type === "branch").map((node) => getDecoratedNode(node)), [flattenedTree, getDecoratedNode]);

  const subsidiaryFocusNode = useMemo(() => subsidiaries.find((node) => node.id === subsidiaryFocusId) ?? null, [subsidiaries, subsidiaryFocusId]);
  const regionFocusNode = useMemo(() => regions.find((node) => node.id === regionFocusId) ?? null, [regions, regionFocusId]);
  const countryFocusNode = useMemo(() => countries.find((node) => node.id === countryFocusId) ?? null, [countries, countryFocusId]);
  const branchFocusNode = useMemo(() => branches.find((node) => node.id === branchFocusId) ?? null, [branches, branchFocusId]);

  useEffect(() => {
    if (subsidiaries.length === 0) {
      if (subsidiaryFocusId) {
        setSubsidiaryFocusId(null);
      }
      setSubsidiaryForm(DEFAULT_SUBSIDIARY_FORM);
      return;
    }
    if (!subsidiaryFocusId || !subsidiaries.some((node) => node.id === subsidiaryFocusId)) {
      const first = subsidiaries[0];
      setSubsidiaryFocusId(first.id);
      setSubsidiaryForm(toSubsidiaryForm(first));
    }
  }, [subsidiaries, subsidiaryFocusId]);

  useEffect(() => {
    if (regions.length === 0) {
      if (regionFocusId) {
        setRegionFocusId(null);
      }
      setRegionPolicyForm(DEFAULT_REGION_POLICY_FORM);
      return;
    }
    if (!regionFocusId || !regions.some((node) => node.id === regionFocusId)) {
      const first = regions[0];
      setRegionFocusId(first.id);
      setRegionPolicyForm(toRegionPolicyForm(first));
    }
  }, [regions, regionFocusId]);

  useEffect(() => {
    if (countries.length === 0) {
      if (countryFocusId) {
        setCountryFocusId(null);
      }
      setCountryForm(DEFAULT_COUNTRY_FORM);
      return;
    }
    if (!countryFocusId || !countries.some((node) => node.id === countryFocusId)) {
      const first = countries[0];
      setCountryFocusId(first.id);
      setCountryForm(toCountryForm(first));
    }
  }, [countries, countryFocusId]);

  useEffect(() => {
    if (branches.length === 0) {
      if (branchFocusId) {
        setBranchFocusId(null);
      }
      setBranchForm(DEFAULT_BRANCH_FORM);
      return;
    }
    if (!branchFocusId || !branches.some((node) => node.id === branchFocusId)) {
      const first = branches[0];
      setBranchFocusId(first.id);
      setBranchForm(toBranchForm(first));
    }
  }, [branches, branchFocusId]);

  const applyNodeOverride = useCallback((nodeId: string, patch: Partial<Pick<OrgNode, "status" | "manager" | "modules" | "metadata" | "timezone">>) => {
    setNodeOverrides((prev) => ({
      ...prev,
      [nodeId]: {
        ...prev[nodeId],
        ...patch,
      },
    }));
  }, []);

  const getDecoratedNode = useCallback(
    (node: OrgNode): OrgNode => ({
      ...node,
      ...(nodeOverrides[node.id] ?? {}),
    }),
    [nodeOverrides]
  );

  const selectedNode = useMemo(() => getDecoratedNode(findNodeById(orgTree, selectedNodeId) ?? orgTree), [
    getDecoratedNode,
    orgTree,
    selectedNodeId,
  ]);
  const rawLineage = useMemo(() => findLineage(orgTree, selectedNodeId) ?? [orgTree], [orgTree, selectedNodeId]);
  const lineage = useMemo(() => rawLineage.map((node) => getDecoratedNode(node)), [rawLineage, getDecoratedNode]);
  const lineageSet = useMemo(() => new Set(lineage.map((node) => node.id)), [lineage]);

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

  useEffect(() => {
    let abort = false;
    let attempts = 0;

    async function loadTree() {
      setIsOrgLoading(true);
      setOrgError(null);

      while (!abort && attempts < 3) {
        attempts += 1;
        try {
          const response = await fetch("/api/tenant/org-structure", { cache: "no-store" });
          if (!response.ok) {
            throw new Error(`Request failed with ${response.status}`);
          }
          const data = await response.json();
          if (!data?.tree) {
            throw new Error("Malformed response");
          }
          if (abort) {
            return;
          }
          setOrgTree(data.tree as OrgNode);
          setNodeOverrides({});
          setIsOrgLoading(false);
          return;
        } catch (error) {
          if (attempts >= 3) {
            const message = error instanceof Error ? error.message : "Unknown error";
            setOrgError(`Unable to load org structure: ${message}`);
            setOrgTree(FALLBACK_ORG_TREE);
            setNodeOverrides({});
            setIsOrgLoading(false);
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 300 * attempts));
        }
      }
    }

    loadTree();

    return () => {
      abort = true;
    };
  }, [orgReloadKey]);

  const handleOrgReload = useCallback(() => {
    setOrgReloadKey((prev) => prev + 1);
  }, []);

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

  const orgColumns = useMemo<OrgColumn[]>(() => {
    return NODE_TYPE_ORDER.map((type, index) => {
      if (index === 0) {
        return { type, nodes: [getDecoratedNode(orgTree)], anchorName: "Global tenant" };
      }

      const parentType = NODE_TYPE_ORDER[index - 1];
      const ancestorFromLineage = [...lineage].reverse().find((node) => node.type === parentType);
      const fallbackAnchor = flattenedTree.find((node) => node.type === parentType) ?? null;
      const anchor = ancestorFromLineage ?? fallbackAnchor;

      const nodes = anchor?.children?.filter((child: OrgNode) => child.type === type) ?? [];

      return {
        type,
        nodes: nodes.map((node) => getDecoratedNode(node)),
        anchorName: anchor?.name ?? NODE_TYPE_LABELS[parentType],
      };
    });
  }, [lineage, flattenedTree, getDecoratedNode, orgTree]);

  const selectedSummary = useMemo(() => {
    return [
      {
        label: "Node type",
        value: NODE_TYPE_LABELS[selectedNode.type],
        sub: "Scope",
      },
      {
        label: "Headcount",
        value: selectedNode.headcount ? selectedNode.headcount.toLocaleString() : "—",
        sub: "People within node",
      },
      {
        label: "Timezone",
        value: selectedNode.timezone ?? "Multi-regional",
        sub: "Operating window",
      },
    ];
  }, [selectedNode]);

  const childBreakdown = useMemo<ChildBreakdown>(() => {
    const nextTypeIndex = NODE_TYPE_ORDER.indexOf(selectedNode.type) + 1;
    const nextType = NODE_TYPE_ORDER[nextTypeIndex];
    if (!nextType || !selectedNode.children) {
      return null;
    }
    const nodes = selectedNode.children
      .filter((node) => node.type === nextType)
      .map((node) => getDecoratedNode(node));
    return { type: nextType, nodes };
  }, [selectedNode, getDecoratedNode]);

  const effectiveModules = useMemo(() => {
    const override = nodeOverrides[selectedNode.id]?.modules;
    return override ?? selectedNode.modules ?? [];
  }, [nodeOverrides, selectedNode]);

  const selectedNodeLevel = useMemo(() => NODE_TYPE_ORDER.indexOf(selectedNode.type), [selectedNode.type]);
  const canCreateChild = selectedNodeLevel >= 0 && selectedNodeLevel < NODE_TYPE_ORDER.length - 1;
  const canDeleteSelected = selectedNodeLevel > 0;
  const nextChildType = canCreateChild ? NODE_TYPE_ORDER[selectedNodeLevel + 1] : null;
  const dragSourceNode = useMemo(() => (dragPreview ? findNodeById(orgTree, dragPreview.sourceId) : null), [dragPreview, orgTree]);
  const dragTargetNode = useMemo(
    () => (dragPreview?.targetId ? findNodeById(orgTree, dragPreview.targetId) : null),
    [dragPreview, orgTree]
  );

  const handleStatusChange = useCallback(
    (status: OrgNode["status"]) => {
      setActionToast(status === "Live" ? "Node activated" : status === "Paused" ? "Node suspended" : "Status updated");
      applyNodeOverride(selectedNode.id, { status });
      const previous = selectedNode.status;
      fetch("/api/tenant/org-structure", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: selectedNode.id, updates: { status } }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed with ${response.status}`);
          }
        })
        .catch((error) => {
          console.error("Status mutation failed", error);
          applyNodeOverride(selectedNode.id, { status: previous });
          setActionToast("Failed to update status");
        })
        .finally(() => {
          setTimeout(() => setActionToast(null), 1500);
        });
    },
    [applyNodeOverride, selectedNode.id, selectedNode.status]
  );

  const handleManagerAssign = useCallback(() => {
    const suggestedManager = selectedNode.manager.includes("(acting)")
      ? selectedNode.manager.replace(" (acting)", "")
      : `${selectedNode.manager} (acting)`;
    const previous = selectedNode.manager;
    applyNodeOverride(selectedNode.id, { manager: suggestedManager });
    setActionToast("Assigning manager…");
    fetch("/api/tenant/org-structure", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId: selectedNode.id, updates: { manager: suggestedManager } }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed with ${response.status}`);
        }
        setActionToast("Manager updated");
      })
      .catch((error) => {
        console.error("Manager mutation failed", error);
        applyNodeOverride(selectedNode.id, { manager: previous });
        setActionToast("Failed to update manager");
      })
      .finally(() => setTimeout(() => setActionToast(null), 1500));
  }, [applyNodeOverride, selectedNode.id, selectedNode.manager]);

  const handleModuleToggle = useCallback(
    (module: string) => {
      const current = effectiveModules;
      const next = current.includes(module) ? current.filter((item) => item !== module) : [...current, module];
      if (next.length > MODULE_PAYLOAD_LIMIT) {
        setActionToast("Module limit reached");
        setTimeout(() => setActionToast(null), 1500);
        return;
      }
      const previous = current;
      applyNodeOverride(selectedNode.id, { modules: next });
      setActionToast(current.includes(module) ? `${module} disabled` : `${module} enabled`);
      fetch("/api/tenant/org-structure", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: selectedNode.id, updates: { modules: next } }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed with ${response.status}`);
          }
        })
        .catch((error) => {
          console.error("Module mutation failed", error);
          applyNodeOverride(selectedNode.id, { modules: previous });
          setActionToast("Failed to toggle module");
        })
        .finally(() => setTimeout(() => setActionToast(null), 1500));
    },
    [applyNodeOverride, effectiveModules, selectedNode.id]
  );

  const openNodeModal = useCallback(
    (mode: NodeModalMode, contextNode: OrgNode) => {
      setModalError(null);

      if (mode === "create") {
        const parentIndex = NODE_TYPE_ORDER.indexOf(contextNode.type);
        const nextType = NODE_TYPE_ORDER[parentIndex + 1];
        if (!nextType) {
          setActionToast("No child level available");
          setTimeout(() => setActionToast(null), 1500);
          return;
        }
        setModalForm({
          ...DEFAULT_MODAL_FORM,
          type: nextType,
        });
      } else {
        setModalForm(toFormValue(contextNode));
      }

      setNodeModal({ mode, contextNode });
    },
    [setActionToast]
  );

  const closeNodeModal = useCallback(() => {
    setNodeModal(null);
    setModalForm(DEFAULT_MODAL_FORM);
    setModalError(null);
    setModalLoading(false);
  }, []);

  const handleModalInputChange = useCallback((event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setModalForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const handleModalModuleToggle = useCallback((module: string) => {
    setModalForm((prev) => {
      const next = prev.modules.includes(module)
        ? prev.modules.filter((item) => item !== module)
        : [...prev.modules, module];
      if (next.length > MODULE_PAYLOAD_LIMIT) {
        setActionToast("Module cap reached");
        setTimeout(() => setActionToast(null), 1500);
        return prev;
      }
      return {
        ...prev,
        modules: next,
      };
    });
  }, [setActionToast]);

  const handleModalSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!nodeModal) {
        return;
      }
      setModalLoading(true);
      setModalError(null);
      try {
        if (nodeModal.mode === "delete") {
          const response = await fetch("/api/tenant/org-structure", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nodeId: nodeModal.contextNode.id }),
          });
          if (!response.ok) {
            throw new Error(`Failed with ${response.status}`);
          }
          const data = await response.json();
          if (data?.tree) {
            setOrgTree(data.tree as OrgNode);
          }
          closeNodeModal();
          setActionToast("Node removed");
          setTimeout(() => setActionToast(null), 1500);
          return;
        }

        const payload = nodeModal.mode === "create"
          ? {
              parentId: nodeModal.contextNode.id,
              node: {
                name: modalForm.name,
                manager: modalForm.manager,
                status: modalForm.status,
                region: modalForm.region || undefined,
                timezone: modalForm.timezone || undefined,
                headcount: modalForm.headcount ? Number(modalForm.headcount) : undefined,
                modules: modalForm.modules,
                type: modalForm.type,
              },
            }
          : {
              nodeId: nodeModal.contextNode.id,
              updates: {
                name: modalForm.name,
                manager: modalForm.manager,
                status: modalForm.status,
                region: modalForm.region || undefined,
                timezone: modalForm.timezone || undefined,
                headcount: modalForm.headcount ? Number(modalForm.headcount) : undefined,
                modules: modalForm.modules,
                type: modalForm.type,
              },
            };

        const response = await fetch("/api/tenant/org-structure", {
          method: nodeModal.mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Failed with ${response.status}`);
        }

        const data = await response.json();
        if (data?.tree) {
          setOrgTree(data.tree as OrgNode);
        }
        closeNodeModal();
        setActionToast(nodeModal.mode === "create" ? "Node created" : "Node updated");
        setTimeout(() => setActionToast(null), 1500);
      } catch (error) {
        console.error("Modal mutation failed", error);
        setModalError(error instanceof Error ? error.message : "Unable to save node");
        setModalLoading(false);
      }
    },
    [closeNodeModal, modalForm, nodeModal]
  );

  const handleSubsidiaryFocusChange = useCallback(
    (nodeId: string) => {
      const node = subsidiaries.find((candidate) => candidate.id === nodeId);
      if (!node) {
        return;
      }
      setSubsidiaryFocusId(node.id);
      setSubsidiaryForm(toSubsidiaryForm(node));
    },
    [subsidiaries]
  );

  const handleRegionFocusChange = useCallback(
    (nodeId: string) => {
      const node = regions.find((candidate) => candidate.id === nodeId);
      if (!node) {
        return;
      }
      setRegionFocusId(node.id);
      setRegionPolicyForm(toRegionPolicyForm(node));
    },
    [regions]
  );

  const handleCountryFocusChange = useCallback(
    (nodeId: string) => {
      const node = countries.find((candidate) => candidate.id === nodeId);
      if (!node) {
        return;
      }
      setCountryFocusId(node.id);
      setCountryForm(toCountryForm(node));
    },
    [countries]
  );

  const handleBranchFocusChange = useCallback(
    (nodeId: string) => {
      const node = branches.find((candidate) => candidate.id === nodeId);
      if (!node) {
        return;
      }
      setBranchFocusId(node.id);
      setBranchForm(toBranchForm(node));
    },
    [branches]
  );

  const handleSubsidiaryFormChange = useCallback((event: FormInputEvent) => {
    const { name, value } = event.target;
    setSubsidiaryForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const handleRegionFormChange = useCallback((event: FormInputEvent) => {
    const { name, value } = event.target;
    setRegionPolicyForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const handleCountryFormChange = useCallback((event: FormInputEvent) => {
    const { name, value } = event.target;
    setCountryForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const handleBranchFormChange = useCallback((event: FormInputEvent) => {
    const { name, value } = event.target;
    setBranchForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const handleSubsidiarySave = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!subsidiaryFocusNode) {
        return;
      }
      setIsSubsidiarySaving(true);
      const currentMetadata = { ...withMetadata(subsidiaryFocusNode) };
      const nextMetadata = {
        ...currentMetadata,
        legalEntity: subsidiaryForm.legalEntity,
        taxId: subsidiaryForm.taxId,
        currency: subsidiaryForm.currency,
        brandColor: subsidiaryForm.brandColor,
        autonomy: subsidiaryForm.autonomy,
      };
      const previous = { timezone: subsidiaryFocusNode.timezone, metadata: currentMetadata };
      applyNodeOverride(subsidiaryFocusNode.id, {
        timezone: subsidiaryForm.timezone,
        metadata: nextMetadata,
      });
      try {
        const response = await fetch("/api/tenant/org-structure", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodeId: subsidiaryFocusNode.id,
            updates: {
              timezone: subsidiaryForm.timezone,
              metadata: nextMetadata,
            },
          }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error ?? `Failed with ${response.status}`);
        }
        setActionToast("Subsidiary settings saved");
      } catch (error) {
        console.error("Subsidiary save failed", error);
        applyNodeOverride(subsidiaryFocusNode.id, previous);
        setActionToast(error instanceof Error ? error.message : "Unable to save subsidiary");
      } finally {
        setIsSubsidiarySaving(false);
        setTimeout(() => setActionToast(null), 1500);
      }
    },
    [applyNodeOverride, setActionToast, subsidiaryFocusNode, subsidiaryForm]
  );

  const handleRegionSave = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!regionFocusNode) {
        return;
      }
      setIsRegionSaving(true);
      const currentMetadata = { ...withMetadata(regionFocusNode) };
      const nextMetadata = {
        ...currentMetadata,
        policy: regionPolicyForm.policy,
        escalation: regionPolicyForm.escalation,
        residency: regionPolicyForm.residency,
      };
      const previous = { metadata: currentMetadata };
      applyNodeOverride(regionFocusNode.id, { metadata: nextMetadata });
      try {
        const response = await fetch("/api/tenant/org-structure", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodeId: regionFocusNode.id,
            updates: {
              metadata: nextMetadata,
            },
          }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error ?? `Failed with ${response.status}`);
        }
        setActionToast("Region policy updated");
      } catch (error) {
        console.error("Region save failed", error);
        applyNodeOverride(regionFocusNode.id, previous);
        setActionToast(error instanceof Error ? error.message : "Unable to save region policy");
      } finally {
        setIsRegionSaving(false);
        setTimeout(() => setActionToast(null), 1500);
      }
    },
    [applyNodeOverride, regionFocusNode, regionPolicyForm]
  );

  const handleCountrySave = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!countryFocusNode) {
        return;
      }
      setIsCountrySaving(true);
      const currentMetadata = { ...withMetadata(countryFocusNode) };
      const nextMetadata = {
        ...currentMetadata,
        taxRate: countryForm.taxRate,
        holidays: countryForm.holidays,
        payroll: countryForm.payroll,
      };
      const previous = { metadata: currentMetadata };
      applyNodeOverride(countryFocusNode.id, { metadata: nextMetadata });
      try {
        const response = await fetch("/api/tenant/org-structure", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodeId: countryFocusNode.id,
            updates: {
              metadata: nextMetadata,
            },
          }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error ?? `Failed with ${response.status}`);
        }
        setActionToast("Country profile updated");
      } catch (error) {
        console.error("Country save failed", error);
        applyNodeOverride(countryFocusNode.id, previous);
        setActionToast(error instanceof Error ? error.message : "Unable to save country settings");
      } finally {
        setIsCountrySaving(false);
        setTimeout(() => setActionToast(null), 1500);
      }
    },
    [applyNodeOverride, countryFocusNode, countryForm]
  );

  const handleBranchSave = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!branchFocusNode) {
        return;
      }
      setIsBranchSaving(true);
      const currentMetadata = { ...withMetadata(branchFocusNode) };
      const nextMetadata = {
        ...currentMetadata,
        code: branchForm.code,
        address: branchForm.address,
        siteLead: branchForm.siteLead,
        hours: branchForm.hours,
        compliance: branchForm.compliance,
      };
      const nextManager = branchForm.siteLead || branchFocusNode.manager;
      const previous = { manager: branchFocusNode.manager, metadata: currentMetadata };
      applyNodeOverride(branchFocusNode.id, {
        manager: nextManager,
        metadata: nextMetadata,
      });
      try {
        const response = await fetch("/api/tenant/org-structure", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodeId: branchFocusNode.id,
            updates: {
              manager: nextManager,
              metadata: nextMetadata,
            },
          }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error ?? `Failed with ${response.status}`);
        }
        setActionToast("Branch record saved");
      } catch (error) {
        console.error("Branch save failed", error);
        applyNodeOverride(branchFocusNode.id, previous);
        setActionToast(error instanceof Error ? error.message : "Unable to save branch");
      } finally {
        setIsBranchSaving(false);
        setTimeout(() => setActionToast(null), 1500);
      }
    },
    [applyNodeOverride, branchFocusNode, branchForm]
  );

  const isAncestor = useCallback(
    (ancestorId: string, nodeId: string) => {
      const lineagePath = findLineage(orgTree, nodeId);
      if (!lineagePath) {
        return false;
      }
      return lineagePath.some((node) => node.id === ancestorId);
    },
    [orgTree]
  );

  const canAcceptDrop = useCallback(
    (sourceId: string, targetId: string) => {
      if (!sourceId || !targetId || sourceId === targetId) {
        return false;
      }
      const sourceNode = findNodeById(orgTree, sourceId);
      const targetNode = findNodeById(orgTree, targetId);
      if (!sourceNode || !targetNode) {
        return false;
      }
      if (isAncestor(sourceId, targetId)) {
        return false;
      }
      const sourceIndex = NODE_TYPE_ORDER.indexOf(sourceNode.type);
      const targetIndex = NODE_TYPE_ORDER.indexOf(targetNode.type);
      if (sourceIndex <= 0 || targetIndex !== sourceIndex - 1) {
        return false;
      }
      return true;
    },
    [isAncestor, orgTree]
  );

  const handleNodeDragStart = useCallback(
    (node: OrgNode) => (event: DragEvent<HTMLButtonElement>) => {
      if (NODE_TYPE_ORDER.indexOf(node.type) === 0) {
        event.preventDefault();
        return;
      }
      setDragPreview({ sourceId: node.id, targetId: null });
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", node.id);
    },
    []
  );

  const handleNodeDragEnter = useCallback(
    (target: OrgNode) => (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (!dragPreview) {
        return;
      }
      if (canAcceptDrop(dragPreview.sourceId, target.id)) {
        setDragPreview({ sourceId: dragPreview.sourceId, targetId: target.id });
      } else {
        setDragPreview({ sourceId: dragPreview.sourceId, targetId: null });
      }
    },
    [canAcceptDrop, dragPreview]
  );

  const handleNodeDrop = useCallback(
    (target: OrgNode) => async (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const currentDrag = dragPreview;
      if (!currentDrag || !canAcceptDrop(currentDrag.sourceId, target.id)) {
        setDragPreview(null);
        return;
      }
      setActionToast("Moving node…");
      try {
        const response = await fetch("/api/tenant/org-structure", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodeId: currentDrag.sourceId, targetParentId: target.id }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error ?? `Failed with ${response.status}`);
        }
        if (data?.tree) {
          setOrgTree(data.tree as OrgNode);
          setNodeOverrides({});
        }
        setActionToast("Node moved");
      } catch (error) {
        console.error("Node move failed", error);
        setActionToast(error instanceof Error ? error.message : "Unable to move node");
      } finally {
        setDragPreview(null);
        setTimeout(() => setActionToast(null), 1500);
      }
    },
    [canAcceptDrop, dragPreview]
  );

  const handleNodeDragEnd = useCallback(() => {
    setDragPreview(null);
  }, []);

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
                  onClick={() => handleRegionChange(option)}
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
                    onClick={() => handleTimeframeChange(option.value)}
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

          <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
            <Panel variant="glass" className="space-y-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <SectionHeading
                  eyebrow="Hierarchy"
                  title="Global org blueprint"
                  description="Tenant → Subsidiary → Region → Branch"
                />
                <div className="flex flex-wrap gap-2 text-xs text-white/60">
                  <button
                    onClick={handleOrgReload}
                    className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1.5 text-white/70 hover:border-white/40"
                  >
                    <Loader2 className={`h-3.5 w-3.5 ${isOrgLoading ? "animate-spin" : "text-emerald-300"}`} />
                    Refresh tree
                  </button>
                  <span className="rounded-full border border-white/15 px-3 py-1.5">Manager avatars soon</span>
                  <span className="rounded-full border border-white/15 px-3 py-1.5">Module badges</span>
                </div>
              </div>

              {orgError ? (
                <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-100">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span>{orgError}</span>
                    <button
                      onClick={handleOrgReload}
                      className="rounded-full border border-rose-300/40 px-3 py-1 text-xs text-white hover:border-rose-200"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="rounded-3xl border border-white/10 bg-black/10 p-4">
                <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-white/60">
                  <span className="text-white/80">Lineage:</span>
                  {lineage.map((node, index) => (
                    <div key={node.id} className="flex items-center gap-2">
                      <button
                        className={`rounded-full border px-3 py-1 text-xs ${
                          selectedNodeId === node.id ? "border-emerald-400 text-emerald-200" : "border-white/20 text-white/60"
                        }`}
                        onClick={() => handleNodeSelect(node.id)}
                      >
                        {node.name}
                      </button>
                      {index < lineage.length - 1 ? <span className="text-white/30">→</span> : null}
                    </div>
                  ))}
                </div>
                {dragPreview ? (
                  <div className="mb-3 rounded-2xl border border-dashed border-emerald-400/40 bg-emerald-400/5 px-4 py-3 text-xs text-emerald-100">
                    {dragSourceNode ? dragSourceNode.name : "Node"}
                    {dragTargetNode ? ` → ${dragTargetNode.name}` : ""}
                    {!dragTargetNode ? " · drag over an eligible parent to drop" : ""}
                  </div>
                ) : null}
                <div className="overflow-x-auto pb-4">
                  <div className="flex min-w-full gap-4">
                    {orgColumns.map((column) => (
                      <div key={column.type} className="min-w-[220px] flex-1 rounded-3xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between text-xs text-white/60">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.3em]">{NODE_TYPE_LABELS[column.type]}</p>
                            <p className="text-sm text-white">{column.anchorName}</p>
                          </div>
                          <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-white/70">
                            {column.nodes.length}
                          </span>
                        </div>
                        <div className="mt-4 space-y-3">
                          {column.nodes.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-white/15 px-3 py-6 text-center text-xs text-white/40">
                              No nodes yet
                            </div>
                          ) : (
                            column.nodes.map((node) => (
                              <OrgNodeCard
                                key={node.id}
                                node={node}
                                selected={selectedNodeId === node.id}
                                partOfLineage={lineageSet.has(node.id)}
                                onSelect={(target) => handleNodeSelect(target.id)}
                              />
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel variant="glass" className="space-y-6">
              <SectionHeading eyebrow="Node context" title={selectedNode.name} description="Manager & scope overview" />
              <div className="flex flex-wrap gap-3 text-xs text-white/70">
                <button
                  onClick={() => handleStatusChange("Live")}
                  className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 ${
                    selectedNode.status === "Live" ? "border-emerald-300 bg-emerald-400/10 text-white" : "border-white/20 hover:border-white/40"
                  }`}
                >
                  <ToggleRight className="h-4 w-4" /> Activate
                </button>
                <button
                  onClick={() => handleStatusChange("Paused")}
                  className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 ${
                    selectedNode.status === "Paused" ? "border-rose-300 bg-rose-400/10 text-white" : "border-white/20 hover:border-white/40"
                  }`}
                >
                  <ToggleLeft className="h-4 w-4" /> Suspend
                </button>
                <button
                  onClick={() => handleStatusChange("Planning")}
                  className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 ${
                    selectedNode.status === "Planning" ? "border-amber-300 bg-amber-400/10 text-white" : "border-white/20 hover:border-white/40"
                  }`}
                >
                  <Sparkles className="h-4 w-4" /> Mark planning
                </button>
                <button
                  onClick={handleManagerAssign}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/20 px-4 py-2 hover:border-white/40"
                >
                  <UserRound className="h-4 w-4" /> Assign manager
                </button>
                <button
                  onClick={() => openNodeModal("create", selectedNode)}
                  disabled={!canCreateChild}
                  className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 ${
                    canCreateChild ? "border-emerald-300/50 text-white hover:border-emerald-300" : "border-white/10 text-white/40"
                  }`}
                >
                  <Plus className="h-4 w-4" /> {canCreateChild ? `Add ${nextChildType ? NODE_TYPE_LABELS[nextChildType] : "child"}` : "No child level"}
                </button>
                <button
                  onClick={() => openNodeModal("edit", selectedNode)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/25 px-4 py-2 text-white hover:border-white/50"
                >
                  <Grid2X2 className="h-4 w-4" /> Edit node
                </button>
                <button
                  onClick={() => openNodeModal("delete", selectedNode)}
                  disabled={!canDeleteSelected}
                  className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 ${
                    canDeleteSelected ? "border-rose-400/50 text-white hover:border-rose-300" : "border-white/10 text-white/40"
                  }`}
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </button>
              </div>

              <div className="grid gap-3 text-sm text-white/70">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-white">Manager</p>
                  <p className="text-xs text-white/60">{selectedNode.manager}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="flex items-center gap-2 text-white">
                    <ShieldCheck className="h-4 w-4" /> Module controls
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/60">
                    {MODULE_LIBRARY.map((module) => {
                      const active = effectiveModules.includes(module);
                      return (
                        <button
                          key={module}
                          onClick={() => handleModuleToggle(module)}
                          className={`rounded-full border px-3 py-1 transition ${
                            active ? "border-emerald-300 bg-emerald-400/10 text-white" : "border-white/15 hover:border-white/40"
                          }`}
                        >
                          {module}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-white">Summary</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {selectedSummary.map((item) => (
                      <div key={item.label} className="rounded-2xl border border-white/10 bg-black/10 p-3 text-xs text-white/60">
                        <p className="text-white">{item.value}</p>
                        <p>{item.label}</p>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">{item.sub}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="flex items-center gap-2 text-white">
                    <UserRound className="h-4 w-4" /> Reporting lines
                  </p>
                  <ol className="mt-3 space-y-3">
                    {lineage.map((node, index) => {
                      const accent = getRegionAccent(node.region);
                      return (
                        <li key={node.id} className={`rounded-2xl border border-white/10 px-3 py-2 ${accent.halo}`}>
                          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-white/40">
                            <span>{NODE_TYPE_LABELS[node.type]}</span>
                            <span className="text-white/50">{node.manager}</span>
                          </div>
                          <p className="text-sm font-semibold text-white">{node.name}</p>
                          {index < lineage.length - 1 ? <span className="text-xs text-white/40">↓ reports into</span> : <span className="text-xs text-emerald-300">Current focus</span>}
                        </li>
                      );
                    })}
                  </ol>
                </div>
                {childBreakdown ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-white">{NODE_TYPE_LABELS[childBreakdown.type]}</p>
                    <ul className="mt-3 space-y-2 text-sm">
                      {childBreakdown.nodes.map((node: OrgNode) => (
                        <li
                          key={node.id}
                          className="flex items-center justify-between rounded-2xl border border-white/10 px-3 py-2 text-white/70"
                        >
                          <span>{node.name}</span>
                          <button
                            className="text-xs text-emerald-300"
                            onClick={() => handleNodeSelect(node.id)}
                          >
                            Inspect →
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </Panel>
          </section>

          {isOrgLoading ? (
            <div className="rounded-3xl border border-emerald-400/30 bg-black/40 p-4 text-center text-xs text-white/60">
              Loading tenant structure…
            </div>
          ) : null}

          <section className="grid gap-6 lg:grid-cols-3">
            <Panel variant="glass" className="space-y-3">
              <SectionHeading eyebrow="Quick actions" title="Admin shortcuts" description="One-click ops" />
              <div className="grid gap-3 text-sm">
                <button
                  onClick={() => openNodeModal("create", selectedNode)}
                  className="flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-left text-white/80 hover:border-white/40"
                >
                  <Building2 className="h-4 w-4" /> Create subsidiary
                </button>
                <button
                  onClick={() => openNodeModal("edit", selectedNode)}
                  className="flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-left text-white/80 hover:border-white/40"
                >
                  <Users2 className="h-4 w-4" /> Assign branch head
                </button>
                <button
                  onClick={() => openNodeModal("delete", selectedNode)}
                  className="flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-left text-white/80 hover:border-white/40"
                >
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

          <section className="grid gap-6 xl:grid-cols-2">
            <Panel variant="glass" className="space-y-6">
              <SectionHeading eyebrow="Subsidiaries" title="Control legal entities" description="Edit autonomy, currency, and custodians" />
              <div className="flex flex-wrap gap-2 text-xs text-white/70">
                {subsidiaries.length === 0 ? (
                  <span className="rounded-full border border-white/15 px-3 py-1.5 text-white/60">No subsidiaries yet</span>
                ) : (
                  subsidiaries.map((node) => (
                    <button
                      key={node.id}
                      onClick={() => handleSubsidiaryFocusChange(node.id)}
                      className={`rounded-full border px-3 py-1.5 transition ${
                        subsidiaryFocusId === node.id ? "border-emerald-300 bg-emerald-400/10 text-white" : "border-white/15 text-white/60 hover:border-white/40"
                      }`}
                    >
                      {node.name}
                    </button>
                  ))
                )}
              </div>
              {subsidiaryFocusNode ? (
                <form onSubmit={handleSubsidiarySave} className="space-y-4 rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label>
                      <span className="text-xs uppercase tracking-[0.3em] text-white/40">Legal entity</span>
                      <input
                        name="legalEntity"
                        value={subsidiaryForm.legalEntity}
                        onChange={handleSubsidiaryFormChange}
                        className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-white"
                        required
                      />
                    </label>
                    <label>
                      <span className="text-xs uppercase tracking-[0.3em] text-white/40">Tax ID</span>
                      <input
                        name="taxId"
                        value={subsidiaryForm.taxId}
                        onChange={handleSubsidiaryFormChange}
                        className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-white"
                        placeholder="TIN-00293"
                      />
                    </label>
                    <label>
                      <span className="text-xs uppercase tracking-[0.3em] text-white/40">Currency</span>
                      <select
                        name="currency"
                        value={subsidiaryForm.currency}
                        onChange={handleSubsidiaryFormChange}
                        className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-white"
                      >
                        {SUBSIDIARY_CURRENCIES.map((currency) => (
                          <option key={currency} value={currency}>
                            {currency}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="text-xs uppercase tracking-[0.3em] text-white/40">Timezone</span>
                      <input
                        name="timezone"
                        value={subsidiaryForm.timezone}
                        onChange={handleSubsidiaryFormChange}
                        className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-white"
                        placeholder="GMT+1"
                      />
                    </label>
                    <label>
                      <span className="text-xs uppercase tracking-[0.3em] text-white/40">Brand color</span>
                      <input
                        type="color"
                        name="brandColor"
                        value={subsidiaryForm.brandColor}
                        onChange={handleSubsidiaryFormChange}
                        className="mt-1 h-11 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-2"
                      />
                    </label>
                    <label>
                      <span className="text-xs uppercase tracking-[0.3em] text-white/40">Autonomy</span>
                      <select
                        name="autonomy"
                        value={subsidiaryForm.autonomy}
                        onChange={handleSubsidiaryFormChange}
                        className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-white"
                      >
                        {SUBSIDIARY_AUTONOMY_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-white/60">
                    <span>Manager: <span className="text-white">{subsidiaryFocusNode.manager}</span></span>
                    <button
                      type="submit"
                      disabled={isSubsidiarySaving}
                      className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/70 bg-emerald-400/10 px-4 py-2 text-sm text-white"
                    >
                      {isSubsidiarySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Save subsidiary
                    </button>
                  </div>
                </form>
              ) : (
                <div className="rounded-3xl border border-dashed border-white/20 px-4 py-10 text-center text-sm text-white/60">
                  Create a subsidiary to start managing metadata.
                </div>
              )}
            </Panel>

            <Panel variant="glass" className="space-y-6">
              <SectionHeading eyebrow="Regions" title="Policy frameworks" description="Residency & escalation rules" />
              <div className="flex flex-wrap gap-2 text-xs text-white/70">
                {regions.length === 0 ? (
                  <span className="rounded-full border border-white/15 px-3 py-1.5 text-white/60">No regions yet</span>
                ) : (
                  regions.map((node) => (
                    <button
                      key={node.id}
                      onClick={() => handleRegionFocusChange(node.id)}
                      className={`rounded-full border px-3 py-1.5 transition ${
                        regionFocusId === node.id ? "border-sky-300 bg-sky-400/10 text-white" : "border-white/15 text-white/60 hover:border-white/40"
                      }`}
                    >
                      {node.name}
                    </button>
                  ))
                )}
              </div>
              {regionFocusNode ? (
                <form onSubmit={handleRegionSave} className="space-y-4 rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                  <label className="block">
                    <span className="text-xs uppercase tracking-[0.3em] text-white/40">Policy summary</span>
                    <textarea
                      name="policy"
                      value={regionPolicyForm.policy}
                      onChange={handleRegionFormChange}
                      className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-white"
                      rows={3}
                      placeholder="Payroll control, due diligence, etc"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-[0.3em] text-white/40">Escalation path</span>
                    <textarea
                      name="escalation"
                      value={regionPolicyForm.escalation}
                      onChange={handleRegionFormChange}
                      className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-white"
                      rows={2}
                      placeholder="Country ops → Regional COO → HQ"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-[0.3em] text-white/40">Residency requirements</span>
                    <textarea
                      name="residency"
                      value={regionPolicyForm.residency}
                      onChange={handleRegionFormChange}
                      className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-white"
                      rows={2}
                      placeholder="Data residency, regulatory units"
                    />
                  </label>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-white/60">
                    <span>Escalations routed to {regionFocusNode.manager}</span>
                    <button
                      type="submit"
                      disabled={isRegionSaving}
                      className="inline-flex items-center gap-2 rounded-2xl border border-sky-300/70 bg-sky-400/10 px-4 py-2 text-sm text-white"
                    >
                      {isRegionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />} Save region policy
                    </button>
                  </div>
                </form>
              ) : (
                <div className="rounded-3xl border border-dashed border-white/20 px-4 py-10 text-center text-sm text-white/60">
                  Add regions to configure policy frameworks.
                </div>
              )}
            </Panel>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <Panel variant="glass" className="space-y-6">
              <SectionHeading eyebrow="Countries" title="Local compliance" description="Tax rates, holidays, payroll" />
              <div className="flex flex-wrap gap-2 text-xs text-white/70">
                {countries.length === 0 ? (
                  <span className="rounded-full border border-white/15 px-3 py-1.5 text-white/60">No countries yet</span>
                ) : (
                  countries.map((node) => (
                    <button
                      key={node.id}
                      onClick={() => handleCountryFocusChange(node.id)}
                      className={`rounded-full border px-3 py-1.5 transition ${
                        countryFocusId === node.id ? "border-amber-300 bg-amber-400/10 text-white" : "border-white/15 text-white/60 hover:border-white/40"
                      }`}
                    >
                      {node.name}
                    </button>
                  ))
                )}
              </div>
              {countryFocusNode ? (
                <form onSubmit={handleCountrySave} className="space-y-4 rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                  <label>
                    <span className="text-xs uppercase tracking-[0.3em] text-white/40">Tax rate</span>
                    <input
                      name="taxRate"
                      value={countryForm.taxRate}
                      onChange={handleCountryFormChange}
                      className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-white"
                      placeholder="21% VAT"
                    />
                  </label>
                  <label>
                    <span className="text-xs uppercase tracking-[0.3em] text-white/40">Holidays</span>
                    <textarea
                      name="holidays"
                      value={countryForm.holidays}
                      onChange={handleCountryFormChange}
                      className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-white"
                      rows={3}
                      placeholder="Independence day, Labour day"
                    />
                  </label>
                  <label>
                    <span className="text-xs uppercase tracking-[0.3em] text-white/40">Payroll notes</span>
                    <textarea
                      name="payroll"
                      value={countryForm.payroll}
                      onChange={handleCountryFormChange}
                      className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-white"
                      rows={3}
                      placeholder="Run 2 cycles/month, local currency"
                    />
                  </label>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-white/60">
                    <span>Payroll owner: {countryFocusNode.manager}</span>
                    <button
                      type="submit"
                      disabled={isCountrySaving}
                      className="inline-flex items-center gap-2 rounded-2xl border border-amber-300/70 bg-amber-400/10 px-4 py-2 text-sm text-white"
                    >
                      {isCountrySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers3 className="h-4 w-4" />} Save country profile
                    </button>
                  </div>
                </form>
              ) : (
                <div className="rounded-3xl border border-dashed border-white/20 px-4 py-10 text-center text-sm text-white/60">
                  Add countries to specify compliance and payroll rules.
                </div>
              )}
            </Panel>

            <Panel variant="glass" className="space-y-6">
              <SectionHeading eyebrow="Branches" title="Site playbooks" description="Codes, leads, hours, compliance" />
              <div className="flex flex-wrap gap-2 text-xs text-white/70">
                {branches.length === 0 ? (
                  <span className="rounded-full border border-white/15 px-3 py-1.5 text-white/60">No branches yet</span>
                ) : (
                  branches.map((node) => (
                    <button
                      key={node.id}
                      onClick={() => handleBranchFocusChange(node.id)}
                      className={`rounded-full border px-3 py-1.5 transition ${
                        branchFocusId === node.id ? "border-rose-300 bg-rose-400/10 text-white" : "border-white/15 text-white/60 hover:border-white/40"
                      }`}
                    >
                      {node.name}
                    </button>
                  ))
                )}
              </div>
              {branchFocusNode ? (
                <form onSubmit={handleBranchSave} className="space-y-4 rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label>
                      <span className="text-xs uppercase tracking-[0.3em] text-white/40">Branch code</span>
                      <input
                        name="code"
                        value={branchForm.code}
                        onChange={handleBranchFormChange}
                        className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-white"
                        placeholder="BR-214"
                      />
                    </label>
                    <label>
                      <span className="text-xs uppercase tracking-[0.3em] text-white/40">Site lead</span>
                      <input
                        name="siteLead"
                        value={branchForm.siteLead}
                        onChange={handleBranchFormChange}
                        className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-white"
                        placeholder="Dami Ayo"
                      />
                    </label>
                  </div>
                  <label>
                    <span className="text-xs uppercase tracking-[0.3em] text-white/40">Address</span>
                    <textarea
                      name="address"
                      value={branchForm.address}
                      onChange={handleBranchFormChange}
                      className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-white"
                      rows={2}
                      placeholder="5 Marina Rd, Lagos"
                    />
                  </label>
                  <label>
                    <span className="text-xs uppercase tracking-[0.3em] text-white/40">Operating hours</span>
                    <textarea
                      name="hours"
                      value={branchForm.hours}
                      onChange={handleBranchFormChange}
                      className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-white"
                      rows={2}
                      placeholder="Mon-Fri · 08:00-19:00"
                    />
                  </label>
                  <label>
                    <span className="text-xs uppercase tracking-[0.3em] text-white/40">Compliance checklist</span>
                    <textarea
                      name="compliance"
                      value={branchForm.compliance}
                      onChange={handleBranchFormChange}
                      className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-white"
                      rows={3}
                      placeholder="Fire drills monthly, ISO audit pending"
                    />
                  </label>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-white/60">
                    <span>Current manager: {branchFocusNode.manager}</span>
                    <button
                      type="submit"
                      disabled={isBranchSaving}
                      className="inline-flex items-center gap-2 rounded-2xl border border-rose-300/70 bg-rose-400/10 px-4 py-2 text-sm text-white"
                    >
                      {isBranchSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />} Save branch
                    </button>
                  </div>
                </form>
              ) : (
                <div className="rounded-3xl border border-dashed border-white/20 px-4 py-10 text-center text-sm text-white/60">
                  Add branches to capture operational detail.
                </div>
              )}
            </Panel>
          </section>
        </section>
      </main>
      {nodeModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4 py-10">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#090918] p-6 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/40">
                  {nodeModal.mode === "create" ? "Create node" : nodeModal.mode === "edit" ? "Edit node" : "Delete node"}
                </p>
                <h2 className="text-2xl font-semibold">{NODE_TYPE_LABELS[nodeModal.contextNode.type]} · {nodeModal.contextNode.name}</h2>
              </div>
              <button onClick={closeNodeModal} className="rounded-full border border-white/20 p-1 text-white/70 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            {nodeModal.mode === "delete" ? (
              <form onSubmit={handleModalSubmit} className="mt-6 space-y-4">
                <p className="text-sm text-white/70">
                  This will remove the node from the current hierarchy. All children will also be detached. This action cannot be undone.
                </p>
                {modalError ? <p className="rounded-2xl border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{modalError}</p> : null}
                <div className="flex justify-end gap-3 text-sm">
                  <button type="button" onClick={closeNodeModal} className="rounded-2xl border border-white/20 px-4 py-2 text-white/70">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading}
                    className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/70 bg-rose-500/20 px-4 py-2 text-white"
                  >
                    {modalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Confirm delete
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleModalSubmit} className="mt-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-white/70">
                    <span className="text-xs uppercase tracking-[0.3em] text-white/40">Name</span>
                    <input
                      name="name"
                      value={modalForm.name}
                      onChange={handleModalInputChange}
                      className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-white"
                      placeholder="Node name"
                      required
                    />
                  </label>
                  <label className="text-sm text-white/70">
                    <span className="text-xs uppercase tracking-[0.3em] text-white/40">Manager</span>
                    <input
                      name="manager"
                      value={modalForm.manager}
                      onChange={handleModalInputChange}
                      className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-white"
                      placeholder="Manager name"
                      required
                    />
                  </label>
                  <label className="text-sm text-white/70">
                    <span className="text-xs uppercase tracking-[0.3em] text-white/40">Region</span>
                    <input
                      name="region"
                      value={modalForm.region}
                      onChange={handleModalInputChange}
                      className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-white"
                      placeholder="e.g. West Africa"
                    />
                  </label>
                  <label className="text-sm text-white/70">
                    <span className="text-xs uppercase tracking-[0.3em] text-white/40">Timezone</span>
                    <input
                      name="timezone"
                      value={modalForm.timezone}
                      onChange={handleModalInputChange}
                      className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-white"
                      placeholder="e.g. GMT+1"
                    />
                  </label>
                  <label className="text-sm text-white/70">
                    <span className="text-xs uppercase tracking-[0.3em] text-white/40">Headcount</span>
                    <input
                      name="headcount"
                      value={modalForm.headcount}
                      onChange={handleModalInputChange}
                      className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-white"
                      placeholder="120"
                      type="number"
                      min="0"
                    />
                  </label>
                  <label className="text-sm text-white/70">
                    <span className="text-xs uppercase tracking-[0.3em] text-white/40">Status</span>
                    <select
                      name="status"
                      value={modalForm.status}
                      onChange={handleModalInputChange}
                      className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-white"
                    >
                      {ORG_NODE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm text-white/70">
                    <span className="text-xs uppercase tracking-[0.3em] text-white/40">Node type</span>
                    <select
                      name="type"
                      value={modalForm.type}
                      onChange={handleModalInputChange}
                      className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-white"
                      disabled={nodeModal.mode === "create"}
                    >
                      {ORG_NODE_TYPES.filter((type) => type !== "tenant").map((type) => (
                        <option key={type} value={type}>
                          {NODE_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/40">Modules</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {MODULE_LIBRARY.map((module) => {
                      const active = modalForm.modules.includes(module);
                      return (
                        <button
                          type="button"
                          key={module}
                          onClick={() => handleModalModuleToggle(module)}
                          className={`rounded-full border px-3 py-1 ${active ? "border-emerald-300 bg-emerald-400/10 text-white" : "border-white/20 text-white/60"}`}
                        >
                          {module}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {modalError ? <p className="rounded-2xl border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{modalError}</p> : null}
                <div className="flex justify-end gap-3 text-sm">
                  <button type="button" onClick={closeNodeModal} className="rounded-2xl border border-white/20 px-4 py-2 text-white/70">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading}
                    className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/70 bg-emerald-400/10 px-4 py-2 text-white"
                  >
                    {modalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Save node
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
      {actionToast ? (
        <div className="fixed bottom-6 right-6 rounded-2xl border border-emerald-400/30 bg-black/80 px-4 py-3 text-sm text-white shadow-lg shadow-emerald-500/20">
          {actionToast}
        </div>
      ) : null}
    </div>
  );
}

