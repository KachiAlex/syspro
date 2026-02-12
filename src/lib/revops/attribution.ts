export type AttributionModel = "first_touch" | "last_touch" | "linear";

export interface AttributionEvent {
  id: string;
  opportunityId?: string | null;
  invoiceId?: string | null;
  campaignId?: string | null;
  leadSourceId?: string | null;
  amount?: number; // amount to attribute (defaults to 0)
  occurredAt: string | Date;
  metadata?: Record<string, any>;
}

export interface AttributionSummary {
  totalsByCampaign: Record<string, number>;
  totalsByLeadSource: Record<string, number>;
  total: number;
}

function toNumber(n?: number): number {
  return typeof n === "number" && !Number.isNaN(n) ? n : 0;
}

export function calculateAttributionSummary(events: AttributionEvent[], model: AttributionModel): AttributionSummary {
  const totalsByCampaign: Record<string, number> = {};
  const totalsByLeadSource: Record<string, number> = {};

  if (!events || events.length === 0) {
    return { totalsByCampaign, totalsByLeadSource, total: 0 };
  }

  // Normalize order by occurredAt
  const sorted = [...events].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  // Sum of amounts across events (used for total reporting)
  const totalAmount = sorted.reduce((s, e) => s + toNumber(e.amount), 0);

  if (model === "first_touch") {
    const first = sorted[0];
    const amt = toNumber(first.amount);
    if (first.campaignId) totalsByCampaign[first.campaignId] = (totalsByCampaign[first.campaignId] || 0) + amt;
    if (first.leadSourceId) totalsByLeadSource[first.leadSourceId] = (totalsByLeadSource[first.leadSourceId] || 0) + amt;
  } else if (model === "last_touch") {
    const last = sorted[sorted.length - 1];
    const amt = toNumber(last.amount);
    if (last.campaignId) totalsByCampaign[last.campaignId] = (totalsByCampaign[last.campaignId] || 0) + amt;
    if (last.leadSourceId) totalsByLeadSource[last.leadSourceId] = (totalsByLeadSource[last.leadSourceId] || 0) + amt;
  } else {
    // linear: split the overall total amount equally across the events (each event gets an equal share)
    // then attribute each event's share to that event's campaign/lead source.
    const n = sorted.length;
    const share = n > 0 ? totalAmount / n : 0;
    for (const e of sorted) {
      if (e.campaignId) totalsByCampaign[e.campaignId] = (totalsByCampaign[e.campaignId] || 0) + share;
      if (e.leadSourceId) totalsByLeadSource[e.leadSourceId] = (totalsByLeadSource[e.leadSourceId] || 0) + share;
    }
  }

  return { totalsByCampaign, totalsByLeadSource, total: totalAmount };
}

export function calculateAttribution(events: AttributionEvent[], model: AttributionModel) {
  return calculateAttributionSummary(events, model);
}
