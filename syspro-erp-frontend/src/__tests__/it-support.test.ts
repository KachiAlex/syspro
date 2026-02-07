import { describe, expect, it } from "vitest";

import {
  addFieldJob,
  addTicketComment,
  createTicket,
  getDashboardMetrics,
  listFieldJobs,
  listTicketActivities,
  listTicketComments,
  listTickets,
  suggestAssignment,
} from "@/lib/support-data";

function uniqueTenantSlug(label: string) {
  const random = Math.random().toString(36).slice(2, 8);
  return `${label}-${Date.now()}-${random}`;
}

describe("support data helpers", () => {
  it("creates tickets with SLA context and exposes them in the queue", () => {
    const tenantSlug = uniqueTenantSlug("ticket");
    const initialCount = listTickets(tenantSlug).length;

    const ticket = createTicket({
      tenantSlug,
      title: "VPN auth failure",
      description: "Users cannot authenticate",
      ticketType: "internal",
      source: "erp",
      impactLevel: "high",
      priority: "high",
      serviceArea: "Internal IT",
      region: "EMEA",
      tags: ["vpn", "auth"],
      createdBy: "tester",
    });

    const queue = listTickets(tenantSlug);
    expect(queue).toHaveLength(initialCount + 1);
    expect(queue[0].id).toBe(ticket.id);
    expect(ticket.status).toBe("new");
    expect(ticket.ticketNumber).toMatch(/^IT-\d{4}-\d{4}$/);
    expect(ticket.responseDueAt).toBeTruthy();
    expect(ticket.resolutionDueAt).toBeTruthy();
  });

  it("logs comments and timeline entries for tickets", () => {
    const tenantSlug = uniqueTenantSlug("comment");
    const ticket = listTickets(tenantSlug)[0];

    const comment = addTicketComment({
      tenantSlug,
      ticketId: ticket.id,
      body: "Customer confirmed outage",
      authorId: "agent-1",
      commentType: "customer",
      visibility: "external",
    });

    expect(comment).not.toBeNull();
    const comments = listTicketComments(tenantSlug, ticket.id);
    expect(comments.at(-1)?.body).toContain("Customer confirmed outage");

    const activities = listTicketActivities(tenantSlug, ticket.id);
    expect(activities.at(-1)?.activityType).toBe("comment_added");
  });

  it("creates field jobs and surfaces them via listFieldJobs", () => {
    const tenantSlug = uniqueTenantSlug("dispatch");
    const ticket = listTickets(tenantSlug)[0];

    const job = addFieldJob({
      tenantSlug,
      ticketId: ticket.id,
      engineerId: "eng-ade",
      location: { region: "West Africa" },
    });

    expect(job).not.toBeNull();
    const jobs = listFieldJobs(tenantSlug, ticket.id);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe("scheduled");
  });

  it("provides assignment and dashboard insights", () => {
    const tenantSlug = uniqueTenantSlug("insights");
    const metrics = getDashboardMetrics(tenantSlug);
    expect(metrics.totals.ticketsOpen).toBeGreaterThan(0);
    expect(metrics.workload.length).toBeGreaterThan(0);

    const assignment = suggestAssignment({ tenantSlug, region: "West Africa", skills: ["fiber"] });
    expect(assignment.primary).not.toBeNull();
    expect(assignment.ranked.length).toBeGreaterThan(0);
    if (assignment.primary) {
      expect(assignment.primary.total).toBeGreaterThan(0);
    }
  });
});
