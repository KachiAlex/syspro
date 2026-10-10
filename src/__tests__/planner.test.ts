import { describe, it, expect } from "vitest";
import { createPlan, applyPriorResult, parseScoreThreshold, MAX_PLAN_STEPS } from "@/lib/ai/planner";

// GROQ_API_KEY unset + useAI:false → deterministic fallback plan.
describe("planner (fallback path)", () => {
  it("chains appraisal → training plan for multi-intent requests", async () => {
    const plan = await createPlan("appraise Ada and draft a training plan for her", { useAI: false });
    expect(plan.steps.map((s) => s.capability)).toEqual(["appraise_performance", "generate_training_plan"]);
    // employeeId resolved from step 1; step 2 left empty for feed-forward
    expect(plan.steps[0].payload.employeeId).toBeDefined();
    expect(plan.steps[1].payload.employeeId).toBeUndefined();
  });

  it("returns a single step for single-intent requests", async () => {
    const plan = await createPlan("screen the candidates for REQ-7", { useAI: false });
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].capability).toBe("screen_candidates");
  });

  it("returns no steps for unrelated messages", async () => {
    const plan = await createPlan("hi", { useAI: false });
    expect(plan.steps).toHaveLength(0);
  });

  it("respects an explicit capability hint", async () => {
    const plan = await createPlan("REQ-99", { useAI: false, hint: "screen_candidates" });
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].capability).toBe("screen_candidates");
  });
});

describe("applyPriorResult", () => {
  it("fills missing identifiers from prior results only", () => {
    const next = applyPriorResult(
      { capability: "generate_training_plan", payload: {} },
      [{ capability: "appraise_performance", result: { employeeId: "emp-1", overallScore: 55, improvementAreas: ["time management"] } }],
    );
    expect(next.payload.employeeId).toBe("emp-1");
    expect(next.payload.improvementAreas).toEqual(["time management"]);
  });

  it("never overwrites explicitly provided payload fields", () => {
    const next = applyPriorResult(
      { capability: "generate_training_plan", payload: { employeeId: "emp-9" } },
      [{ capability: "appraise_performance", result: { employeeId: "emp-1" } }],
    );
    expect(next.payload.employeeId).toBe("emp-9");
  });

  it("ignores non-allowlisted result fields", () => {
    const next = applyPriorResult(
      { capability: "summarize", payload: {} },
      [{ capability: "appraise_performance", result: { employeeId: "emp-1", secret: "x", rawData: "huge" } }],
    );
    expect((next.payload as any).secret).toBeUndefined();
    expect((next.payload as any).rawData).toBeUndefined();
  });
});

describe("parseScoreThreshold", () => {
  it("extracts 'under N' thresholds", () => {
    expect(parseScoreThreshold("training plans for anyone under 60")).toBe(60);
    expect(parseScoreThreshold("below 45")).toBe(45);
  });
  it("returns null when absent or out of range", () => {
    expect(parseScoreThreshold("appraise Ada")).toBeNull();
    expect(parseScoreThreshold("under 250")).toBeNull();
  });
});

describe("plan bounds", () => {
  it("exposes a step cap", () => {
    expect(MAX_PLAN_STEPS).toBeGreaterThanOrEqual(2);
    expect(MAX_PLAN_STEPS).toBeLessThanOrEqual(8);
  });
});
