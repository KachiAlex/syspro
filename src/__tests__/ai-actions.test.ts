import { describe, it, expect } from "vitest";
import { routeIntent } from "@/lib/ai/intent-router";
import { getAction, canUseAction, ACTION_REGISTRY } from "@/lib/ai/actions";

describe("action routing (fallback)", () => {
  it("routes task creation to propose_action", async () => {
    const r = await routeIntent("create a task for Emeka to review the Q3 budget");
    expect(r.capability).toBe("propose_action");
    expect((r.payload as any).action).toBe("create_staff_task");
  });

  it("routes announcements to propose_action", async () => {
    const r = await routeIntent("post an announcement about the office closure on Friday");
    expect(r.capability).toBe("propose_action");
    expect((r.payload as any).action).toBe("post_announcement");
  });

  it("routes data questions to query_data", async () => {
    const r = await routeIntent("how many employees do we have per department?");
    expect(r.capability).toBe("query_data");
    expect((r.payload as any).query).toBe("department_headcount");
  });

  it("routes overdue questions to the overdue_tasks query", async () => {
    const r = await routeIntent("who has overdue tasks?");
    expect(r.capability).toBe("query_data");
    expect((r.payload as any).query).toBe("overdue_tasks");
  });
});

describe("action registry", () => {
  it("has the expected actions", () => {
    expect(ACTION_REGISTRY.map((a) => a.name)).toEqual(["create_staff_task", "post_announcement"]);
  });

  it("api keys may use any action", () => {
    const def = getAction("create_staff_task")!;
    expect(canUseAction(def, { authMethod: "api_key" })).toBe(true);
  });

  it("admin-ish roles may use write actions; staff may not", () => {
    const def = getAction("create_staff_task")!;
    expect(canUseAction(def, { role: "hod" })).toBe(true);
    expect(canUseAction(def, { role: "hr" })).toBe(true);
    expect(canUseAction(def, { role: "staff" })).toBe(false);
    expect(canUseAction(def, { role: undefined })).toBe(false);
  });

  it("announcements exclude hod", () => {
    const def = getAction("post_announcement")!;
    expect(canUseAction(def, { role: "hod" })).toBe(false);
    expect(canUseAction(def, { role: "executive" })).toBe(true);
  });
});
