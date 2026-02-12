import { db } from "@/lib/sql-client";
import type { Campaign, LeadSource, CampaignCost, RevenueAttribution, EnablementAsset } from "./types";
import { calculateAttributionSummary, type AttributionModel } from "./attribution";
import type { AttributionSummary } from "./attribution";

export async function createCampaign(input: Partial<Campaign>): Promise<Campaign> {
  const [row] = (await db.query(
    `insert into revops_campaigns (tenant_slug, subsidiary, region, branch, name, channel, status, start_at, end_at, budget, approved_by, approved_at, metadata, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning *`,
    [
      input.tenantSlug,
      input.subsidiary ?? null,
      input.region ?? null,
      input.branch ?? null,
      input.name,
      input.channel ?? null,
      input.status ?? 'draft',
      input.startAt ?? null,
      input.endAt ?? null,
      input.budget ?? 0,
      input.approvedBy ?? null,
      input.approvedAt ?? null,
      input.metadata ?? null,
      input.createdBy ?? null,
    ]
  )) as any[];
  return db.mapRow(row);
}

export async function listCampaigns(tenantSlug: string): Promise<Campaign[]> {
  const rows = (await db.query(`select * from revops_campaigns where tenant_slug = $1 order by created_at desc`, [tenantSlug])) as any;
  return db.mapRows(rows);
}

export async function createLeadSource(input: Partial<LeadSource>): Promise<LeadSource> {
  const [row] = (await db.query(
    `insert into revops_lead_sources (tenant_slug, name, channel, campaign_id, cost_center, region, branch, metadata, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
    [
      input.tenantSlug,
      input.name,
      input.channel ?? null,
      input.campaignId ?? null,
      input.costCenter ?? null,
      input.region ?? null,
      input.branch ?? null,
      input.metadata ?? null,
      input.createdBy ?? null,
    ]
  )) as any[];
  return db.mapRow(row);
}

export async function listLeadSources(tenantSlug: string): Promise<LeadSource[]> {
  const rows = (await db.query(`select * from revops_lead_sources where tenant_slug = $1 order by created_at desc`, [tenantSlug])) as any;
  return db.mapRows(rows);
}

export async function addCampaignCost(input: Partial<CampaignCost>): Promise<CampaignCost> {
  const [row] = (await db.query(
    `insert into revops_campaign_costs (tenant_slug, campaign_id, amount, currency, category, incurred_at, metadata, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [
      input.tenantSlug,
      input.campaignId,
      input.amount,
      input.currency ?? 'USD',
      input.category ?? null,
      input.incurredAt ?? null,
      input.metadata ?? null,
      input.createdBy ?? null,
    ]
  )) as any[];
  return db.mapRow(row);
}

export async function recordAttribution(input: Partial<RevenueAttribution>): Promise<RevenueAttribution> {
  const [row] = (await db.query(
    `insert into revops_revenue_attributions (tenant_slug, campaign_id, lead_source_id, opportunity_id, invoice_id, amount, attribution_model, attributed_at, metadata, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
    [
      input.tenantSlug,
      input.campaignId ?? null,
      input.leadSourceId ?? null,
      input.opportunityId ?? null,
      input.invoiceId ?? null,
      input.amount ?? null,
      input.attributionModel ?? null,
      input.attributedAt ?? null,
      input.metadata ?? null,
      input.createdBy ?? null,
    ]
  )) as any[];
  return db.mapRow(row);
}

export async function uploadEnablementAsset(input: Partial<EnablementAsset>): Promise<EnablementAsset> {
  const [row] = (await db.query(
    `insert into revops_enablement_assets (tenant_slug, name, type, version, url, metadata, created_by)
     values ($1,$2,$3,$4,$5,$6,$7) returning *`,
    [
      input.tenantSlug,
      input.name,
      input.type ?? null,
      input.version ?? 1,
      input.url ?? null,
      input.metadata ?? null,
      input.createdBy ?? null,
    ]
  )) as any[];
  return db.mapRow(row);
}

export async function calculateAttributionForTenant(tenantSlug: string, model: AttributionModel): Promise<AttributionSummary> {
  const rows = (await db.query(
    `select * from revops_revenue_attributions where tenant_slug = $1 order by attributed_at asc`,
    [tenantSlug]
  )) as any[];

  const events = rows.map((r) => ({
    id: String(r.id),
    opportunityId: r.opportunity_id ?? null,
    invoiceId: r.invoice_id ?? null,
    campaignId: r.campaign_id ?? null,
    leadSourceId: r.lead_source_id ?? null,
    amount: typeof r.amount === "number" ? r.amount : Number(r.amount ?? 0),
    occurredAt: r.attributed_at ?? r.created_at ?? new Date().toISOString(),
    metadata: r.metadata ?? null,
  }));

  return calculateAttributionSummary(events, model);
}
