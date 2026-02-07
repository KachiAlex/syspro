import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { fetchAutomationSummary } from "@/lib/automation/db";

export async function GET(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "read");

    const summary = await fetchAutomationSummary(tenantSlug);
    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Automation summary GET failed", error);
    const message = error instanceof Error ? error.message : "Unable to fetch automation summary";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
