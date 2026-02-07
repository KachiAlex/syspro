import { randomUUID } from "node:crypto";

export type DemandChannel =
  | "email"
  | "social"
  | "events"
  | "partnerships"
  | "referrals"
  | "advocacy"
  | "paid_search"
  | "sponsorships";

export type CampaignStatus = "draft" | "planned" | "pending_approval" | "approved" | "active" | "paused" | "completed";
export type AttributionModel = "first_touch" | "last_touch" | "linear";

export interface Campaign {
  id: string;
  tenantSlug: string;
  subsidiary: string;
  region: string;
  branch?: string;
  campaignCode: string;
  name: string;
  objective: string;
  status: CampaignStatus;
  channel: DemandChannel;
  startDate: string;
  endDate?: string;
  budget: number;
  committedSpend: number;
  actualSpend: number;
  expectedPipeline: number;
  pipelineInfluenced: number;
  revenueAttributed: number;
  roi: number;
  approval: {
    status: "draft" | "pending" | "approved" | "rejected";
    approvedBy?: string;
    approvedAt?: string;
  };
  targetSegments: string[];
  attributionModel: AttributionModel;
  createdBy: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CampaignCost {
  id: string;
  tenantSlug: string;
  campaignId: string;
  subsidiary: string;
  region: string;
  branch?: string;
  costCenter: string;
  description: string;
  amount: number;
  currency: string;
  spendDate: string;
  recordedBy: string;
  approvedBy?: string;
  createdAt: string;
}

export interface LeadSource {
  id: string;
  tenantSlug: string;
  name: string;
  channel: DemandChannel;
  campaignId?: string;
  costCenter: string;
  region: string;
  branch?: string;
  subsidiary: string;
  status: "active" | "inactive";
  metadata?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
}

export interface RevenueAttribution {
  id: string;
  tenantSlug: string;
  campaignId?: string;
  leadSourceId?: string;
  crmOpportunityId: string;
  crmDealId?: string;
  crmValue: number;
  recognizedRevenue: number;
  allocationWeight: number;
  model: AttributionModel;
  region: string;
  branch?: string;
  channel: DemandChannel;
  subsidiary: string;
  closedDate: string;
  metadata?: Record<string, unknown>;
}

export interface SalesTarget {
  id: string;
  tenantSlug: string;
  period: string;
  periodType: "monthly" | "quarterly";
  region: string;
  branch?: string;
  subsidiary: string;
  ownerType: "team" | "rep";
  ownerId: string;
  ownerName: string;
  targetAmount: number;
  achievedAmount: number;
  currency: string;
  createdBy: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalesPerformanceSnapshot {
  id: string;
  tenantSlug: string;
  period: string;
  periodLabel: string;
  winRate: number;
  revenueAchieved: number;
  revenueTarget: number;
  dealVelocityDays: number;
  avgDealSize: number;
  pipelineCoverage: number;
  repProductivity: Array<{
    repId: string;
    repName: string;
    meetings: number;
    proposals: number;
    wins: number;
    attainment: number;
  }>;
  regionalPerformance: Array<{
    region: string;
    revenue: number;
    target: number;
    attainment: number;
  }>;
  funnelLeakage: Array<{ stage: string; entered: number; converted: number; leakage: number }>;
  createdAt: string;
}

export interface EnablementAsset {
  id: string;
  tenantSlug: string;
  title: string;
  assetType: "deck" | "playbook" | "case_study" | "template" | "pricing";
  audience: "sales" | "revops" | "executive" | "partner";
  version: string;
  status: "draft" | "published" | "archived";
  tags: string[];
  summary: string;
  storageUrl: string;
  owner: string;
  subsidiary: string;
  region?: string;
  usageMetrics: {
    downloads: number;
    crmLinks: number;
    lastViewedAt?: string;
  };
  createdBy: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RevenueForecast {
  id: string;
  tenantSlug: string;
  periodStart: string;
  periodEnd: string;
  region: string;
  branch?: string;
  subsidiary: string;
  forecastLow: number;
  forecastLikely: number;
  forecastHigh: number;
  confidence: number;
  methodology: string;
  assumptions: string[];
  riskAlerts: Array<{ id: string; label: string; severity: "low" | "medium" | "high"; detail?: string }>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RevOpsOverviewSnapshot {
  metrics: Array<{ id: string; label: string; value: string; delta?: number; deltaDirection?: "up" | "down" }>;
  revenueVsTarget: { period: string; actual: number; target: number };
  campaignRoi: Array<{ campaignId: string; name: string; roi: number; spend: number; revenue: number }>;
  funnelLeakage: Array<{ stage: string; leakPercent: number }>;
  costVsRevenue: { spend: number; revenue: number; timeframe: string };
  regionalPerformance: Array<{ region: string; revenue: number; target: number; attainment: number }>;
  executiveHighlights: string[];
}

export interface AttributionSummary {
  model: AttributionModel;
  totals: { revenue: number; spend: number; roi: number; opportunities: number };
  campaigns: Array<{ campaignId: string; name: string; revenue: number; spend: number; roi: number; influencedDeals: number }>;
  channels: Array<{ channel: DemandChannel; revenue: number; spend: number; roi: number; costPerAcquisition: number }>;
  regions: Array<{ region: string; revenue: number; spend: number; roi: number }>;
}

export type CampaignFilters = Partial<{
  status: CampaignStatus;
  channel: DemandChannel;
  region: string;
}>;

export type LeadSourceFilters = Partial<{ channel: DemandChannel; region: string; status: "active" | "inactive" }>;

interface CrmDealSnapshot {
  id: string;
  opportunityId: string;
  campaignId?: string;
  leadSourceId?: string;
  value: number;
  currency: string;
  status: "open" | "won" | "lost";
  region: string;
  branch?: string;
  ownerId: string;
  ownerName: string;
  closeDate?: string;
}

interface RevOpsTenantStore {
  campaigns: Campaign[];
  leadSources: LeadSource[];
  campaignCosts: CampaignCost[];
  revenueAttributions: RevenueAttribution[];
  salesTargets: SalesTarget[];
  performanceSnapshots: SalesPerformanceSnapshot[];
  enablementAssets: EnablementAsset[];
  forecasts: RevenueForecast[];
  crmDeals: CrmDealSnapshot[];
}

const STORE: Record<string, RevOpsTenantStore> = {};

function toMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeRoi(revenue: number, spend: number): number {
  if (spend <= 0) return 0;
  return Number(((revenue - spend) / spend).toFixed(2));
}

function ensureStore(tenantSlug: string): RevOpsTenantStore {
  const slug = tenantSlug || "default";
  if (!STORE[slug]) {
    STORE[slug] = seedTenant(slug);
  }
  return STORE[slug];
}

function seedTenant(tenantSlug: string): RevOpsTenantStore {
  const now = new Date().toISOString();
  const campaigns: Campaign[] = [];
  const leadSources: LeadSource[] = [];
  const campaignCosts: CampaignCost[] = [];
  const revenueAttributions: RevenueAttribution[] = [];
  const salesTargets: SalesTarget[] = [];
  const performanceSnapshots: SalesPerformanceSnapshot[] = [];
  const enablementAssets: EnablementAsset[] = [];
  const forecasts: RevenueForecast[] = [];
  const crmDeals: CrmDealSnapshot[] = [];

  // Sample data
  const campaignA: Campaign = {
    id: randomUUID(),
    tenantSlug,
    subsidiary: "MetroWave Holdings",
    region: "West Africa",
    branch: "Lagos",
    campaignCode: "REV-2026-001",
    name: "Fiber Expansion Roadshow",
    objective: "Drive enterprise demand for metro fiber upgrades",
    status: "active",
    channel: "events",
    startDate: new Date("2026-01-10").toISOString(),
    endDate: new Date("2026-03-30").toISOString(),
    budget: 65000000,
    committedSpend: 42000000,
    actualSpend: 36000000,
    expectedPipeline: 110000000,
    pipelineInfluenced: 94000000,
    revenueAttributed: 48000000,
    roi: computeRoi(48000000, 36000000),
    approval: { status: "approved", approvedBy: "revops.lead", approvedAt: now },
    targetSegments: ["Enterprise", "Carrier"],
    attributionModel: "linear",
    createdBy: "revops.lead",
    approvedBy: "revops.lead",
    createdAt: now,
    updatedAt: now,
    metadata: { focus: "metro-fiber" },
  };

  const campaignB: Campaign = {
    id: randomUUID(),
    tenantSlug,
    subsidiary: "MetroWave Holdings",
    region: "EMEA",
    campaignCode: "REV-2026-002",
    name: "Cloud Security Partner Blitz",
    objective: "Enable partners to attach security services",
    status: "planned",
    channel: "partnerships",
    startDate: new Date("2026-02-15").toISOString(),
    endDate: new Date("2026-06-30").toISOString(),
    budget: 38000000,
    committedSpend: 12000000,
    actualSpend: 4000000,
    expectedPipeline: 75000000,
    pipelineInfluenced: 12000000,
    revenueAttributed: 6000000,
    roi: computeRoi(6000000, 4000000),
    approval: { status: "pending" },
    targetSegments: ["Partners"],
    attributionModel: "first_touch",
    createdBy: "revops.partner.ops",
    createdAt: now,
    updatedAt: now,
    metadata: { enablement: true },
  };

  const campaignC: Campaign = {
    id: randomUUID(),
    tenantSlug,
    subsidiary: "NovaEdge Digital",
    region: "Americas",
    branch: "Atlanta",
    campaignCode: "REV-2025-044",
    name: "AI Ops Thought Leadership",
    objective: "Create net-new demand for managed AI Ops services",
    status: "completed",
    channel: "social",
    startDate: new Date("2025-09-01").toISOString(),
    endDate: new Date("2025-12-15").toISOString(),
    budget: 18000000,
    committedSpend: 18000000,
    actualSpend: 16500000,
    expectedPipeline: 52000000,
    pipelineInfluenced: 51000000,
    revenueAttributed: 33000000,
    roi: computeRoi(33000000, 16500000),
    approval: { status: "approved", approvedBy: "cmo" },
    targetSegments: ["Service Providers", "Digital Natives"],
    attributionModel: "last_touch",
    createdBy: "marketing.ops",
    approvedBy: "cmo",
    createdAt: now,
    updatedAt: now,
  };

  campaigns.push(campaignA, campaignB, campaignC);

  const leadSourceWeb: LeadSource = {
    id: randomUUID(),
    tenantSlug,
    name: "Website Form – Enterprise",
    channel: "email",
    campaignId: campaignA.id,
    costCenter: "CC-7001",
    region: "West Africa",
    branch: "Lagos",
    subsidiary: "MetroWave Holdings",
    status: "active",
    metadata: { formId: "enterprise-intent" },
    createdBy: "revops.web",
    createdAt: now,
  };

  const leadSourcePartner: LeadSource = {
    id: randomUUID(),
    tenantSlug,
    name: "Partner Referral Program",
    channel: "partnerships",
    costCenter: "CC-7010",
    region: "Global",
    subsidiary: "MetroWave Holdings",
    status: "active",
    metadata: { partnerPortal: true },
    createdBy: "revops.partner.ops",
    createdAt: now,
  };

  const leadSourceRoadshow: LeadSource = {
    id: randomUUID(),
    tenantSlug,
    name: "Roadshow – Lagos",
    channel: "events",
    campaignId: campaignA.id,
    costCenter: "CC-7020",
    region: "West Africa",
    branch: "Lagos",
    subsidiary: "MetroWave Holdings",
    status: "active",
    createdBy: "revops.lead",
    createdAt: now,
  };

  leadSources.push(leadSourceWeb, leadSourcePartner, leadSourceRoadshow);

  campaignCosts.push(
    {
      id: randomUUID(),
      tenantSlug,
      campaignId: campaignA.id,
      subsidiary: "MetroWave Holdings",
      region: "West Africa",
      branch: "Lagos",
      costCenter: "CC-7001",
      description: "Venue + production",
      amount: 12000000,
      currency: "NGN",
      spendDate: new Date("2026-01-05").toISOString(),
      recordedBy: "revops.lead",
      approvedBy: "finance.controller",
      createdAt: now,
    },
    {
      id: randomUUID(),
      tenantSlug,
      campaignId: campaignA.id,
      subsidiary: "MetroWave Holdings",
      region: "West Africa",
      branch: "Abuja",
      costCenter: "CC-7001",
      description: "Partner hospitality",
      amount: 6200000,
      currency: "NGN",
      spendDate: new Date("2026-02-01").toISOString(),
      recordedBy: "revops.programs",
      approvedBy: "finance.controller",
      createdAt: now,
    },
    {
      id: randomUUID(),
      tenantSlug,
      campaignId: campaignB.id,
      subsidiary: "MetroWave Holdings",
      region: "EMEA",
      costCenter: "CC-7010",
      description: "Partner enablement kits",
      amount: 4000000,
      currency: "EUR",
      spendDate: new Date("2026-02-10").toISOString(),
      recordedBy: "revops.partner.ops",
      createdAt: now,
    }
  );

  const newCrmDeals: CrmDealSnapshot[] = [
    {
      id: randomUUID(),
      opportunityId: "OPP-90001",
      campaignId: campaignA.id,
      leadSourceId: leadSourceWeb.id,
      value: 28000000,
      currency: "NGN",
      status: "won",
      region: "West Africa",
      branch: "Lagos",
      ownerId: "rep-ade",
      ownerName: "Adeola Bamidele",
      closeDate: new Date("2026-01-28").toISOString(),
    },
    {
      id: randomUUID(),
      opportunityId: "OPP-90002",
      campaignId: campaignA.id,
      leadSourceId: leadSourceRoadshow.id,
      value: 20000000,
      currency: "NGN",
      status: "won",
      region: "West Africa",
      branch: "Abuja",
      ownerId: "rep-ife",
      ownerName: "Ifeoma Umeh",
      closeDate: new Date("2026-02-18").toISOString(),
    },
    {
      id: randomUUID(),
      opportunityId: "OPP-91001",
      campaignId: campaignC.id,
      value: 33000000,
      currency: "USD",
      status: "won",
      region: "Americas",
      branch: "Atlanta",
      ownerId: "rep-sam",
      ownerName: "Samuel Hart",
      closeDate: new Date("2025-12-05").toISOString(),
    }
  ];

  crmDeals.push(...newCrmDeals);

  revenueAttributions.push(
    {
      id: randomUUID(),
      tenantSlug,
      campaignId: campaignA.id,
      leadSourceId: leadSourceWeb.id,
      crmOpportunityId: "OPP-90001",
      crmDealId: crmDeals[0].id,
      crmValue: 28000000,
      recognizedRevenue: 22000000,
      allocationWeight: 0.5,
      model: "linear",
      region: "West Africa",
      branch: "Lagos",
      channel: "events",
      subsidiary: "MetroWave Holdings",
      closedDate: crmDeals[0].closeDate!,
    },
    {
      id: randomUUID(),
      tenantSlug,
      campaignId: campaignA.id,
      leadSourceId: leadSourceRoadshow.id,
      crmOpportunityId: "OPP-90002",
      crmDealId: crmDeals[1].id,
      crmValue: 20000000,
      recognizedRevenue: 18000000,
      allocationWeight: 0.5,
      model: "linear",
      region: "West Africa",
      branch: "Abuja",
      channel: "events",
      subsidiary: "MetroWave Holdings",
      closedDate: crmDeals[1].closeDate!,
    },
    {
      id: randomUUID(),
      tenantSlug,
      campaignId: campaignC.id,
      leadSourceId: leadSourcePartner.id,
      crmOpportunityId: "OPP-91001",
      crmDealId: crmDeals[2].id,
      crmValue: 33000000,
      recognizedRevenue: 33000000,
      allocationWeight: 1,
      model: "last_touch",
      region: "Americas",
      branch: "Atlanta",
      channel: "social",
      subsidiary: "NovaEdge Digital",
      closedDate: crmDeals[2].closeDate!,
    }
  );

  salesTargets.push(
    {
      id: randomUUID(),
      tenantSlug,
      period: "2026-02",
      periodType: "monthly",
      region: "West Africa",
      subsidiary: "MetroWave Holdings",
      ownerType: "team",
      ownerId: "sales-west",
      ownerName: "Enterprise West Africa",
      targetAmount: 60000000,
      achievedAmount: 42000000,
      currency: "NGN",
      createdBy: "revops.lead",
      approvedBy: "cfo",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: randomUUID(),
      tenantSlug,
      period: "2026-Q1",
      periodType: "quarterly",
      region: "Global",
      subsidiary: "MetroWave Holdings",
      ownerType: "team",
      ownerId: "sales-global",
      ownerName: "Global Strategic Accounts",
      targetAmount: 180000000,
      achievedAmount: 98000000,
      currency: "USD",
      createdBy: "revops.forecast",
      createdAt: now,
      updatedAt: now,
    }
  );

  performanceSnapshots.push({
    id: randomUUID(),
    tenantSlug,
    period: "2026-01",
    periodLabel: "January 2026",
    winRate: 0.34,
    revenueAchieved: 78000000,
    revenueTarget: 98000000,
    dealVelocityDays: 42,
    avgDealSize: 18500000,
    pipelineCoverage: 3.1,
    repProductivity: [
      { repId: "rep-ade", repName: "Adeola B.", meetings: 28, proposals: 9, wins: 3, attainment: 0.92 },
      { repId: "rep-ife", repName: "Ifeoma U.", meetings: 21, proposals: 6, wins: 2, attainment: 0.74 },
      { repId: "rep-sam", repName: "Samuel H.", meetings: 18, proposals: 7, wins: 2, attainment: 1.18 },
    ],
    regionalPerformance: [
      { region: "West Africa", revenue: 42000000, target: 60000000, attainment: 0.7 },
      { region: "Americas", revenue: 26000000, target: 24000000, attainment: 1.08 },
      { region: "EMEA", revenue: 10000000, target: 14000000, attainment: 0.71 },
    ],
    funnelLeakage: [
      { stage: "Demand", entered: 1200, converted: 420, leakage: 0.65 },
      { stage: "MQL", entered: 420, converted: 210, leakage: 0.5 },
      { stage: "SQL", entered: 210, converted: 72, leakage: 0.66 },
      { stage: "Opportunity", entered: 72, converted: 24, leakage: 0.67 },
    ],
    createdAt: now,
  });

  enablementAssets.push(
    {
      id: randomUUID(),
      tenantSlug,
      title: "Metro Fiber Outcomes Deck",
      assetType: "deck",
      audience: "sales",
      version: "v3.2",
      status: "published",
      tags: ["fiber", "enterprise"],
      summary: "Executive-ready storyline for fiber modernization deals",
      storageUrl: "https://assets.metrowave/revops/fiber-outcomes-v3-2.pdf",
      owner: "revops.enablement",
      subsidiary: "MetroWave Holdings",
      region: "West Africa",
      usageMetrics: { downloads: 186, crmLinks: 41, lastViewedAt: now },
      createdBy: "revops.enablement",
      approvedBy: "sales.enablement.head",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: randomUUID(),
      tenantSlug,
      title: "Partner Security Playbook",
      assetType: "playbook",
      audience: "partner",
      version: "v1.0",
      status: "published",
      tags: ["security", "partner"],
      summary: "How partners position zero-trust bundles",
      storageUrl: "https://assets.metrowave/revops/security-playbook.pdf",
      owner: "revops.partner.ops",
      subsidiary: "MetroWave Holdings",
      usageMetrics: { downloads: 62, crmLinks: 12, lastViewedAt: now },
      createdBy: "revops.partner.ops",
      createdAt: now,
      updatedAt: now,
    }
  );

  forecasts.push({
    id: randomUUID(),
    tenantSlug,
    periodStart: new Date("2026-02-01").toISOString(),
    periodEnd: new Date("2026-04-30").toISOString(),
    region: "Global",
    subsidiary: "MetroWave Holdings",
    forecastLow: 165000000,
    forecastLikely: 198000000,
    forecastHigh: 232000000,
    confidence: 0.72,
    methodology: "Bottom-up + weighted pipeline",
    assumptions: [
      "Seasonal uptick in Q2 enterprise refresh",
      "Partner attach rate improves by 5%",
    ],
    riskAlerts: [
      { id: "risk-1", label: "Datacenter delays", severity: "medium", detail: "Two projects flagged by delivery" },
      { id: "risk-2", label: "Partner readiness", severity: "low" },
    ],
    createdBy: "revops.forecast",
    createdAt: now,
    updatedAt: now,
  });

  return {
    campaigns,
    leadSources,
    campaignCosts,
    revenueAttributions,
    salesTargets,
    performanceSnapshots,
    enablementAssets,
    forecasts,
    crmDeals,
  };
}

function getCampaignRecord(tenantSlug: string, campaignId: string) {
  const store = ensureStore(tenantSlug);
  return store.campaigns.find((campaign) => campaign.id === campaignId) ?? null;
}

function recalcCampaignFinancials(store: RevOpsTenantStore, campaignId: string) {
  const campaign = store.campaigns.find((item) => item.id === campaignId);
  if (!campaign) return;
  const spend = store.campaignCosts.filter((cost) => cost.campaignId === campaignId).reduce((sum, cost) => sum + cost.amount, 0);
  campaign.actualSpend = toMoney(spend || campaign.actualSpend);
  const revenue = store.revenueAttributions.filter((row) => row.campaignId === campaignId).reduce((sum, row) => sum + row.recognizedRevenue, 0);
  campaign.revenueAttributed = toMoney(revenue || campaign.revenueAttributed);
  campaign.roi = computeRoi(campaign.revenueAttributed, campaign.actualSpend || campaign.budget || 1);
  campaign.updatedAt = new Date().toISOString();
}

export function listCampaigns(tenantSlug: string, filters: CampaignFilters = {}): Campaign[] {
  const store = ensureStore(tenantSlug);
  return store.campaigns.filter((campaign) => {
    if (filters.status && campaign.status !== filters.status) return false;
    if (filters.channel && campaign.channel !== filters.channel) return false;
    if (filters.region && campaign.region !== filters.region) return false;
    return true;
  });
}

export function getCampaign(tenantSlug: string, campaignId: string): Campaign | null {
  return getCampaignRecord(tenantSlug, campaignId);
}

export type CreateCampaignInput = {
  tenantSlug: string;
  name: string;
  objective: string;
  channel: DemandChannel;
  region: string;
  branch?: string;
  subsidiary: string;
  startDate: string;
  endDate?: string;
  budget: number;
  attributionModel?: AttributionModel;
  targetSegments?: string[];
  createdBy: string;
};

export function createCampaign(input: CreateCampaignInput): Campaign {
  const store = ensureStore(input.tenantSlug);
  const now = new Date().toISOString();
  const campaign: Campaign = {
    id: randomUUID(),
    tenantSlug: input.tenantSlug,
    subsidiary: input.subsidiary,
    region: input.region,
    branch: input.branch,
    campaignCode: `REV-${new Date().getFullYear()}-${String(store.campaigns.length + 1).padStart(3, "0")}`,
    name: input.name,
    objective: input.objective,
    status: "pending_approval",
    channel: input.channel,
    startDate: input.startDate,
    endDate: input.endDate,
    budget: input.budget,
    committedSpend: 0,
    actualSpend: 0,
    expectedPipeline: 0,
    pipelineInfluenced: 0,
    revenueAttributed: 0,
    roi: 0,
    approval: { status: "pending" },
    targetSegments: input.targetSegments ?? [],
    attributionModel: input.attributionModel ?? "linear",
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };
  store.campaigns.unshift(campaign);
  return campaign;
}

export function updateCampaign(
  tenantSlug: string,
  campaignId: string,
  updates: Partial<Pick<Campaign, "status" | "approval" | "budget" | "committedSpend" | "expectedPipeline">>
): Campaign | null {
  const store = ensureStore(tenantSlug);
  const campaign = store.campaigns.find((item) => item.id === campaignId);
  if (!campaign) return null;
  if (updates.status) campaign.status = updates.status;
  if (updates.approval) campaign.approval = { ...campaign.approval, ...updates.approval };
  if (typeof updates.budget === "number") campaign.budget = updates.budget;
  if (typeof updates.committedSpend === "number") campaign.committedSpend = updates.committedSpend;
  if (typeof updates.expectedPipeline === "number") campaign.expectedPipeline = updates.expectedPipeline;
  campaign.updatedAt = new Date().toISOString();
  return campaign;
}

export type CampaignCostInput = {
  tenantSlug: string;
  campaignId: string;
  amount: number;
  currency: string;
  costCenter: string;
  description: string;
  spendDate: string;
  region: string;
  branch?: string;
  subsidiary: string;
  recordedBy: string;
  approvedBy?: string;
};

export function listCampaignCosts(tenantSlug: string, campaignId: string): CampaignCost[] {
  const store = ensureStore(tenantSlug);
  return store.campaignCosts.filter((cost) => cost.campaignId === campaignId);
}

export function recordCampaignCost(input: CampaignCostInput): CampaignCost {
  const store = ensureStore(input.tenantSlug);
  const cost: CampaignCost = {
    id: randomUUID(),
    tenantSlug: input.tenantSlug,
    campaignId: input.campaignId,
    subsidiary: input.subsidiary,
    region: input.region,
    branch: input.branch,
    costCenter: input.costCenter,
    description: input.description,
    amount: input.amount,
    currency: input.currency,
    spendDate: input.spendDate,
    recordedBy: input.recordedBy,
    approvedBy: input.approvedBy,
    createdAt: new Date().toISOString(),
  };
  store.campaignCosts.push(cost);
  recalcCampaignFinancials(store, input.campaignId);
  return cost;
}

export function listLeadSources(tenantSlug: string, filters: LeadSourceFilters = {}): LeadSource[] {
  const store = ensureStore(tenantSlug);
  return store.leadSources.filter((source) => {
    if (filters.channel && source.channel !== filters.channel) return false;
    if (filters.region && source.region !== filters.region) return false;
    if (filters.status && source.status !== filters.status) return false;
    return true;
  });
}

export type CreateLeadSourceInput = {
  tenantSlug: string;
  name: string;
  channel: DemandChannel;
  region: string;
  branch?: string;
  subsidiary: string;
  costCenter: string;
  campaignId?: string;
  createdBy: string;
};

export function createLeadSource(input: CreateLeadSourceInput): LeadSource {
  const store = ensureStore(input.tenantSlug);
  const source: LeadSource = {
    id: randomUUID(),
    tenantSlug: input.tenantSlug,
    name: input.name,
    channel: input.channel,
    campaignId: input.campaignId,
    costCenter: input.costCenter,
    region: input.region,
    branch: input.branch,
    subsidiary: input.subsidiary,
    status: "active",
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  };
  store.leadSources.push(source);
  return source;
}

export function calculateAttributionSummary(tenantSlug: string, model: AttributionModel = "linear"): AttributionSummary {
  const store = ensureStore(tenantSlug);
  const relevant = store.revenueAttributions.filter((row) => row.model === model);
  const totalRevenue = relevant.reduce((sum, row) => sum + row.recognizedRevenue, 0);
  const spendByCampaign = new Map<string, number>();
  store.campaignCosts.forEach((cost) => {
    const current = spendByCampaign.get(cost.campaignId) ?? 0;
    spendByCampaign.set(cost.campaignId, current + cost.amount);
  });

  const campaignBreakdown = relevant.reduce<Array<{ campaignId: string; name: string; revenue: number; spend: number; roi: number; influencedDeals: number }>>((acc, row) => {
    if (!row.campaignId) return acc;
    const existing = acc.find((item) => item.campaignId === row.campaignId);
    if (existing) {
      existing.revenue += row.recognizedRevenue;
      existing.influencedDeals += 1;
      existing.spend = spendByCampaign.get(row.campaignId) ?? existing.spend;
      existing.roi = computeRoi(existing.revenue, existing.spend || 1);
      return acc;
    }
    const campaign = store.campaigns.find((item) => item.id === row.campaignId);
    acc.push({
      campaignId: row.campaignId,
      name: campaign?.name ?? "Unknown",
      revenue: row.recognizedRevenue,
      spend: spendByCampaign.get(row.campaignId) ?? campaign?.actualSpend ?? 0,
      roi: computeRoi(row.recognizedRevenue, spendByCampaign.get(row.campaignId) ?? campaign?.actualSpend ?? 1),
      influencedDeals: 1,
    });
    return acc;
  }, []);

  const channelBreakdown = relevant.reduce<Record<DemandChannel, { revenue: number; spend: number; deals: number }>>((acc, row) => {
    const bucket = acc[row.channel] ?? { revenue: 0, spend: 0, deals: 0 };
    bucket.revenue += row.recognizedRevenue;
    const spend = row.campaignId ? spendByCampaign.get(row.campaignId) ?? 0 : 0;
    bucket.spend += spend / Math.max(1, campaignBreakdown.length);
    bucket.deals += 1;
    acc[row.channel] = bucket;
    return acc;
  }, {} as Record<DemandChannel, { revenue: number; spend: number; deals: number }>);

  const regions = relevant.reduce<Record<string, { revenue: number; spend: number }>>((acc, row) => {
    const bucket = acc[row.region] ?? { revenue: 0, spend: 0 };
    bucket.revenue += row.recognizedRevenue;
    const spend = row.campaignId ? spendByCampaign.get(row.campaignId) ?? 0 : 0;
    bucket.spend += spend / Math.max(1, campaignBreakdown.length);
    acc[row.region] = bucket;
    return acc;
  }, {});

  const totals = {
    revenue: toMoney(totalRevenue),
    spend: toMoney(Array.from(spendByCampaign.values()).reduce((sum, value) => sum + value, 0)),
    roi: computeRoi(totalRevenue, Array.from(spendByCampaign.values()).reduce((sum, value) => sum + value, 1)),
    opportunities: relevant.length,
  };

  return {
    model,
    totals,
    campaigns: campaignBreakdown.map((item) => ({
      ...item,
      revenue: toMoney(item.revenue),
      spend: toMoney(item.spend),
      roi: computeRoi(item.revenue, item.spend || 1),
    })),
    channels: (Object.keys(channelBreakdown) as DemandChannel[]).map((channel) => {
      const data = channelBreakdown[channel];
      return {
        channel,
        revenue: toMoney(data.revenue),
        spend: toMoney(data.spend),
        roi: computeRoi(data.revenue, data.spend || 1),
        costPerAcquisition: data.deals ? toMoney(data.spend / data.deals) : 0,
      };
    }),
    regions: Object.entries(regions).map(([region, data]) => ({
      region,
      revenue: toMoney(data.revenue),
      spend: toMoney(data.spend),
      roi: computeRoi(data.revenue, data.spend || 1),
    })),
  };
}

export function getSalesPerformanceSnapshot(tenantSlug: string): { snapshot: SalesPerformanceSnapshot | null; targets: SalesTarget[] } {
  const store = ensureStore(tenantSlug);
  const snapshot = store.performanceSnapshots[0] ?? null;
  const targets = store.salesTargets.sort((a, b) => b.period.localeCompare(a.period));
  return { snapshot, targets };
}

export function upsertSalesTarget(target: SalesTarget): SalesTarget {
  const store = ensureStore(target.tenantSlug);
  const existingIndex = store.salesTargets.findIndex((row) => row.id === target.id);
  if (existingIndex >= 0) {
    store.salesTargets[existingIndex] = target;
  } else {
    store.salesTargets.push(target);
  }
  return target;
}

export function listEnablementAssets(tenantSlug: string): EnablementAsset[] {
  const store = ensureStore(tenantSlug);
  return store.enablementAssets;
}

export type CreateEnablementAssetInput = {
  tenantSlug: string;
  title: string;
  assetType: EnablementAsset["assetType"];
  audience: EnablementAsset["audience"];
  version?: string;
  tags?: string[];
  summary: string;
  storageUrl: string;
  owner: string;
  subsidiary: string;
  region?: string;
  createdBy: string;
};

export function createEnablementAsset(input: CreateEnablementAssetInput): EnablementAsset {
  const store = ensureStore(input.tenantSlug);
  const now = new Date().toISOString();
  const asset: EnablementAsset = {
    id: randomUUID(),
    tenantSlug: input.tenantSlug,
    title: input.title,
    assetType: input.assetType,
    audience: input.audience,
    version: input.version ?? "v1.0",
    status: "published",
    tags: input.tags ?? [],
    summary: input.summary,
    storageUrl: input.storageUrl,
    owner: input.owner,
    subsidiary: input.subsidiary,
    region: input.region,
    usageMetrics: { downloads: 0, crmLinks: 0 },
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };
  store.enablementAssets.unshift(asset);
  return asset;
}

export function recordAssetUsage(tenantSlug: string, assetId: string, field: "downloads" | "crmLinks") {
  const store = ensureStore(tenantSlug);
  const asset = store.enablementAssets.find((item) => item.id === assetId);
  if (!asset) return null;
  asset.usageMetrics[field] += 1;
  asset.usageMetrics.lastViewedAt = new Date().toISOString();
  asset.updatedAt = asset.usageMetrics.lastViewedAt;
  return asset;
}

export function getRevenueForecast(tenantSlug: string): RevenueForecast | null {
  const store = ensureStore(tenantSlug);
  return store.forecasts[store.forecasts.length - 1] ?? null;
}

export function getRevOpsOverview(tenantSlug: string): RevOpsOverviewSnapshot {
  const store = ensureStore(tenantSlug);
  const snapshot = store.performanceSnapshots[0];
  const totals = store.salesTargets.reduce(
    (acc, target) => {
      acc.target += target.targetAmount;
      acc.actual += target.achievedAmount;
      return acc;
    },
    { actual: 0, target: 0 }
  );

  const overview: RevOpsOverviewSnapshot = {
    metrics: [
      {
        id: "revenue",
        label: "Revenue vs target",
        value: `${(totals.actual / 1_000_000).toFixed(1)}M / ${(totals.target / 1_000_000).toFixed(1)}M`,
        delta: snapshot ? Number(((snapshot.revenueAchieved / snapshot.revenueTarget - 1) * 100).toFixed(1)) : undefined,
        deltaDirection: snapshot && snapshot.revenueAchieved >= snapshot.revenueTarget ? "up" : "down",
      },
      {
        id: "campaign_roi",
        label: "Avg campaign ROI",
        value: `${(
          store.campaigns.reduce((sum, item) => sum + item.roi, 0) / Math.max(store.campaigns.length, 1)
        ).toFixed(2)}x`,
      },
      {
        id: "funnel",
        label: "Funnel leakage",
        value: snapshot ? `${Math.round(snapshot.funnelLeakage.at(-1)?.leakage ?? 0) * 100}%` : "--",
      },
      {
        id: "cost_efficiency",
        label: "Cost per revenue",
        value: `${(
          store.campaignCosts.reduce((sum, cost) => sum + cost.amount, 0) /
          Math.max(store.revenueAttributions.reduce((sum, row) => sum + row.recognizedRevenue, 0), 1)
        ).toFixed(2)}x`,
      },
    ],
    revenueVsTarget: {
      period: snapshot?.periodLabel ?? "",
      actual: snapshot?.revenueAchieved ?? totals.actual,
      target: snapshot?.revenueTarget ?? totals.target,
    },
    campaignRoi: store.campaigns.map((campaign) => ({
      campaignId: campaign.id,
      name: campaign.name,
      roi: campaign.roi,
      spend: campaign.actualSpend,
      revenue: campaign.revenueAttributed,
    })),
    funnelLeakage: snapshot?.funnelLeakage.map((row) => ({ stage: row.stage, leakPercent: toMoney(row.leakage * 100) })) ?? [],
    costVsRevenue: {
      spend: store.campaignCosts.reduce((sum, cost) => sum + cost.amount, 0),
      revenue: store.revenueAttributions.reduce((sum, row) => sum + row.recognizedRevenue, 0),
      timeframe: snapshot?.periodLabel ?? "Current",
    },
    regionalPerformance: snapshot?.regionalPerformance ?? [],
    executiveHighlights: [
      "RevOps is ingesting CRM + Finance data in read-only mode to avoid duplication.",
      "Campaign ROI and attribution models can be tuned without touching CRM opportunities.",
      "Enablement assets are versioned within RevOps and referenced by CRM links.",
    ],
  };

  return overview;
}
