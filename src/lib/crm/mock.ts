import crypto from "node:crypto";
import type { CrmChannel, CrmDashboardPayload } from "./types";
import { CRM_COMMUNICATION_CHANNELS, CRM_LEAD_STAGES } from "./types";

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min: number, max: number, decimals = 1) => Number((Math.random() * (max - min) + min).toFixed(decimals));
const randomId = () => crypto.randomUUID();
const randomItem = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];

export function generateMockDashboardPayload(filters: { tenantSlug: string; regionId?: string; branchId?: string }): CrmDashboardPayload {
  const totalLeads = randomInt(1200, 3600);
  const qualifiedLeads = Math.round(totalLeads * randomFloat(0.35, 0.55, 2));
  const opportunities = randomInt(120, 360);
  const dealsWon = randomInt(40, 120);
  const dealsLost = randomInt(10, 60);
  const revenue = dealsWon * randomInt(25000, 85000);
  const conversionRate = Math.round((dealsWon / Math.max(qualifiedLeads, 1)) * 1000) / 10;

  const metrics = [
    { label: "Total Leads", value: totalLeads, delta: randomFloat(-8, 12) },
    { label: "Qualified Leads", value: qualifiedLeads, delta: randomFloat(-5, 9) },
    { label: "Opportunities", value: opportunities, delta: randomFloat(-4, 7) },
    { label: "Deals Won", value: dealsWon, delta: randomFloat(-2, 5) },
  ].map((metric) => ({
    ...metric,
    deltaDirection: (metric.delta && metric.delta >= 0 ? "up" : "down") as "up" | "down",
    description: filters.regionId ? `Region: ${filters.regionId}` : "All regions",
  }));

  const salesFunnel = CRM_LEAD_STAGES.map((stage) => ({ stage, value: randomInt(40, 400) }));

  const revenueByOfficer = Array.from({ length: 6 }, () => ({
    officerId: randomId(),
    officerName: `Officer ${randomInt(1, 50)}`,
    value: randomInt(50000, 250000),
  }));

  const lostReasons = ["Budget", "Timeline", "Scope", "Competition", "No decision"].map((reason) => ({
    reason,
    count: randomInt(4, 48),
  }));

  const reminders = Array.from({ length: 4 }, () => ({
    id: randomId(),
    label: `Follow up ${randomInt(1000, 9999)}`,
    dueAt: new Date(Date.now() + randomInt(2, 5) * 86_400_000).toISOString(),
    slaSeconds: randomInt(1800, 86_400),
  }));

  const leads = Array.from({ length: 6 }, (_, index) => ({
    id: randomId(),
    companyName: `Company ${index + 1}-${randomInt(100, 999)}`,
    contactName: `Contact ${randomInt(1, 90)}`,
    stage: randomItem(CRM_LEAD_STAGES),
    ownerName: `Officer ${randomInt(1, 20)}`,
    value: randomInt(15000, 95000),
    currency: "₦",
    status: randomItem(["overdue", "pending", "won"] as const),
  }));

  const tasks = Array.from({ length: 5 }, () => ({
    id: randomId(),
    title: `Prepare ${randomInt(10, 99)}% proposal`,
    due: new Date(Date.now() + randomInt(1, 7) * 86_400_000).toISOString(),
    assignee: `Rep ${randomInt(1, 30)}`,
    status: (Math.random() > 0.5 ? "due" : "upcoming") as "due" | "upcoming",
  }));

  const engagements = Array.from({ length: 6 }, () => ({
    id: randomId(),
    title: `${randomItem(["Call", "Email", "Meeting"])} with account ${randomInt(100, 999)}`,
    detail: `Discuss renewal batch ${randomInt(10, 99)}.`,
    timestamp: new Date(Date.now() - randomInt(1, 3) * 86_400_000).toISOString(),
    channel: randomItem(CRM_COMMUNICATION_CHANNELS) as CrmChannel,
  }));

  return {
    metrics,
    totals: { totalLeads, qualifiedLeads, opportunities, dealsWon, dealsLost, revenue, conversionRate },
    charts: { salesFunnel, revenueByOfficer, lostReasons },
    leads,
    reminders,
    tasks,
    engagements,
  };
}
