import { describe, expect, it } from "vitest";

import { findBestEngineer } from "@/lib/itsupport/assignment";
import {
  checkSLABreach,
  computeSLADueTimes,
  getSLAForCategory,
  shouldEscalate,
} from "@/lib/itsupport/sla";
import { canTransition, transitionTicket } from "@/lib/itsupport/workflow";
import type { EngineerProfile, SLA, Ticket } from "@/lib/itsupport/types";

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "t-1",
    tenantId: "tenant-x",
    branchId: "branch-1",
    department: "IT",
    type: "internal",
    impact: "high",
    slaCategory: "high",
    title: "VPN auth failure",
    description: "Users cannot authenticate",
    status: "new",
    createdBy: "tester",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    slaResponseDue: new Date(Date.now() + 30 * 60000).toISOString(),
    slaResolutionDue: new Date(Date.now() + 240 * 60000).toISOString(),
    ...overrides,
  };
}

function makeEngineer(overrides: Partial<EngineerProfile> = {}): EngineerProfile {
  return {
    id: "eng-1",
    tenantId: "tenant-x",
    name: "Engineer One",
    skills: [],
    branchId: "branch-1",
    onDuty: true,
    workload: 3,
    performanceScore: 5,
    ...overrides,
  };
}

describe("ticket workflow", () => {
  it("allows valid transitions and rejects invalid ones", () => {
    expect(canTransition("new", "acknowledged")).toBe(true);
    expect(canTransition("acknowledged", "in_progress")).toBe(true);
    expect(canTransition("resolved", "closed")).toBe(true);
    expect(canTransition("resolved", "reopened")).toBe(true);
    expect(canTransition("new", "resolved")).toBe(false);
    expect(canTransition("closed", "in_progress")).toBe(false);
  });

  it("transitions a ticket, stamps the stage, and emits an activity log", () => {
    const ticket = makeTicket();
    const { ticket: updated, log } = transitionTicket(ticket, "acknowledged", "agent-1");
    expect(updated.status).toBe("acknowledged");
    expect(updated.acknowledgedAt).toBeTruthy();
    expect(log.action).toBe("transition");
    expect(log.fromStatus).toBe("new");
    expect(log.toStatus).toBe("acknowledged");
    expect(log.actorId).toBe("agent-1");
  });

  it("throws on an invalid transition", () => {
    const ticket = makeTicket({ status: "closed" });
    expect(() => transitionTicket(ticket, "in_progress", "agent-1")).toThrow(
      /Invalid transition/
    );
  });
});

describe("SLA helpers", () => {
  const slas: SLA[] = [
    { id: "sla-1", tenantId: "tenant-x", category: "high", responseMinutes: 30, resolutionMinutes: 240, createdAt: "" },
    { id: "sla-2", tenantId: "tenant-x", category: "low", responseMinutes: 480, resolutionMinutes: 2880, createdAt: "" },
  ];

  it("finds the SLA for a category", () => {
    expect(getSLAForCategory(slas, "high")?.id).toBe("sla-1");
    expect(getSLAForCategory(slas, "critical")).toBeUndefined();
  });

  it("computes response and resolution due times", () => {
    const now = new Date("2024-01-01T00:00:00Z");
    const { responseDue, resolutionDue } = computeSLADueTimes(now, slas[0]);
    expect(responseDue.getTime()).toBe(now.getTime() + 30 * 60000);
    expect(resolutionDue.getTime()).toBe(now.getTime() + 240 * 60000);
  });

  it("detects breaches only after due times pass", () => {
    const ticket = makeTicket();
    const before = checkSLABreach(ticket, new Date(Date.now() - 60000));
    expect(before.responseBreached).toBe(false);
    expect(before.resolutionBreached).toBe(false);

    const later = new Date(Date.now() + 300 * 60000);
    const after = checkSLABreach(ticket, later);
    expect(after.responseBreached).toBe(true);
    expect(after.resolutionBreached).toBe(true);
  });

  it("escalates only on resolution breach without existing escalation", () => {
    const past = new Date(Date.now() + 300 * 60000);
    expect(shouldEscalate(makeTicket(), past)).toBe(true);
    expect(shouldEscalate(makeTicket({ escalationLevel: "l1" }), past)).toBe(false);
    expect(shouldEscalate(makeTicket(), new Date())).toBe(false);
  });
});

describe("assignment engine", () => {
  const ticket = makeTicket({ branchId: "branch-1", tags: ["vpn"] });

  it("picks the best on-duty engineer in the same branch", () => {
    const engineers = [
      makeEngineer({ id: "off-duty", onDuty: false, performanceScore: 100 }),
      makeEngineer({ id: "other-branch", branchId: "branch-2", performanceScore: 100 }),
      makeEngineer({ id: "skilled", skills: ["vpn"], workload: 1, performanceScore: 8 }),
      makeEngineer({ id: "busy", skills: [], workload: 9, performanceScore: 1 }),
    ];
    const { primary, backup } = findBestEngineer(ticket, engineers);
    expect(primary?.id).toBe("skilled");
    expect(backup?.id).toBe("busy");
  });

  it("returns empty when no engineer is eligible", () => {
    const engineers = [makeEngineer({ onDuty: false })];
    const { primary, backup } = findBestEngineer(ticket, engineers);
    expect(primary).toBeUndefined();
    expect(backup).toBeUndefined();
  });
});
