import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { simulateRule } from "@/lib/automation/engine";
import { getAutomationRule } from "@/lib/automation/db";

export async function POST(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "read");
    const body = await request.json().catch(() => ({}));
    const { ruleId, event } = body;
    if (!ruleId || !event?.type) {
      return NextResponse.json({ error: "ruleId and event.type are required" }, { status: 400 });
    }
    const rule = await getAutomationRule(ruleId, tenantSlug);
    if (!rule) return NextResponse.json({ error: "Rule not found" }, { status: 404 });

    const result = simulateRule(rule, { type: event.type, payload: event.payload ?? {}, actor: auth.userId });
    return NextResponse.json({ result });
  } catch (error) {
    console.error("Automation simulate failed", error);
    const message = error instanceof Error ? error.message : "Unable to simulate";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
