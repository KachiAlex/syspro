import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";

const TRIGGERS = [
  { key: "attendance.check-in", module: "attendance", description: "Employee check-in recorded" },
  { key: "attendance.missed", module: "attendance", description: "Missed check-in or absence" },
  { key: "projects.task-status", module: "projects", description: "Task status changed" },
  { key: "projects.over-budget", module: "projects", description: "Project budget threshold crossed" },
  { key: "support.ticket-created", module: "it-support", description: "New support ticket created" },
  { key: "finance.payment-due", module: "finance", description: "Bill or payment due" },
  { key: "crm.deal-stage", module: "crm", description: "Deal stage changed" },
  { key: "revops.campaign-performance", module: "revops", description: "Campaign performance anomaly" },
];

export async function GET(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "read");
    return NextResponse.json({ triggers: TRIGGERS });
  } catch (error) {
    console.error("Automation triggers GET failed", error);
    const message = error instanceof Error ? error.message : "Unable to fetch triggers";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
