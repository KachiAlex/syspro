"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Globe,
  MapPin,
  Loader2,
} from "lucide-react";
import type { OrgNode, OrgNodeStatus, OrgTier } from "@/lib/org-tree";
import { TIER_DEFINITIONS } from "@/lib/org-tree";

// ============================================================================
// ARCHITECTURE OVERVIEW
// ============================================================================
// Branch-Centric Tier Model:
// - Tier 0: Tenant (root) - system created
// - Tier 1: Region (geographic regions)
// - Tier 2: Country (country entities)
// - Tier 3: Subsidiary (legal entities)
// - Tier 4: Branch (operational root with currency/timezone config)
// 
// Branch Admins delegate: Departments, Teams, Project Groups (not in hierarchy)
//
// Wizard flow: Welcome → Tier Select → Location Details → 
//             [If Branch] Config → Complete → View Tree
// ============================================================================

// ============================================================================
// CONSTANTS
// ============================================================================

const TIER_CREATION_OPTIONS: Array<{ 
  tier: OrgTier; 
  label: string; 
  description: string 
}> = [
  {
    tier: 1,
    label: "Region (Tier 1)",
    description: "Geographic region for organizing countries",
  },
  {
    tier: 2,
    label: "Country (Tier 2)",
    description: "Country entity within a region",
  },
  {
    tier: 3,
    label: "Subsidiary (Tier 3)",
    description: "Legal entity or subsidiary within a country",
  },
  {
    tier: 4,
    label: "Branch (Tier 4)",
    description: "Operational branch (mini-ERP with local admin control)",
  },
] as const;

const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "UTC (Universal Time)" },
  { value: "GMT", label: "GMT (Greenwich Mean Time)" },
  { value: "EST", label: "EST (Eastern Standard)" },
  { value: "CST", label: "CST (Central Standard)" },
  { value: "PST", label: "PST (Pacific Standard)" },
  { value: "IST", label: "IST (Indian Standard)" },
  { value: "SGT", label: "SGT (Singapore Time)" },
  { value: "SAST", label: "SAST (South Africa Standard)" },
];

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "INR", label: "INR - Indian Rupee" },
  { value: "SGD", label: "SGD - Singapore Dollar" },
  { value: "JPY", label: "JPY - Japanese Yen" },
  { value: "ZAR", label: "ZAR - South African Rand" },
  { value: "NGN", label: "NGN - Nigerian Naira" },
];

// ============================================================================
// TYPES
// ============================================================================

type SetupStep = "welcome" | "tier-select" | "location" | "branch-config" | "complete" | "view";

type LocationFormData = {
  tier: OrgTier | 0;
  name: string;
  manager: string;
};

type BranchFormData = {
  name: string;
  manager: string;
  currency: string;
  timezone: string;
  workingDays: string;
};

// ============================================================================
// UTILITIES
// ============================================================================

function buildTenantQuery(tenantSlug: string): string {
  return `tenantSlug=${encodeURIComponent(tenantSlug)}&userRole=admin&userId=console`;
}

function getTierLabel(tier: OrgTier | 0): string {
  if (!tier) return "";
  return TIER_DEFINITIONS[tier as OrgTier]?.name || "";
}

