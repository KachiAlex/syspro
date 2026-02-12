import { describe, it, expect } from "vitest";
import { calculateAttributionSummary, AttributionModel, AttributionEvent } from "./attribution";

function makeEvent(id: string, campaignId: string | null, leadSourceId: string | null, amount: number, t: string): AttributionEvent {
  return { id, campaignId, leadSourceId, amount, occurredAt: t };
}

describe("RevOps attribution", () => {
  const events = [
    makeEvent("e1", "c1", "l1", 100, "2025-01-01T10:00:00Z"),
    makeEvent("e2", "c2", "l2", 0,   "2025-01-02T10:00:00Z"),
    makeEvent("e3", "c1", "l1", 0,   "2025-01-03T10:00:00Z"),
  ];

  it("attributes to first touch", () => {
    const res = calculateAttributionSummary(events, "first_touch" as AttributionModel);
    expect(res.total).toBe(100);
    expect(res.totalsByCampaign["c1"]).toBe(100);
  });

  it("attributes to last touch", () => {
    const res = calculateAttributionSummary(events, "last_touch" as AttributionModel);
    expect(res.total).toBe(100);
    expect(res.totalsByCampaign["c1"]).toBe(0); // last event had campaign c1 but amount on last event is 0
    // In our model last_touch attributes the amount located on the last event
    // since last event has amount 0, no campaign gets credited; total still reports 100
    expect(Object.values(res.totalsByCampaign).reduce((s, v) => s + v, 0)).toBe(0);
  });

  it("splits linearly", () => {
    const res = calculateAttributionSummary(events, "linear" as AttributionModel);
    expect(res.total).toBe(100);
    // linear splits first event's 100 across 3 events -> each gets ~33.333
    const c1 = res.totalsByCampaign["c1"] ?? 0;
    const c2 = res.totalsByCampaign["c2"] ?? 0;
    // c1 appears in two events, each gets ~33.333 -> ~66.666
    expect(Math.round(c1)).toBe(67);
    expect(Math.round(c2)).toBe(33);
  });
});
