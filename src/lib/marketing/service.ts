import { db, sql as SQL } from "@/lib/sql-client";
import { calculateAttributionSummary } from "@/lib/revops/attribution";
import { AttributionModel } from "@/lib/revops/attribution";
import { Opportunity, AttributionRecord } from "./types";

export async function listCampaigns(tenantSlug: string) {
  const rows = await db.query<any>(`select * from marketing_campaigns where tenant_slug = $1 order by created_at desc`, [tenantSlug]);
  return rows.rows;
}

export async function createCampaign(tenantSlug: string, input: Partial<any>, createdBy?: string) {
  const [row] = await SQL`
    insert into marketing_campaigns (tenant_slug, name, type, objective, channels, budget, region, owner_id, status, approval_state, start_date, end_date, created_by)
    values (${tenantSlug}, ${input.name || null}, ${input.type || null}, ${input.objective || null}, ${JSON.stringify(input.channels || {})}, ${input.budget || 0}, ${input.region || null}, ${input.ownerId || null}, ${input.status || 'draft'}, ${input.approvalState || 'pending'}, ${input.startDate || null}, ${input.endDate || null}, ${createdBy || null})
    returning *
  ` as any[];
  return row;
}

export async function recordCampaignCost(tenantSlug: string, campaignId: string, amount: number, note?: string, createdBy?: string) {
  const res = await SQL`
    insert into marketing_campaign_costs (tenant_slug, campaign_id, amount, note, created_by, date)
    values (${tenantSlug}, ${campaignId}, ${amount}, ${note || null}, ${createdBy || null}, now()) returning *
  ` as any[];
  return res[0];
}

export async function calculateAttributionForTenant(tenantSlug: string, model: AttributionModel = 'first_touch', from?: string, to?: string) {
  // Fetch won opportunities in range
  const params: any[] = [tenantSlug];
  let q = `select id, campaign_id, value, closed_at from sales_opportunities where tenant_slug = $1 and won = true`;
  if (from) { params.push(from); q += ` and closed_at >= $${params.length}`; }
  if (to) { params.push(to); q += ` and closed_at <= $${params.length}`; }

  const res = await db.query<any>(q, params);
  const rows = res.rows || [];

  // Build attribution events from opportunities (simple: one event per opportunity)
  const events = rows.map((r: any) => ({
    id: r.id,
    campaignId: r.campaign_id,
    amount: Number(r.value) || 0,
    occurredAt: r.closed_at || new Date().toISOString(),
  }));

  const summary = calculateAttributionSummary(events, model as any);

  // Persist a summary record (one per tenant+run)
  await SQL`
    insert into marketing_attribution_records (tenant_slug, model, attribution, total, calculated_at)
    values (${tenantSlug}, ${model}, ${JSON.stringify(summary)}, ${summary.total}, now())
  `;

  return summary;
}
