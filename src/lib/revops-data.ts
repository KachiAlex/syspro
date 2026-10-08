import { randomUUID } from "crypto";
import { db } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { emitAutomationEvent } from "@/lib/automation/emit";

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

function toMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeRoi(revenue: number, spend: number): number {
  if (spend <= 0) return 0;
  return Number(((revenue - spend) / spend).toFixed(2));
}

function toNum(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function ensureRevOpsTables(...args: Parameters<typeof ensureRevOpsTablesRun>) {
  return ensureOnce("revops-data:ensureRevOpsTables", () => ensureRevOpsTablesRun(...args));
}

async function ensureRevOpsTablesRun(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS revops_campaigns (
      id text primary key,
      tenant_slug text not null,
      subsidiary text,
      region text,
      branch text,
      campaign_code text,
      name text not null,
      objective text,
      status text default 'draft',
      channel text,
      start_date text,
      end_date text,
      budget numeric default 0,
      committed_spend numeric default 0,
      actual_spend numeric default 0,
      expected_pipeline numeric default 0,
      pipeline_influenced numeric default 0,
      revenue_attributed numeric default 0,
      roi numeric default 0,
      approval_status text,
      approved_by text,
      approved_at timestamptz,
      target_segments jsonb default '[]',
      attribution_model text default 'linear',
      created_by text,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      metadata jsonb
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_revops_campaigns_tenant ON revops_campaigns (tenant_slug)`);
  await db.query(`ALTER TABLE revops_campaigns ADD COLUMN IF NOT EXISTS subsidiary text`);
  await db.query(`ALTER TABLE revops_campaigns ADD COLUMN IF NOT EXISTS region text`);
  await db.query(`ALTER TABLE revops_campaigns ADD COLUMN IF NOT EXISTS branch text`);
  await db.query(`ALTER TABLE revops_campaigns ADD COLUMN IF NOT EXISTS campaign_code text`);
  await db.query(`ALTER TABLE revops_campaigns ADD COLUMN IF NOT EXISTS objective text`);
  await db.query(`ALTER TABLE revops_campaigns ADD COLUMN IF NOT EXISTS status text default 'draft'`);
  await db.query(`ALTER TABLE revops_campaigns ADD COLUMN IF NOT EXISTS channel text`);
  await db.query(`ALTER TABLE revops_campaigns ADD COLUMN IF NOT EXISTS start_date text`);
  await db.query(`ALTER TABLE revops_campaigns ADD COLUMN IF NOT EXISTS end_date text`);
  await db.query(`ALTER TABLE revops_campaigns ADD COLUMN IF NOT EXISTS budget numeric default 0`);
  await db.query(`ALTER TABLE revops_campaigns ADD COLUMN IF NOT EXISTS committed_spend numeric default 0`);
  await db.query(`ALTER TABLE revops_campaigns ADD COLUMN IF NOT EXISTS actual_spend numeric default 0`);
  await db.query(`ALTER TABLE revops_campaigns ADD COLUMN IF NOT EXISTS expected_pipeline numeric default 0`);
  await db.query(`ALTER TABLE revops_campaigns ADD COLUMN IF NOT EXISTS pipeline_influenced numeric default 0`);
  await db.query(`ALTER TABLE revops_campaigns ADD COLUMN IF NOT EXISTS revenue_attributed numeric default 0`);
  await db.query(`ALTER TABLE revops_campaigns ADD COLUMN IF NOT EXISTS roi numeric default 0`);
  await db.query(`ALTER TABLE revops_campaigns ADD COLUMN IF NOT EXISTS approval_status text`);
  await db.query(`ALTER TABLE revops_campaigns ADD COLUMN IF NOT EXISTS approved_by text`);
  await db.query(`ALTER TABLE revops_campaigns ADD COLUMN IF NOT EXISTS approved_at timestamptz`);
  await db.query(`ALTER TABLE revops_campaigns ADD COLUMN IF NOT EXISTS target_segments jsonb default '[]'`);
  await db.query(`ALTER TABLE revops_campaigns ADD COLUMN IF NOT EXISTS attribution_model text default 'linear'`);
  await db.query(`ALTER TABLE revops_campaigns ADD COLUMN IF NOT EXISTS created_by text`);
  await db.query(`ALTER TABLE revops_campaigns ADD COLUMN IF NOT EXISTS updated_at timestamptz default now()`);
  await db.query(`ALTER TABLE revops_campaigns ADD COLUMN IF NOT EXISTS metadata jsonb`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS revops_campaign_costs (
      id text primary key,
      tenant_slug text not null,
      campaign_id text not null,
      subsidiary text,
      region text,
      branch text,
      cost_center text,
      description text,
      amount numeric default 0,
      currency text default 'USD',
      spend_date text,
      recorded_by text,
      approved_by text,
      created_at timestamptz default now()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_revops_campaign_costs_tenant ON revops_campaign_costs (tenant_slug)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_revops_campaign_costs_campaign ON revops_campaign_costs (campaign_id)`);
  await db.query(`ALTER TABLE revops_campaign_costs ADD COLUMN IF NOT EXISTS subsidiary text`);
  await db.query(`ALTER TABLE revops_campaign_costs ADD COLUMN IF NOT EXISTS region text`);
  await db.query(`ALTER TABLE revops_campaign_costs ADD COLUMN IF NOT EXISTS branch text`);
  await db.query(`ALTER TABLE revops_campaign_costs ADD COLUMN IF NOT EXISTS cost_center text`);
  await db.query(`ALTER TABLE revops_campaign_costs ADD COLUMN IF NOT EXISTS description text`);
  await db.query(`ALTER TABLE revops_campaign_costs ADD COLUMN IF NOT EXISTS currency text default 'USD'`);
  await db.query(`ALTER TABLE revops_campaign_costs ADD COLUMN IF NOT EXISTS spend_date text`);
  await db.query(`ALTER TABLE revops_campaign_costs ADD COLUMN IF NOT EXISTS recorded_by text`);
  await db.query(`ALTER TABLE revops_campaign_costs ADD COLUMN IF NOT EXISTS approved_by text`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS revops_lead_sources (
      id text primary key,
      tenant_slug text not null,
      name text not null,
      channel text,
      campaign_id text,
      cost_center text,
      region text,
      branch text,
      subsidiary text,
      status text default 'active',
      metadata jsonb,
      created_by text,
      created_at timestamptz default now()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_revops_lead_sources_tenant ON revops_lead_sources (tenant_slug)`);
  await db.query(`ALTER TABLE revops_lead_sources ADD COLUMN IF NOT EXISTS channel text`);
  await db.query(`ALTER TABLE revops_lead_sources ADD COLUMN IF NOT EXISTS campaign_id text`);
  await db.query(`ALTER TABLE revops_lead_sources ADD COLUMN IF NOT EXISTS cost_center text`);
  await db.query(`ALTER TABLE revops_lead_sources ADD COLUMN IF NOT EXISTS region text`);
  await db.query(`ALTER TABLE revops_lead_sources ADD COLUMN IF NOT EXISTS branch text`);
  await db.query(`ALTER TABLE revops_lead_sources ADD COLUMN IF NOT EXISTS subsidiary text`);
  await db.query(`ALTER TABLE revops_lead_sources ADD COLUMN IF NOT EXISTS status text default 'active'`);
  await db.query(`ALTER TABLE revops_lead_sources ADD COLUMN IF NOT EXISTS metadata jsonb`);
  await db.query(`ALTER TABLE revops_lead_sources ADD COLUMN IF NOT EXISTS created_by text`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS revops_revenue_attributions (
      id text primary key,
      tenant_slug text not null,
      campaign_id text,
      lead_source_id text,
      crm_opportunity_id text,
      crm_deal_id text,
      crm_value numeric default 0,
      recognized_revenue numeric default 0,
      allocation_weight numeric default 0,
      model text,
      region text,
      branch text,
      channel text,
      subsidiary text,
      closed_date text,
      metadata jsonb,
      created_at timestamptz default now()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_revops_revenue_attributions_tenant ON revops_revenue_attributions (tenant_slug)`);
  await db.query(`ALTER TABLE revops_revenue_attributions ADD COLUMN IF NOT EXISTS campaign_id text`);
  await db.query(`ALTER TABLE revops_revenue_attributions ADD COLUMN IF NOT EXISTS lead_source_id text`);
  await db.query(`ALTER TABLE revops_revenue_attributions ADD COLUMN IF NOT EXISTS crm_opportunity_id text`);
  await db.query(`ALTER TABLE revops_revenue_attributions ADD COLUMN IF NOT EXISTS crm_deal_id text`);
  await db.query(`ALTER TABLE revops_revenue_attributions ADD COLUMN IF NOT EXISTS crm_value numeric default 0`);
  await db.query(`ALTER TABLE revops_revenue_attributions ADD COLUMN IF NOT EXISTS recognized_revenue numeric default 0`);
  await db.query(`ALTER TABLE revops_revenue_attributions ADD COLUMN IF NOT EXISTS allocation_weight numeric default 0`);
  await db.query(`ALTER TABLE revops_revenue_attributions ADD COLUMN IF NOT EXISTS model text`);
  await db.query(`ALTER TABLE revops_revenue_attributions ADD COLUMN IF NOT EXISTS region text`);
  await db.query(`ALTER TABLE revops_revenue_attributions ADD COLUMN IF NOT EXISTS branch text`);
  await db.query(`ALTER TABLE revops_revenue_attributions ADD COLUMN IF NOT EXISTS channel text`);
  await db.query(`ALTER TABLE revops_revenue_attributions ADD COLUMN IF NOT EXISTS subsidiary text`);
  await db.query(`ALTER TABLE revops_revenue_attributions ADD COLUMN IF NOT EXISTS closed_date text`);
  await db.query(`ALTER TABLE revops_revenue_attributions ADD COLUMN IF NOT EXISTS metadata jsonb`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS revops_sales_targets (
      id text primary key,
      tenant_slug text not null,
      period text,
      period_type text,
      region text,
      branch text,
      subsidiary text,
      owner_type text,
      owner_id text,
      owner_name text,
      target_amount numeric default 0,
      achieved_amount numeric default 0,
      currency text default 'USD',
      created_by text,
      approved_by text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_revops_sales_targets_tenant ON revops_sales_targets (tenant_slug)`);
  await db.query(`ALTER TABLE revops_sales_targets ADD COLUMN IF NOT EXISTS period_type text`);
  await db.query(`ALTER TABLE revops_sales_targets ADD COLUMN IF NOT EXISTS region text`);
  await db.query(`ALTER TABLE revops_sales_targets ADD COLUMN IF NOT EXISTS branch text`);
  await db.query(`ALTER TABLE revops_sales_targets ADD COLUMN IF NOT EXISTS subsidiary text`);
  await db.query(`ALTER TABLE revops_sales_targets ADD COLUMN IF NOT EXISTS owner_type text`);
  await db.query(`ALTER TABLE revops_sales_targets ADD COLUMN IF NOT EXISTS owner_id text`);
  await db.query(`ALTER TABLE revops_sales_targets ADD COLUMN IF NOT EXISTS owner_name text`);
  await db.query(`ALTER TABLE revops_sales_targets ADD COLUMN IF NOT EXISTS target_amount numeric default 0`);
  await db.query(`ALTER TABLE revops_sales_targets ADD COLUMN IF NOT EXISTS achieved_amount numeric default 0`);
  await db.query(`ALTER TABLE revops_sales_targets ADD COLUMN IF NOT EXISTS currency text default 'USD'`);
  await db.query(`ALTER TABLE revops_sales_targets ADD COLUMN IF NOT EXISTS approved_by text`);
  await db.query(`ALTER TABLE revops_sales_targets ADD COLUMN IF NOT EXISTS updated_at timestamptz default now()`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS revops_sales_performance_snapshots (
      id text primary key,
      tenant_slug text not null,
      period text,
      period_label text,
      win_rate numeric default 0,
      revenue_achieved numeric default 0,
      revenue_target numeric default 0,
      deal_velocity_days numeric default 0,
      avg_deal_size numeric default 0,
      pipeline_coverage numeric default 0,
      rep_productivity jsonb default '[]',
      regional_performance jsonb default '[]',
      funnel_leakage jsonb default '[]',
      created_at timestamptz default now()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_revops_sales_perf_tenant ON revops_sales_performance_snapshots (tenant_slug)`);
  await db.query(`ALTER TABLE revops_sales_performance_snapshots ADD COLUMN IF NOT EXISTS period text`);
  await db.query(`ALTER TABLE revops_sales_performance_snapshots ADD COLUMN IF NOT EXISTS period_label text`);
  await db.query(`ALTER TABLE revops_sales_performance_snapshots ADD COLUMN IF NOT EXISTS win_rate numeric default 0`);
  await db.query(`ALTER TABLE revops_sales_performance_snapshots ADD COLUMN IF NOT EXISTS revenue_achieved numeric default 0`);
  await db.query(`ALTER TABLE revops_sales_performance_snapshots ADD COLUMN IF NOT EXISTS revenue_target numeric default 0`);
  await db.query(`ALTER TABLE revops_sales_performance_snapshots ADD COLUMN IF NOT EXISTS deal_velocity_days numeric default 0`);
  await db.query(`ALTER TABLE revops_sales_performance_snapshots ADD COLUMN IF NOT EXISTS avg_deal_size numeric default 0`);
  await db.query(`ALTER TABLE revops_sales_performance_snapshots ADD COLUMN IF NOT EXISTS pipeline_coverage numeric default 0`);
  await db.query(`ALTER TABLE revops_sales_performance_snapshots ADD COLUMN IF NOT EXISTS rep_productivity jsonb default '[]'`);
  await db.query(`ALTER TABLE revops_sales_performance_snapshots ADD COLUMN IF NOT EXISTS regional_performance jsonb default '[]'`);
  await db.query(`ALTER TABLE revops_sales_performance_snapshots ADD COLUMN IF NOT EXISTS funnel_leakage jsonb default '[]'`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS revops_enablement_assets (
      id text primary key,
      tenant_slug text not null,
      title text not null,
      asset_type text,
      audience text,
      version text,
      status text default 'published',
      tags jsonb default '[]',
      summary text,
      storage_url text,
      owner text,
      subsidiary text,
      region text,
      usage_metrics jsonb default '{}',
      created_by text,
      approved_by text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_revops_enablement_tenant ON revops_enablement_assets (tenant_slug)`);
  await db.query(`ALTER TABLE revops_enablement_assets ADD COLUMN IF NOT EXISTS asset_type text`);
  await db.query(`ALTER TABLE revops_enablement_assets ADD COLUMN IF NOT EXISTS audience text`);
  await db.query(`ALTER TABLE revops_enablement_assets ADD COLUMN IF NOT EXISTS version text`);
  await db.query(`ALTER TABLE revops_enablement_assets ADD COLUMN IF NOT EXISTS status text default 'published'`);
  await db.query(`ALTER TABLE revops_enablement_assets ADD COLUMN IF NOT EXISTS tags jsonb default '[]'`);
  await db.query(`ALTER TABLE revops_enablement_assets ADD COLUMN IF NOT EXISTS summary text`);
  await db.query(`ALTER TABLE revops_enablement_assets ADD COLUMN IF NOT EXISTS storage_url text`);
  await db.query(`ALTER TABLE revops_enablement_assets ADD COLUMN IF NOT EXISTS owner text`);
  await db.query(`ALTER TABLE revops_enablement_assets ADD COLUMN IF NOT EXISTS subsidiary text`);
  await db.query(`ALTER TABLE revops_enablement_assets ADD COLUMN IF NOT EXISTS region text`);
  await db.query(`ALTER TABLE revops_enablement_assets ADD COLUMN IF NOT EXISTS usage_metrics jsonb default '{}'`);
  await db.query(`ALTER TABLE revops_enablement_assets ADD COLUMN IF NOT EXISTS approved_by text`);
  await db.query(`ALTER TABLE revops_enablement_assets ADD COLUMN IF NOT EXISTS updated_at timestamptz default now()`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS revops_revenue_forecasts (
      id text primary key,
      tenant_slug text not null,
      period_start text,
      period_end text,
      region text,
      branch text,
      subsidiary text,
      forecast_low numeric default 0,
      forecast_likely numeric default 0,
      forecast_high numeric default 0,
      confidence numeric default 0,
      methodology text,
      assumptions jsonb default '[]',
      risk_alerts jsonb default '[]',
      created_by text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_revops_forecasts_tenant ON revops_revenue_forecasts (tenant_slug)`);
  await db.query(`ALTER TABLE revops_revenue_forecasts ADD COLUMN IF NOT EXISTS period_start text`);
  await db.query(`ALTER TABLE revops_revenue_forecasts ADD COLUMN IF NOT EXISTS period_end text`);
  await db.query(`ALTER TABLE revops_revenue_forecasts ADD COLUMN IF NOT EXISTS region text`);
  await db.query(`ALTER TABLE revops_revenue_forecasts ADD COLUMN IF NOT EXISTS branch text`);
  await db.query(`ALTER TABLE revops_revenue_forecasts ADD COLUMN IF NOT EXISTS subsidiary text`);
  await db.query(`ALTER TABLE revops_revenue_forecasts ADD COLUMN IF NOT EXISTS forecast_low numeric default 0`);
  await db.query(`ALTER TABLE revops_revenue_forecasts ADD COLUMN IF NOT EXISTS forecast_likely numeric default 0`);
  await db.query(`ALTER TABLE revops_revenue_forecasts ADD COLUMN IF NOT EXISTS forecast_high numeric default 0`);
  await db.query(`ALTER TABLE revops_revenue_forecasts ADD COLUMN IF NOT EXISTS confidence numeric default 0`);
  await db.query(`ALTER TABLE revops_revenue_forecasts ADD COLUMN IF NOT EXISTS methodology text`);
  await db.query(`ALTER TABLE revops_revenue_forecasts ADD COLUMN IF NOT EXISTS assumptions jsonb default '[]'`);
  await db.query(`ALTER TABLE revops_revenue_forecasts ADD COLUMN IF NOT EXISTS risk_alerts jsonb default '[]'`);
  await db.query(`ALTER TABLE revops_revenue_forecasts ADD COLUMN IF NOT EXISTS updated_at timestamptz default now()`);
}

function normalizeCampaign(row: any): Campaign {
  return {
    id: row.id,
    tenantSlug: row.tenantSlug,
    subsidiary: row.subsidiary ?? "",
    region: row.region ?? "",
    branch: row.branch ?? undefined,
    campaignCode: row.campaignCode ?? "",
    name: row.name,
    objective: row.objective ?? "",
    status: row.status ?? "draft",
    channel: row.channel ?? "email",
    startDate: row.startDate ?? "",
    endDate: row.endDate ?? undefined,
    budget: toNum(row.budget),
    committedSpend: toNum(row.committedSpend),
    actualSpend: toNum(row.actualSpend),
    expectedPipeline: toNum(row.expectedPipeline),
    pipelineInfluenced: toNum(row.pipelineInfluenced),
    revenueAttributed: toNum(row.revenueAttributed),
    roi: toNum(row.roi),
    approval: {
      status: row.approvalStatus ?? "draft",
      approvedBy: row.approvedBy ?? undefined,
      approvedAt: row.approvedAt ?? undefined,
    },
    targetSegments: Array.isArray(row.targetSegments) ? row.targetSegments : [],
    attributionModel: (row.attributionModel ?? "linear") as AttributionModel,
    createdBy: row.createdBy ?? "",
    approvedBy: row.approvedBy ?? undefined,
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? new Date().toISOString(),
    metadata: row.metadata ?? undefined,
  };
}

export async function listCampaigns(tenantSlug: string, filters: CampaignFilters = {}): Promise<Campaign[]> {
  await ensureRevOpsTables();
  const conditions = ["tenant_slug = $1"];
  const params: any[] = [tenantSlug];
  let idx = 2;
  if (filters.status) {
    conditions.push(`status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters.channel) {
    conditions.push(`channel = $${idx++}`);
    params.push(filters.channel);
  }
  if (filters.region) {
    conditions.push(`region = $${idx++}`);
    params.push(filters.region);
  }
  const result = await db.query(
    `select * from revops_campaigns where ${conditions.join(" and ")} order by created_at desc`,
    params
  );
  return db.mapRows(result.rows).map(normalizeCampaign);
}

export async function getCampaign(tenantSlug: string, campaignId: string): Promise<Campaign | null> {
  await ensureRevOpsTables();
  const result = await db.query(
    `select * from revops_campaigns where tenant_slug = $1 and id = $2`,
    [tenantSlug, campaignId]
  );
  if (result.rows.length === 0) return null;
  return normalizeCampaign(db.mapRow(result.rows[0]));
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

export async function createCampaign(input: CreateCampaignInput): Promise<Campaign> {
  await ensureRevOpsTables();
  const countResult = await db.query(
    `select count(*)::int as cnt from revops_campaigns where tenant_slug = $1`,
    [input.tenantSlug]
  );
  const seq = (countResult.rows[0]?.cnt ?? 0) + 1;
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.query(
    `insert into revops_campaigns
     (id, tenant_slug, subsidiary, region, branch, campaign_code, name, objective, status, channel, start_date, end_date, budget, committed_spend, actual_spend, expected_pipeline, pipeline_influenced, revenue_attributed, roi, approval_status, target_segments, attribution_model, created_by, created_at, updated_at, metadata)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)`,
    [
      id,
      input.tenantSlug,
      input.subsidiary ?? null,
      input.region ?? null,
      input.branch ?? null,
      `REV-${new Date().getFullYear()}-${String(seq).padStart(3, "0")}`,
      input.name,
      input.objective ?? "",
      "pending_approval",
      input.channel ?? null,
      input.startDate ?? null,
      input.endDate ?? null,
      input.budget ?? 0,
      0,
      0,
      0,
      0,
      0,
      0,
      "pending",
      JSON.stringify(input.targetSegments ?? []),
      input.attributionModel ?? "linear",
      input.createdBy ?? null,
      now,
      now,
      null,
    ]
  );
  return getCampaign(input.tenantSlug, id) as Promise<Campaign>;
}

export async function updateCampaign(
  tenantSlug: string,
  campaignId: string,
  updates: Partial<Pick<Campaign, "status" | "approval" | "budget" | "committedSpend" | "expectedPipeline" | "name" | "channel" | "startDate" | "endDate">>
): Promise<Campaign | null> {
  await ensureRevOpsTables();
  const existing = await getCampaign(tenantSlug, campaignId);
  if (!existing) return null;
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  if (updates.name !== undefined) {
    sets.push(`name = $${idx++}`);
    params.push(updates.name);
  }
  if (updates.channel !== undefined) {
    sets.push(`channel = $${idx++}`);
    params.push(updates.channel);
  }
  if (updates.status !== undefined) {
    sets.push(`status = $${idx++}`);
    params.push(updates.status);
  }
  if (updates.startDate !== undefined) {
    sets.push(`start_date = $${idx++}`);
    params.push(updates.startDate);
  }
  if (updates.endDate !== undefined) {
    sets.push(`end_date = $${idx++}`);
    params.push(updates.endDate);
  }
  if (typeof updates.budget === "number") {
    sets.push(`budget = $${idx++}`);
    params.push(updates.budget);
  }
  if (typeof updates.committedSpend === "number") {
    sets.push(`committed_spend = $${idx++}`);
    params.push(updates.committedSpend);
  }
  if (typeof updates.expectedPipeline === "number") {
    sets.push(`expected_pipeline = $${idx++}`);
    params.push(updates.expectedPipeline);
  }
  if (updates.approval) {
    sets.push(`approval_status = $${idx++}`);
    params.push(updates.approval.status ?? existing.approval.status);
    if (updates.approval.approvedBy !== undefined) {
      sets.push(`approved_by = $${idx++}`);
      params.push(updates.approval.approvedBy);
    }
    if (updates.approval.approvedAt !== undefined) {
      sets.push(`approved_at = $${idx++}`);
      params.push(updates.approval.approvedAt);
    }
  }
  sets.push(`updated_at = $${idx++}`);
  params.push(new Date().toISOString());
  params.push(tenantSlug, campaignId);
  await db.query(
    `update revops_campaigns set ${sets.join(", ")} where tenant_slug = $${idx++} and id = $${idx++}`,
    params
  );
  return getCampaign(tenantSlug, campaignId);
}

export async function deleteCampaign(tenantSlug: string, campaignId: string): Promise<boolean> {
  await ensureRevOpsTables();
  const result = await db.query(
    `delete from revops_campaigns where tenant_slug = $1 and id = $2`,
    [tenantSlug, campaignId]
  );
  return (result.rowCount ?? 0) > 0;
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

export async function listCampaignCosts(tenantSlug: string, campaignId: string): Promise<CampaignCost[]> {
  await ensureRevOpsTables();
  const result = await db.query(
    `select * from revops_campaign_costs where tenant_slug = $1 and campaign_id = $2 order by created_at desc`,
    [tenantSlug, campaignId]
  );
  return db.mapRows(result.rows).map((row: any) => ({
    id: row.id,
    tenantSlug: row.tenantSlug,
    campaignId: row.campaignId,
    subsidiary: row.subsidiary ?? "",
    region: row.region ?? "",
    branch: row.branch ?? undefined,
    costCenter: row.costCenter ?? "",
    description: row.description ?? "",
    amount: toNum(row.amount),
    currency: row.currency ?? "USD",
    spendDate: row.spendDate ?? "",
    recordedBy: row.recordedBy ?? "",
    approvedBy: row.approvedBy ?? undefined,
    createdAt: row.createdAt ?? new Date().toISOString(),
  }));
}

export async function recordCampaignCost(input: CampaignCostInput): Promise<CampaignCost> {
  await ensureRevOpsTables();
  // The campaign must belong to this tenant — otherwise a caller could
  // attach costs to (and roll up into) another tenant's campaign.
  const owned = await db.query(
    `select 1 from revops_campaigns where id = $1 and tenant_slug = $2 limit 1`,
    [input.campaignId, input.tenantSlug]
  );
  if (!owned.rows.length) {
    throw new Error("Campaign not found");
  }
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.query(
    `insert into revops_campaign_costs
     (id, tenant_slug, campaign_id, subsidiary, region, branch, cost_center, description, amount, currency, spend_date, recorded_by, approved_by, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      id,
      input.tenantSlug,
      input.campaignId,
      input.subsidiary ?? null,
      input.region ?? null,
      input.branch ?? null,
      input.costCenter ?? null,
      input.description ?? null,
      input.amount ?? 0,
      input.currency ?? "USD",
      input.spendDate ?? null,
      input.recordedBy ?? null,
      input.approvedBy ?? null,
      now,
    ]
  );
  await db.query(
    `update revops_campaigns set committed_spend = (
       select coalesce(sum(amount), 0) from revops_campaign_costs
       where campaign_id = $1 and tenant_slug = $2
     ), updated_at = $3 where id = $1 and tenant_slug = $2`,
    [input.campaignId, input.tenantSlug, now]
  );
  const campaign = await db.query(
    `select name, budget, committed_spend, revenue_attributed, roi from revops_campaigns where id = $1 and tenant_slug = $2`,
    [input.campaignId, input.tenantSlug]
  );
  const camp = db.mapRow(campaign.rows[0] ?? {});
  emitAutomationEvent(input.tenantSlug, "revops.campaign-performance", {
    campaignId: input.campaignId,
    campaignName: camp.name ?? null,
    costId: id,
    costAmount: input.amount ?? 0,
    currency: input.currency ?? "USD",
    committedSpend: toNum(camp.committedSpend),
    budget: toNum(camp.budget),
    revenueAttributed: toNum(camp.revenueAttributed),
    roi: toNum(camp.roi),
  });
  const result = await db.query(
    `select * from revops_campaign_costs where id = $1`,
    [id]
  );
  const row = db.mapRow(result.rows[0]);
  return {
    id: row.id,
    tenantSlug: row.tenantSlug,
    campaignId: row.campaignId,
    subsidiary: row.subsidiary ?? "",
    region: row.region ?? "",
    branch: row.branch ?? undefined,
    costCenter: row.costCenter ?? "",
    description: row.description ?? "",
    amount: toNum(row.amount),
    currency: row.currency ?? "USD",
    spendDate: row.spendDate ?? "",
    recordedBy: row.recordedBy ?? "",
    approvedBy: row.approvedBy ?? undefined,
    createdAt: row.createdAt ?? now,
  };
}

export async function listLeadSources(tenantSlug: string, filters: LeadSourceFilters = {}): Promise<LeadSource[]> {
  await ensureRevOpsTables();
  const conditions = ["tenant_slug = $1"];
  const params: any[] = [tenantSlug];
  let idx = 2;
  if (filters.channel) {
    conditions.push(`channel = $${idx++}`);
    params.push(filters.channel);
  }
  if (filters.region) {
    conditions.push(`region = $${idx++}`);
    params.push(filters.region);
  }
  if (filters.status) {
    conditions.push(`status = $${idx++}`);
    params.push(filters.status);
  }
  const result = await db.query(
    `select * from revops_lead_sources where ${conditions.join(" and ")} order by created_at desc`,
    params
  );
  return db.mapRows(result.rows).map((row: any) => ({
    id: row.id,
    tenantSlug: row.tenantSlug,
    name: row.name,
    channel: row.channel ?? "email",
    campaignId: row.campaignId ?? undefined,
    costCenter: row.costCenter ?? "",
    region: row.region ?? "",
    branch: row.branch ?? undefined,
    subsidiary: row.subsidiary ?? "",
    status: row.status ?? "active",
    metadata: row.metadata ?? undefined,
    createdBy: row.createdBy ?? "",
    createdAt: row.createdAt ?? new Date().toISOString(),
  }));
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

export async function createLeadSource(input: CreateLeadSourceInput): Promise<LeadSource> {
  await ensureRevOpsTables();
  if (input.campaignId) {
    const owned = await db.query(
      `select 1 from revops_campaigns where id = $1 and tenant_slug = $2 limit 1`,
      [input.campaignId, input.tenantSlug]
    );
    if (owned.rows.length === 0) throw new Error("Campaign not found");
  }
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.query(
    `insert into revops_lead_sources
     (id, tenant_slug, name, channel, campaign_id, cost_center, region, branch, subsidiary, status, metadata, created_by, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      id,
      input.tenantSlug,
      input.name,
      input.channel ?? null,
      input.campaignId ?? null,
      input.costCenter ?? null,
      input.region ?? null,
      input.branch ?? null,
      input.subsidiary ?? null,
      "active",
      null,
      input.createdBy ?? null,
      now,
    ]
  );
  const result = await db.query(
    `select * from revops_lead_sources where id = $1`,
    [id]
  );
  const row = db.mapRow(result.rows[0]);
  return {
    id: row.id,
    tenantSlug: row.tenantSlug,
    name: row.name,
    channel: row.channel ?? "email",
    campaignId: row.campaignId ?? undefined,
    costCenter: row.costCenter ?? "",
    region: row.region ?? "",
    branch: row.branch ?? undefined,
    subsidiary: row.subsidiary ?? "",
    status: row.status ?? "active",
    metadata: row.metadata ?? undefined,
    createdBy: row.createdBy ?? "",
    createdAt: row.createdAt ?? now,
  };
}

export async function calculateAttributionSummary(tenantSlug: string, model: AttributionModel = "linear"): Promise<AttributionSummary> {
  await ensureRevOpsTables();
  const result = await db.query(
    `select * from revops_revenue_attributions where tenant_slug = $1 order by closed_date asc, created_at asc`,
    [tenantSlug]
  );
  const rows = db.mapRows(result.rows) as RevenueAttribution[];

  const costResult = await db.query(
    `select campaign_id, coalesce(sum(amount), 0) as spend from revops_campaign_costs where tenant_slug = $1 group by campaign_id`,
    [tenantSlug]
  );
  const spendByCampaign = new Map<string, number>();
  for (const cr of costResult.rows) {
    spendByCampaign.set(cr.campaign_id, toNum(cr.spend));
  }

  const campaignNames = new Map<string, string>();
  const campResult = await db.query(
    `select id, name from revops_campaigns where tenant_slug = $1`,
    [tenantSlug]
  );
  for (const cr of campResult.rows) {
    campaignNames.set(cr.id, cr.name);
  }

  const deals = new Map<string, RevenueAttribution[]>();
  for (const row of rows) {
    const key = row.crmOpportunityId || row.id;
    if (!deals.has(key)) deals.set(key, []);
    deals.get(key)!.push(row);
  }

  const campaignRevenue = new Map<string, number>();
  const campaignDealSet = new Map<string, Set<string>>();
  const channelRevenue = new Map<string, number>();
  const channelDealCount = new Map<string, number>();
  const regionRevenue = new Map<string, number>();
  let totalRevenue = 0;

  for (const [dealId, touchpoints] of deals) {
    const sorted = [...touchpoints].sort((a, b) => {
      const ta = new Date(a.closedDate || (a as any).createdAt || 0).getTime();
      const tb = new Date(b.closedDate || (b as any).createdAt || 0).getTime();
      return ta - tb;
    });
    const dealValue = toNum(sorted[0]?.crmValue ?? sorted[0]?.recognizedRevenue ?? 0);
    const n = sorted.length;

    const creditTouchpoint = (tp: RevenueAttribution, amount: number) => {
      if (tp.campaignId) {
        campaignRevenue.set(tp.campaignId, (campaignRevenue.get(tp.campaignId) ?? 0) + amount);
        if (!campaignDealSet.has(tp.campaignId)) campaignDealSet.set(tp.campaignId, new Set());
        campaignDealSet.get(tp.campaignId)!.add(dealId);
      }
      const ch = tp.channel ?? "unknown";
      channelRevenue.set(ch, (channelRevenue.get(ch) ?? 0) + amount);
      channelDealCount.set(ch, (channelDealCount.get(ch) ?? 0) + 1);
      const reg = tp.region ?? "Unknown";
      regionRevenue.set(reg, (regionRevenue.get(reg) ?? 0) + amount);
    };

    if (model === "first_touch") {
      creditTouchpoint(sorted[0], dealValue);
    } else if (model === "last_touch") {
      creditTouchpoint(sorted[n - 1], dealValue);
    } else {
      const share = n > 0 ? dealValue / n : 0;
      for (const tp of sorted) creditTouchpoint(tp, share);
    }
    totalRevenue += dealValue;
  }

  const totalSpend = Array.from(spendByCampaign.values()).reduce((sum, v) => sum + v, 0);
  const campaignBreakdown = Array.from(campaignRevenue.entries()).map(([campaignId, revenue]) => {
    const spend = spendByCampaign.get(campaignId) ?? 0;
    return {
      campaignId,
      name: campaignNames.get(campaignId) ?? "Unknown",
      revenue: toMoney(revenue),
      spend: toMoney(spend),
      roi: computeRoi(revenue, spend || 1),
      influencedDeals: campaignDealSet.get(campaignId)?.size ?? 0,
    };
  });

  const channelBreakdown = Array.from(channelRevenue.entries()).map(([channel, revenue]) => {
    const spend = totalSpend / Math.max(1, channelRevenue.size);
    const dealsForChannel = channelDealCount.get(channel) ?? 0;
    return {
      channel: channel as DemandChannel,
      revenue: toMoney(revenue),
      spend: toMoney(spend),
      roi: computeRoi(revenue, spend || 1),
      costPerAcquisition: dealsForChannel ? toMoney(spend / dealsForChannel) : 0,
    };
  });

  const regionBreakdown = Array.from(regionRevenue.entries()).map(([region, revenue]) => {
    const spend = totalSpend / Math.max(1, regionRevenue.size);
    return {
      region,
      revenue: toMoney(revenue),
      spend: toMoney(spend),
      roi: computeRoi(revenue, spend || 1),
    };
  });

  const totals = {
    revenue: toMoney(totalRevenue),
    spend: toMoney(totalSpend),
    roi: computeRoi(totalRevenue, totalSpend || 1),
    opportunities: deals.size,
  };

  return {
    model,
    totals,
    campaigns: campaignBreakdown,
    channels: channelBreakdown,
    regions: regionBreakdown,
  };
}

async function refreshSalesPerformanceSnapshot(tenantSlug: string): Promise<void> {
  const latest = await db.query(
    `select created_at from revops_sales_performance_snapshots where tenant_slug = $1 order by created_at desc limit 1`,
    [tenantSlug]
  );
  if (latest.rows.length > 0) {
    const ageMs = Date.now() - new Date(latest.rows[0].created_at).getTime();
    if (ageMs < 6 * 60 * 60 * 1000) return;
  }

  const period = new Date().toISOString().slice(0, 7);
  const deals = (await db.query(
    `select stage, value, currency, assigned_officer_id, created_at, updated_at
     from crm_deals where tenant_slug = $1`,
    [tenantSlug]
  )).rows;

  const won = deals.filter((d: any) => d.stage === "closed_won");
  const lost = deals.filter((d: any) => d.stage === "closed_lost");
  const open = deals.filter((d: any) => d.stage !== "closed_won" && d.stage !== "closed_lost");
  const wonThisPeriod = won.filter((d: any) => new Date(d.updated_at).toISOString().slice(0, 7) === period);

  const revenueAchieved = wonThisPeriod.reduce((sum: number, d: any) => sum + toNum(d.value), 0);
  const closed = won.length + lost.length;
  const winRate = closed > 0 ? (won.length / closed) * 100 : 0;
  const avgDealSize = won.length > 0 ? won.reduce((s: number, d: any) => s + toNum(d.value), 0) / won.length : 0;
  const velocitySamples = won
    .map((d: any) => (new Date(d.updated_at).getTime() - new Date(d.created_at).getTime()) / 86400000)
    .filter((v: number) => Number.isFinite(v) && v >= 0);
  const dealVelocityDays = velocitySamples.length > 0
    ? velocitySamples.reduce((a: number, b: number) => a + b, 0) / velocitySamples.length
    : 0;

  const targets = (await db.query(
    `select * from revops_sales_targets where tenant_slug = $1`,
    [tenantSlug]
  )).rows;
  const currentTargets = targets.filter((t: any) => t.period === period);
  const revenueTarget = currentTargets.reduce((sum: number, t: any) => sum + toNum(t.target_amount), 0);
  const openPipeline = open.reduce((sum: number, d: any) => sum + toNum(d.value), 0);
  const pipelineCoverage = revenueTarget > 0 ? openPipeline / revenueTarget : 0;

  const dealPeriodKey = (d: any, periodType: string) => {
    const iso = new Date(d.updated_at).toISOString();
    if (periodType === "quarterly") {
      const q = Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1;
      return `${iso.slice(0, 4)}-Q${q}`;
    }
    return iso.slice(0, 7);
  };
  for (const t of targets) {
    const achieved = won
      .filter((d: any) => dealPeriodKey(d, t.period_type) === t.period)
      .reduce((sum: number, d: any) => sum + toNum(d.value), 0);
    if (toNum(t.achieved_amount) !== achieved) {
      await db.query(
        `update revops_sales_targets set achieved_amount = $1, updated_at = $2 where id = $3 and tenant_slug = $4`,
        [achieved, new Date().toISOString(), t.id, tenantSlug]
      );
      t.achieved_amount = achieved;
    }
  }

  const officerIds = Array.from(new Set(won.map((d: any) => d.assigned_officer_id).filter(Boolean)));
  const nameMap = new Map<string, string>();
  if (officerIds.length > 0) {
    const names = await db.query(
      `select id, full_name from admin_employees where tenant_slug = $1 and id = any($2)`,
      [tenantSlug, officerIds]
    ).catch(() => ({ rows: [] as any[] }));
    for (const n of names.rows) nameMap.set(n.id, n.full_name);
  }
  const repMap = new Map<string, { repId: string; repName: string; meetings: number; proposals: number; wins: number; attainment: number }>();
  for (const d of won) {
    const repId = d.assigned_officer_id || "unassigned";
    if (!repMap.has(repId)) {
      repMap.set(repId, {
        repId,
        repName: nameMap.get(repId) ?? (repId === "unassigned" ? "Unassigned" : repId),
        meetings: 0, proposals: 0, wins: 0, attainment: 0,
      });
    }
    repMap.get(repId)!.wins += 1;
  }
  for (const rep of repMap.values()) {
    const repTarget = targets.find((t: any) => t.owner_type === "rep" && t.owner_id === rep.repId && t.period === period);
    const repRevenue = won
      .filter((d: any) => (d.assigned_officer_id || "unassigned") === rep.repId && dealPeriodKey(d, "monthly") === period)
      .reduce((sum: number, d: any) => sum + toNum(d.value), 0);
    rep.attainment = repTarget && toNum(repTarget.target_amount) > 0 ? toMoney((repRevenue / toNum(repTarget.target_amount)) * 100) : 0;
  }

  const regionalPerformance = Array.from(new Set(targets.map((t: any) => t.region).filter(Boolean))).map((region: any) => {
    const regionTargets = targets.filter((t: any) => t.region === region);
    const target = regionTargets.reduce((sum: number, t: any) => sum + toNum(t.target_amount), 0);
    const achieved = regionTargets.reduce((sum: number, t: any) => sum + toNum(t.achieved_amount), 0);
    return { region, revenue: toMoney(achieved), target: toMoney(target), attainment: target > 0 ? toMoney((achieved / target) * 100) : 0 };
  });

  const stageOrder = ["prospecting", "qualification", "proposal", "negotiation", "closed_won"];
  const stageRank = new Map(stageOrder.map((stage, i) => [stage, i]));
  const funnelLeakage = stageOrder.slice(0, -1).map((stage, i) => {
    const entered = deals.filter((d: any) => (stageRank.get(d.stage) ?? -1) >= i).length;
    const converted = deals.filter((d: any) => (stageRank.get(d.stage) ?? -1) >= i + 1).length;
    return { stage, entered, converted, leakage: Math.max(0, entered - converted) };
  });

  const periodLabel = new Date(`${period}-01T00:00:00Z`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  await db.query(
    `insert into revops_sales_performance_snapshots
     (id, tenant_slug, period, period_label, win_rate, revenue_achieved, revenue_target,
      deal_velocity_days, avg_deal_size, pipeline_coverage, rep_productivity, regional_performance,
      funnel_leakage, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      randomUUID(), tenantSlug, period, periodLabel,
      toMoney(winRate), toMoney(revenueAchieved), toMoney(revenueTarget),
      toMoney(dealVelocityDays), toMoney(avgDealSize), toMoney(pipelineCoverage),
      JSON.stringify(Array.from(repMap.values())), JSON.stringify(regionalPerformance),
      JSON.stringify(funnelLeakage), new Date().toISOString(),
    ]
  );
}

export async function getSalesPerformanceSnapshot(tenantSlug: string): Promise<{ snapshot: SalesPerformanceSnapshot | null; targets: SalesTarget[] }> {
  await ensureRevOpsTables();
  await refreshSalesPerformanceSnapshot(tenantSlug).catch((err) => {
    console.error("[RevOps] snapshot refresh failed:", err);
  });
  const snapResult = await db.query(
    `select * from revops_sales_performance_snapshots where tenant_slug = $1 order by created_at desc limit 1`,
    [tenantSlug]
  );
  let snapshot: SalesPerformanceSnapshot | null = null;
  if (snapResult.rows.length > 0) {
    const row = db.mapRow(snapResult.rows[0]);
    snapshot = {
      id: row.id,
      tenantSlug: row.tenantSlug,
      period: row.period ?? "",
      periodLabel: row.periodLabel ?? "",
      winRate: toNum(row.winRate),
      revenueAchieved: toNum(row.revenueAchieved),
      revenueTarget: toNum(row.revenueTarget),
      dealVelocityDays: toNum(row.dealVelocityDays),
      avgDealSize: toNum(row.avgDealSize),
      pipelineCoverage: toNum(row.pipelineCoverage),
      repProductivity: Array.isArray(row.repProductivity) ? row.repProductivity : [],
      regionalPerformance: Array.isArray(row.regionalPerformance) ? row.regionalPerformance : [],
      funnelLeakage: Array.isArray(row.funnelLeakage) ? row.funnelLeakage : [],
      createdAt: row.createdAt ?? new Date().toISOString(),
    };
  }
  const targetResult = await db.query(
    `select * from revops_sales_targets where tenant_slug = $1 order by period desc`,
    [tenantSlug]
  );
  const targets: SalesTarget[] = db.mapRows(targetResult.rows).map((row: any) => ({
    id: row.id,
    tenantSlug: row.tenantSlug,
    period: row.period ?? "",
    periodType: (row.periodType ?? "monthly") as SalesTarget["periodType"],
    region: row.region ?? "",
    branch: row.branch ?? undefined,
    subsidiary: row.subsidiary ?? "",
    ownerType: (row.ownerType ?? "team") as SalesTarget["ownerType"],
    ownerId: row.ownerId ?? "",
    ownerName: row.ownerName ?? "",
    targetAmount: toNum(row.targetAmount),
    achievedAmount: toNum(row.achievedAmount),
    currency: row.currency ?? "USD",
    createdBy: row.createdBy ?? "",
    approvedBy: row.approvedBy ?? undefined,
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  }));
  return { snapshot, targets };
}

export async function upsertSalesTarget(target: SalesTarget): Promise<SalesTarget> {
  await ensureRevOpsTables();
  const now = new Date().toISOString();
  if (target.id) {
    const collision = await db.query(
      `select tenant_slug from revops_sales_targets where id = $1 limit 1`,
      [target.id]
    );
    if (collision.rows.length > 0 && collision.rows[0].tenant_slug !== target.tenantSlug) {
      throw new Error("Sales target not found");
    }
  }
  await db.query(
    `insert into revops_sales_targets
     (id, tenant_slug, period, period_type, region, branch, subsidiary, owner_type, owner_id, owner_name, target_amount, achieved_amount, currency, created_by, approved_by, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     on conflict (id) do update set
       period = excluded.period, period_type = excluded.period_type, region = excluded.region,
       branch = excluded.branch, subsidiary = excluded.subsidiary, owner_type = excluded.owner_type,
       owner_id = excluded.owner_id, owner_name = excluded.owner_name, target_amount = excluded.target_amount,
       achieved_amount = excluded.achieved_amount, currency = excluded.currency, approved_by = excluded.approved_by,
       updated_at = excluded.updated_at
     where revops_sales_targets.tenant_slug = excluded.tenant_slug`,
    [
      target.id,
      target.tenantSlug,
      target.period ?? null,
      target.periodType ?? "monthly",
      target.region ?? null,
      target.branch ?? null,
      target.subsidiary ?? null,
      target.ownerType ?? "team",
      target.ownerId ?? null,
      target.ownerName ?? null,
      target.targetAmount ?? 0,
      target.achievedAmount ?? 0,
      target.currency ?? "USD",
      target.createdBy ?? null,
      target.approvedBy ?? null,
      now,
      now,
    ]
  );
  return target;
}

export async function listEnablementAssets(tenantSlug: string): Promise<EnablementAsset[]> {
  await ensureRevOpsTables();
  const result = await db.query(
    `select * from revops_enablement_assets where tenant_slug = $1 order by created_at desc`,
    [tenantSlug]
  );
  return db.mapRows(result.rows).map((row: any) => ({
    id: row.id,
    tenantSlug: row.tenantSlug,
    title: row.title,
    assetType: (row.assetType ?? "deck") as EnablementAsset["assetType"],
    audience: (row.audience ?? "sales") as EnablementAsset["audience"],
    version: row.version ?? "v1.0",
    status: (row.status ?? "published") as EnablementAsset["status"],
    tags: Array.isArray(row.tags) ? row.tags : [],
    summary: row.summary ?? "",
    storageUrl: row.storageUrl ?? "",
    owner: row.owner ?? "",
    subsidiary: row.subsidiary ?? "",
    region: row.region ?? undefined,
    usageMetrics: row.usageMetrics ?? { downloads: 0, crmLinks: 0 },
    createdBy: row.createdBy ?? "",
    approvedBy: row.approvedBy ?? undefined,
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  }));
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

export async function createEnablementAsset(input: CreateEnablementAssetInput): Promise<EnablementAsset> {
  await ensureRevOpsTables();
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.query(
    `insert into revops_enablement_assets
     (id, tenant_slug, title, asset_type, audience, version, status, tags, summary, storage_url, owner, subsidiary, region, usage_metrics, created_by, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [
      id,
      input.tenantSlug,
      input.title,
      input.assetType ?? null,
      input.audience ?? null,
      input.version ?? "v1.0",
      "published",
      JSON.stringify(input.tags ?? []),
      input.summary ?? null,
      input.storageUrl ?? null,
      input.owner ?? null,
      input.subsidiary ?? null,
      input.region ?? null,
      JSON.stringify({ downloads: 0, crmLinks: 0 }),
      input.createdBy ?? null,
      now,
      now,
    ]
  );
  const result = await db.query(
    `select * from revops_enablement_assets where id = $1`,
    [id]
  );
  const row = db.mapRow(result.rows[0]);
  return {
    id: row.id,
    tenantSlug: row.tenantSlug,
    title: row.title,
    assetType: (row.assetType ?? "deck") as EnablementAsset["assetType"],
    audience: (row.audience ?? "sales") as EnablementAsset["audience"],
    version: row.version ?? "v1.0",
    status: (row.status ?? "published") as EnablementAsset["status"],
    tags: Array.isArray(row.tags) ? row.tags : [],
    summary: row.summary ?? "",
    storageUrl: row.storageUrl ?? "",
    owner: row.owner ?? "",
    subsidiary: row.subsidiary ?? "",
    region: row.region ?? undefined,
    usageMetrics: row.usageMetrics ?? { downloads: 0, crmLinks: 0 },
    createdBy: row.createdBy ?? "",
    approvedBy: row.approvedBy ?? undefined,
    createdAt: row.createdAt ?? now,
    updatedAt: row.updatedAt ?? now,
  };
}

export async function recordAssetUsage(tenantSlug: string, assetId: string, field: "downloads" | "crmLinks"): Promise<EnablementAsset | null> {
  await ensureRevOpsTables();
  const now = new Date().toISOString();
  const result = await db.query(
    `select * from revops_enablement_assets where tenant_slug = $1 and id = $2`,
    [tenantSlug, assetId]
  );
  if (result.rows.length === 0) return null;
  const row = db.mapRow(result.rows[0]);
  const metrics = row.usageMetrics ?? { downloads: 0, crmLinks: 0 };
  metrics[field] = (metrics[field] ?? 0) + 1;
  metrics.lastViewedAt = now;
  await db.query(
    `update revops_enablement_assets set usage_metrics = $1, updated_at = $2 where id = $3 and tenant_slug = $4`,
    [JSON.stringify(metrics), now, assetId, tenantSlug]
  );
  return {
    id: row.id,
    tenantSlug: row.tenantSlug,
    title: row.title,
    assetType: (row.assetType ?? "deck") as EnablementAsset["assetType"],
    audience: (row.audience ?? "sales") as EnablementAsset["audience"],
    version: row.version ?? "v1.0",
    status: (row.status ?? "published") as EnablementAsset["status"],
    tags: Array.isArray(row.tags) ? row.tags : [],
    summary: row.summary ?? "",
    storageUrl: row.storageUrl ?? "",
    owner: row.owner ?? "",
    subsidiary: row.subsidiary ?? "",
    region: row.region ?? undefined,
    usageMetrics: metrics,
    createdBy: row.createdBy ?? "",
    approvedBy: row.approvedBy ?? undefined,
    createdAt: row.createdAt ?? now,
    updatedAt: now,
  };
}

async function refreshRevenueForecast(tenantSlug: string): Promise<void> {
  const latest = await db.query(
    `select created_at from revops_revenue_forecasts where tenant_slug = $1 order by created_at desc limit 1`,
    [tenantSlug]
  );
  if (latest.rows.length > 0) {
    const ageMs = Date.now() - new Date(latest.rows[0].created_at).getTime();
    if (ageMs < 24 * 60 * 60 * 1000) return;
  }

  const now = new Date();
  const quarterStart = new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));
  const quarterEnd = new Date(Date.UTC(quarterStart.getUTCFullYear(), quarterStart.getUTCMonth() + 3, 0));
  const periodStart = quarterStart.toISOString().slice(0, 10);
  const periodEnd = quarterEnd.toISOString().slice(0, 10);

  const deals = (await db.query(
    `select stage, value, probability, expected_close, updated_at from crm_deals where tenant_slug = $1`,
    [tenantSlug]
  )).rows;

  const inPeriod = (d: any) => {
    if (!d.expected_close) return true; // no close date → assume in-period
    const ec = new Date(d.expected_close).toISOString().slice(0, 10);
    return ec >= periodStart && ec <= periodEnd;
  };
  const openDeals = deals.filter((d: any) => d.stage !== "closed_won" && d.stage !== "closed_lost" && inPeriod(d));
  const wonThisPeriod = deals.filter(
    (d: any) => d.stage === "closed_won" && new Date(d.updated_at).toISOString().slice(0, 10) >= periodStart
  );

  const weighted = openDeals.reduce(
    (sum: number, d: any) => sum + toNum(d.value) * (Math.min(100, Math.max(0, toNum(d.probability) || 50)) / 100),
    0
  );
  const closedRevenue = wonThisPeriod.reduce((sum: number, d: any) => sum + toNum(d.value), 0);
  const forecastLikely = closedRevenue + weighted;
  const forecastLow = closedRevenue + weighted * 0.7;
  const highProb = openDeals
    .filter((d: any) => toNum(d.probability) >= 70)
    .reduce((sum: number, d: any) => sum + toNum(d.value) * 0.3, 0);
  const forecastHigh = forecastLikely + weighted * 0.25 + highProb;

  const stale = openDeals.filter((d: any) => d.expected_close && new Date(d.expected_close).toISOString().slice(0, 10) < periodEnd
    && Date.now() - new Date(d.updated_at).getTime() > 30 * 86400000);

  const assumptions: string[] = [
    `${openDeals.length} open deals totaling ${toMoney(openDeals.reduce((s: number, d: any) => s + toNum(d.value), 0))} in pipeline`,
    `Probability-weighted pipeline contribution plus closed revenue to date`,
  ];
  if (closedRevenue > 0) assumptions.push(`${toMoney(closedRevenue)} already closed this quarter`);
  const riskAlerts: Array<{ id: string; label: string; severity: "low" | "medium" | "high"; detail?: string }> = [];
  if (stale.length > 0) {
    riskAlerts.push({
      id: "stale-pipeline",
      label: "Stale pipeline",
      severity: stale.length > 3 ? "high" : "medium",
      detail: `${stale.length} open deal(s) untouched for 30+ days`,
    });
  }
  if (openDeals.length === 0 && closedRevenue === 0) {
    riskAlerts.push({ id: "empty-pipeline", label: "Empty pipeline", severity: "high", detail: "No open deals or closed revenue this quarter" });
  }
  const confidence = Math.min(90, 30 + wonThisPeriod.length * 10 + openDeals.length * 2);

  await db.query(
    `insert into revops_revenue_forecasts
     (id, tenant_slug, period_start, period_end, forecast_low, forecast_likely, forecast_high,
      confidence, methodology, assumptions, risk_alerts, created_by, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      randomUUID(), tenantSlug, periodStart, periodEnd,
      toMoney(forecastLow), toMoney(forecastLikely), toMoney(forecastHigh),
      confidence, "probability_weighted_pipeline",
      JSON.stringify(assumptions), JSON.stringify(riskAlerts),
      "system", now.toISOString(), now.toISOString(),
    ]
  );
}

export async function getRevenueForecast(tenantSlug: string): Promise<RevenueForecast | null> {
  await ensureRevOpsTables();
  await refreshRevenueForecast(tenantSlug).catch((err) => {
    console.error("[RevOps] forecast refresh failed:", err);
  });
  const result = await db.query(
    `select * from revops_revenue_forecasts where tenant_slug = $1 order by created_at desc limit 1`,
    [tenantSlug]
  );
  if (result.rows.length === 0) return null;
  const row = db.mapRow(result.rows[0]);
  return {
    id: row.id,
    tenantSlug: row.tenantSlug,
    periodStart: row.periodStart ?? "",
    periodEnd: row.periodEnd ?? "",
    region: row.region ?? "",
    branch: row.branch ?? undefined,
    subsidiary: row.subsidiary ?? "",
    forecastLow: toNum(row.forecastLow),
    forecastLikely: toNum(row.forecastLikely),
    forecastHigh: toNum(row.forecastHigh),
    confidence: toNum(row.confidence),
    methodology: row.methodology ?? "",
    assumptions: Array.isArray(row.assumptions) ? row.assumptions : [],
    riskAlerts: Array.isArray(row.riskAlerts) ? row.riskAlerts : [],
    createdBy: row.createdBy ?? "",
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  };
}

export async function getRevOpsOverview(tenantSlug: string): Promise<RevOpsOverviewSnapshot> {
  await ensureRevOpsTables();
  const { snapshot, targets } = await getSalesPerformanceSnapshot(tenantSlug);
  const totals = targets.reduce(
    (acc, target) => {
      acc.target += target.targetAmount;
      acc.actual += target.achievedAmount;
      return acc;
    },
    { actual: 0, target: 0 }
  );

  const campaignsResult = await db.query(
    `select id, name, roi, actual_spend, revenue_attributed from revops_campaigns where tenant_slug = $1`,
    [tenantSlug]
  );
  const campaigns = db.mapRows(campaignsResult.rows);

  const costsResult = await db.query(
    `select coalesce(sum(amount), 0) as spend from revops_campaign_costs where tenant_slug = $1`,
    [tenantSlug]
  );
  const totalSpend = toNum(costsResult.rows[0]?.spend);

  const attrResult = await db.query(
    `select coalesce(sum(recognized_revenue), 0) as revenue from revops_revenue_attributions where tenant_slug = $1`,
    [tenantSlug]
  );
  const totalAttrRevenue = toNum(attrResult.rows[0]?.revenue);

  const overview: RevOpsOverviewSnapshot = {
    metrics: [
      {
        id: "revenue",
        label: "Revenue vs target",
        value: `${(totals.actual / 1_000_000).toFixed(1)}M / ${(totals.target / 1_000_000).toFixed(1)}M`,
        delta: snapshot ? Number(((snapshot.revenueAchieved / Math.max(snapshot.revenueTarget, 1) - 1) * 100).toFixed(1)) : undefined,
        deltaDirection: snapshot && snapshot.revenueAchieved >= snapshot.revenueTarget ? "up" : "down",
      },
      {
        id: "campaign_roi",
        label: "Avg campaign ROI",
        value: `${(
          campaigns.reduce((sum: number, item: any) => sum + toNum(item.roi), 0) / Math.max(campaigns.length, 1)
        ).toFixed(2)}x`,
      },
      {
        id: "funnel",
        label: "Funnel leakage",
        value: snapshot ? `${Math.round((snapshot.funnelLeakage.at(-1)?.leakage ?? 0) * 100)}%` : "--",
      },
      {
        id: "cost_efficiency",
        label: "Cost per revenue",
        value: `${(totalSpend / Math.max(totalAttrRevenue, 1)).toFixed(2)}x`,
      },
    ],
    revenueVsTarget: {
      period: snapshot?.periodLabel ?? "",
      actual: snapshot?.revenueAchieved ?? totals.actual,
      target: snapshot?.revenueTarget ?? totals.target,
    },
    campaignRoi: campaigns.map((campaign: any) => ({
      campaignId: campaign.id,
      name: campaign.name,
      roi: toNum(campaign.roi),
      spend: toNum(campaign.actualSpend),
      revenue: toNum(campaign.revenueAttributed),
    })),
    funnelLeakage: snapshot?.funnelLeakage.map((row) => ({ stage: row.stage, leakPercent: toMoney(row.leakage * 100) })) ?? [],
    costVsRevenue: {
      spend: totalSpend,
      revenue: totalAttrRevenue,
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
