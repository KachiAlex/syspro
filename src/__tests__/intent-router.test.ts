import { describe, it, expect } from "vitest";
import { routeIntent } from "@/lib/ai/intent-router";

// Without GROQ_API_KEY set, routeIntent falls back to deterministic keyword routing.
describe("intent router (fallback path)", () => {
  it("routes candidate screening requests", async () => {
    const r = await routeIntent("screen the candidates for REQ-12");
    expect(r.capability).toBe("screen_candidates");
    expect(r.payload.requisitionId).toBeDefined();
  });

  it("routes appraisal requests with period", async () => {
    const r = await routeIntent("appraise Ada Lovelace for this month");
    expect(r.capability).toBe("appraise_performance");
    expect(r.payload.employeeId).toBeDefined();
    expect(r.payload.period).toBe("monthly");
  });

  it("routes report drafting to generate_report with transcript", async () => {
    const r = await routeIntent("draft a weekly report for this week");
    expect(r.capability).toBe("generate_report");
    expect(r.payload.transcript).toBeDefined();
    expect(r.payload.reportType).toBe("weekly");
  });

  it("routes CRM questions to summarize with crm_pipeline scope", async () => {
    const r = await routeIntent("how is our crm pipeline doing?");
    expect(r.capability).toBe("summarize");
    expect(r.payload.scope).toBe("crm_pipeline");
  });

  it("routes anomaly questions to proactive_insights", async () => {
    const r = await routeIntent("any risks or anomalies in recruitment?");
    expect(r.capability).toBe("proactive_insights");
    expect((r.payload.categories as string[])).toContain("recruitment");
  });

  it("returns null capability for unrelated messages", async () => {
    const r = await routeIntent("hi");
    expect(r.capability).toBeNull();
  });

  it("respects an explicit capability hint for payload extraction", async () => {
    const r = await routeIntent("REQ-99", { hint: "screen_candidates" });
    expect(r.capability).toBe("screen_candidates");
    expect(r.payload.requisitionId).toBeTruthy();
  });
});
