// Tier definitions (Global Admin controls Tiers 0-4)
export const TIER_DEFINITIONS = {
  0: { name: "Tenant", description: "Holding Company / Root Entity", canHaveChildren: true },
  1: { name: "Region", description: "Geographic Region", canHaveChildren: true },
  2: { name: "Country", description: "Country Entity", canHaveChildren: true },
  3: { name: "Subsidiary", description: "Legal Entity / Subsidiary", canHaveChildren: true },
  4: { name: "Branch", description: "Operational Branch (Mini-ERP Root)", canHaveChildren: false, isOperationalRoot: true },
} as const;

export type OrgTier = keyof typeof TIER_DEFINITIONS;

// Main org structure types (Tier 0-4 only)
export type OrgNodeType = "tenant" | "region" | "country" | "subsidiary" | "branch";

export const ORG_NODE_TYPES: OrgNodeType[] = ["tenant", "region", "country", "subsidiary", "branch"];

// Branch-level internal structure (delegated to Branch Admin)
export type BranchUnitType = "department" | "team" | "project-unit";

export const ORG_NODE_STATUSES = ["Live", "Planning", "Paused"] as const;
export type OrgNodeStatus = (typeof ORG_NODE_STATUSES)[number];

export type OrgNode = {
  id: string;
  name: string;
  type: OrgNodeType;
  tier?: OrgTier;
  status: OrgNodeStatus;
  manager: string;
  region?: string;
  headcount?: number;
  modules?: string[];
  timezone?: string;
  metadata?: Record<string, string>;
  children?: OrgNode[];
};

export const FALLBACK_ORG_TREE: OrgNode = {
  id: "tenant-root",
  name: "My Organization",
  type: "tenant",
  status: "Live",
  manager: "Administrator",
  region: "Global",
  headcount: 0,
  modules: [],
  children: [],
};