function getTierTypeMap(): Record<number, string> {
  return { 1: "region", 2: "country", 3: "subsidiary", 4: "branch" };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function OrgStructureManager({
  tenantSlug,
}: {
  tenantSlug?: string | null;
}) {
  const ts = tenantSlug ?? "kreatix-default";
  const tenantQuery = useMemo(() => buildTenantQuery(ts), [ts]);

  // Wizard step
  const [step, setStep] = useState<SetupStep>("welcome");

  // Form data
  const [location, setLocation] = useState<LocationFormData>({
    tier: 0,
    name: "",
    manager: "",
  });

  const [branch, setBranch] = useState<BranchFormData>({
    name: "",
    manager: "",
    currency: "USD",
    timezone: "UTC",
    workingDays: "MON-FRI",
  });

  // UI state
  const [orgTree, setOrgTree] = useState<OrgNode | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(
    new Set(["tenant-root"])
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load tree on mount
  useEffect(() => {
    loadOrganizationTree();
  }, []);

  const loadOrganizationTree = useCallback(async () => {
    try {
      const response = await fetch(`/api/tenant/org-structure?${tenantQuery}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        console.error("Failed to load org structure");
        return;
      }

      const payload = await response.json().catch(() => null);
      if (payload?.tree) {
        const tree = payload.tree as OrgNode;
        setOrgTree(tree);
        if ((tree?.children?.length ?? 0) > 0) {
          setStep("complete");
        }
      }
    } catch (err) {
      console.error("Error loading organization tree:", err);
    }
  }, [tenantQuery]);

  // Create Tier 1-3
  const handleCreateTier = useCallback(async () => {
    if (location.tier === 0 || !location.name.trim() || !location.manager.trim()) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const tierTypeMap = getTierTypeMap();
      const nodeType = tierTypeMap[location.tier as number];

      const response = await fetch(`/api/tenant/org-structure?${tenantQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentId: orgTree?.id ?? "tenant-root",
          node: {
            name: location.name.trim(),
            manager: location.manager.trim(),
            status: "Live" as OrgNodeStatus,
            type: nodeType,
            tier: location.tier.toString(),
          },
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(
          errorPayload?.error ?? `Failed to create ${getTierLabel(location.tier as OrgTier)}`
        );
      }

      const payload = await response.json();
      setOrgTree(payload.tree as OrgNode);

      if (location.tier === 4) {
        setStep("branch-config");
      } else {
        setStep("complete");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tier");
    } finally {
      setLoading(false);
    }
  }, [location, tenantQuery, orgTree?.id]);

  // Create Tier 4 Branch
  const handleCreateBranch = useCallback(async () => {
    if (!branch.name.trim() || !branch.manager.trim()) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tenant/org-structure?${tenantQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentId: orgTree?.id ?? "tenant-root",
          node: {
            name: branch.name.trim(),
            manager: branch.manager.trim(),
            status: "Live" as OrgNodeStatus,
            type: "branch",
            tier: "4",
            metadata: {
              currency: branch.currency,
              timezone: branch.timezone,
              workingDays: branch.workingDays,
            },
          },
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error ?? "Failed to create branch");
      }

      const payload = await response.json();
      setOrgTree(payload.tree as OrgNode);
      setStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create branch");
    } finally {
      setLoading(false);
    }
  }, [branch, tenantQuery, orgTree?.id]);

  // Toggle node expansion
  const toggleNodeExpanded = useCallback((nodeId: string) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Render tree node
  const renderTreeNode = useCallback(
    (node: OrgNode, depth: number = 0): React.ReactNode => {
      const isExpanded = expandedNodeIds.has(node.id);
      const hasChildren = (node.children?.length ?? 0) > 0;
      const paddingLeft = depth * 16;

      return (
        <div key={node.id} className="space-y-1">
          <div
            className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50"
            style={{ paddingLeft: `${paddingLeft}px` }}
          >
            {/* Expand/Collapse */}
            {hasChildren ? (
              <button
                onClick={() => toggleNodeExpanded(node.id)}
                className="flex-shrink-0 p-0.5 hover:bg-slate-200 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-600" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                )}
              </button>
            ) : (
              <div className="w-5 flex-shrink-0" />
            )}

            {/* Icon */}
            <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {node.name}
              </p>
              <p className="text-xs text-slate-500 truncate">
                Lead: {node.manager}
              </p>
            </div>

            {/* Badge */}
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 lowercase flex-shrink-0">
              {node.type}
            </span>
          </div>

          {/* Children */}
          {isExpanded && hasChildren && (
            <div className="space-y-1">
              {node.children!.map((child) => renderTreeNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    },
    [expandedNodeIds, toggleNodeExpanded]
  );

  const resetLocationForm = () => {
    setLocation({ tier: 0, name: "", manager: "" });
  };

  // Render wizard
  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8">
      {step === "welcome" && (
        <WelcomeStep onStart={() => setStep("tier-select")} />
      )}

      {step === "tier-select" && (
        <TierSelectStep
          onSelectTier={(tier) => {
            setLocation({ tier, name: "", manager: "" });
            setStep("location");
          }}
          onBack={() => setStep("welcome")}
        />
      )}

      {step === "location" && (
        <LocationStep
          tier={location.tier}
          name={location.name}
          manager={location.manager}
          error={error}
          loading={loading}
          onNameChange={(name) => setLocation({ ...location, name })}
          onManagerChange={(manager) => setLocation({ ...location, manager })}
          onSubmit={handleCreateTier}
          onBack={() => setStep("tier-select")}
        />
      )}

      {step === "branch-config" && (
        <BranchConfigStep
          name={branch.name}
          manager={branch.manager}
          currency={branch.currency}
          timezone={branch.timezone}
          workingDays={branch.workingDays}
          error={error}
          loading={loading}
          onNameChange={(name) => setBranch({ ...branch, name })}
          onManagerChange={(manager) => setBranch({ ...branch, manager })}
          onCurrencyChange={(currency) => setBranch({ ...branch, currency })}
          onTimezoneChange={(timezone) => setBranch({ ...branch, timezone })}
          onWorkingDaysChange={(workingDays) =>
            setBranch({ ...branch, workingDays })
          }
          onSubmit={handleCreateBranch}
          onBack={() => setStep("location")}
        />
      )}

      {step === "complete" && (
        <CompleteStep
          onViewStructure={() => setStep("view")}
          onAddAnother={() => {
            resetLocationForm();
            setStep("tier-select");
          }}
        />
      )}

      {step === "view" && orgTree && (
        <ViewStep
          tree={orgTree}
          renderNode={renderTreeNode}
          onAddMore={() => {
            resetLocationForm();
            setStep("tier-select");
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// STEP COMPONENTS
// ============================================================================

function WelcomeStep({ onStart }: { onStart: () => void }) {
  return (
    <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
          Tier-Based Setup
        </p>
        <h1 className="text-3xl font-bold text-slate-900">
          Build Your Organization Hierarchy
        </h1>
        <p className="text-base text-slate-600">
          Enterprise-grade structure with Global Admin controlling Tiers 0-4,
          and Branch Admins managing local operations.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex gap-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
          <Globe className="h-5 w-5 flex-shrink-0 text-blue-600 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-blue-900 text-sm">
              Tier 1-3: Global Hierarchy
            </p>
            <p className="text-xs text-blue-800">
              Define Regions, Countries, and Subsidiaries from the center.
            </p>
          </div>
        </div>

        <div className="flex gap-4 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
          <MapPin className="h-5 w-5 flex-shrink-0 text-emerald-600 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-emerald-900 text-sm">
              Tier 4: Operational Branches
            </p>
            <p className="text-xs text-emerald-800">
              Each branch becomes a mini-ERP with local admin control and
              currency configuration.
            </p>
          </div>
        </div>

        <div className="flex gap-4 rounded-lg border border-purple-100 bg-purple-50 p-4">
          <Building2 className="h-5 w-5 flex-shrink-0 text-purple-600 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-purple-900 text-sm">
              Branch Units (Delegated)
            </p>
            <p className="text-xs text-purple-800">
              Branch Admins create Departments, Teams, and Projects locally
              within their branch.
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={onStart}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-slate-800 active:bg-slate-950 transition-colors"
      >
        Start Setup <ArrowRight className="h-5 w-5" />
      </button>
    </div>
  );
}

function TierSelectStep({
  onSelectTier,
  onBack,
}: {
  onSelectTier: (tier: OrgTier) => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-slate-900">
          Select Organization Tier
        </h2>
        <p className="text-sm text-slate-600">
          Choose which tier to create next:
        </p>
      </div>

      <div className="space-y-2">
        {TIER_CREATION_OPTIONS.map((option) => (
          <button
            key={option.tier}
            onClick={() => onSelectTier(option.tier)}
            className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-slate-400 hover:bg-slate-50 active:bg-slate-100 transition-colors"
          >
            <div className="space-y-1">
              <p className="font-semibold text-slate-900">{option.label}</p>
              <p className="text-sm text-slate-600">{option.description}</p>
            </div>
            <ArrowRight className="h-5 w-5 flex-shrink-0 text-slate-400" />
          </button>
        ))}
      </div>

      <button
        onClick={onBack}
        className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors"
      >
        Back
      </button>
    </div>
  );
}

function LocationStep({
  tier,
  name,
  manager,
  error,
  loading,
  onNameChange,
  onManagerChange,
  onSubmit,
  onBack,
}: {
  tier: OrgTier | 0;
  name: string;
  manager: string;
  error: string | null;
  loading: boolean;
  onNameChange: (value: string) => void;
  onManagerChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-slate-900">
          {tier ? `Create ${getTierLabel(tier as OrgTier)}` : "Tier Details"}
        </h2>
        <p className="text-sm text-slate-600">
          Fill in the details for this organizational tier:
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <label htmlFor="name" className="block text-sm font-semibold text-slate-700">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g., Africa Operations"
            className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-opacity-10"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="manager" className="block text-sm font-semibold text-slate-700">
            Manager / Lead <span className="text-red-500">*</span>
          </label>
          <input
            id="manager"
            type="text"
            required
            value={manager}
            onChange={(e) => onManagerChange(e.target.value)}
            placeholder="e.g., John Smith"
            className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-opacity-10"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 active:bg-slate-950 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

function BranchConfigStep({
  name,
  manager,
  currency,
  timezone,
  workingDays,
  error,
  loading,
  onNameChange,
  onManagerChange,
  onCurrencyChange,
  onTimezoneChange,
  onWorkingDaysChange,
  onSubmit,
  onBack,
}: {
  name: string;
  manager: string;
  currency: string;
  timezone: string;
  workingDays: string;
  error: string | null;
  loading: boolean;
  onNameChange: (value: string) => void;
  onManagerChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onTimezoneChange: (value: string) => void;
  onWorkingDaysChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-slate-900">
          Configure Branch Settings
        </h2>
        <p className="text-sm text-slate-600">
          Set operational parameters for this branch:
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <label htmlFor="branch-name" className="block text-sm font-semibold text-slate-700">
            Branch Name <span className="text-red-500">*</span>
          </label>
          <input
            id="branch-name"
            type="text"
            required
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g., Lagos Branch"
            className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-opacity-10"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="branch-admin" className="block text-sm font-semibold text-slate-700">
            Branch Admin <span className="text-red-500">*</span>
          </label>
          <input
            id="branch-admin"
            type="text"
            required
            value={manager}
            onChange={(e) => onManagerChange(e.target.value)}
            placeholder="e.g., Alice Johnson"
            className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-opacity-10"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="currency" className="block text-sm font-semibold text-slate-700">
            Currency
          </label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => onCurrencyChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-opacity-10 bg-white"
          >
            {CURRENCY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="timezone" className="block text-sm font-semibold text-slate-700">
            Timezone
          </label>
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => onTimezoneChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-opacity-10 bg-white"
          >
            {TIMEZONE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="working-days" className="block text-sm font-semibold text-slate-700">
            Working Days
          </label>
          <input
            id="working-days"
            type="text"
            value={workingDays}
            onChange={(e) => onWorkingDaysChange(e.target.value)}
            placeholder="e.g., MON-FRI"
            className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-opacity-10"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 active:bg-slate-950 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Creating..." : "Create Branch"}
          </button>
        </div>
      </form>
    </div>
  );
}

function CompleteStep({
  onViewStructure,
  onAddAnother,
}: {
  onViewStructure: () => void;
  onAddAnother: () => void;
}) {
  return (
    <div className="space-y-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-8 shadow-sm">
      <div className="flex items-start gap-4">
        <CheckCircle2 className="h-8 w-8 flex-shrink-0 text-emerald-600 mt-0.5" />
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">
            Success!
          </p>
          <h2 className="text-2xl font-bold text-emerald-900">
            Tier created successfully
          </h2>
          <p className="text-sm text-emerald-800">
            Your organization structure is being built. View the complete
            hierarchy below:
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onViewStructure}
          className="flex-1 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800 transition-colors"
        >
          View Structure
        </button>
        <button
          onClick={onAddAnother}
          className="flex-1 rounded-full border border-emerald-300 bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-200 active:bg-emerald-300 transition-colors"
        >
          Add Another
        </button>
      </div>
    </div>
  );
}

function ViewStep({
  tree,
  renderNode,
  onAddMore,
}: {
  tree: OrgNode;
  renderNode: (node: OrgNode, depth?: number) => React.ReactNode;
  onAddMore: () => void;
}) {
  return (
    <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-slate-900">
          Organization Structure
        </h2>
        <p className="text-sm text-slate-600">
          Tier-based hierarchy with Global Admin controlling Tiers 0-4
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        {tree ? (
          <div className="space-y-1">{renderNode(tree)}</div>
        ) : (
          <p className="text-sm text-slate-600">
            No organization structure loaded.
          </p>
        )}
      </div>

      <button
        onClick={onAddMore}
        className="w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 active:bg-slate-950 transition-colors"
      >
        Add More Tiers
      </button>
    </div>
  );
}
