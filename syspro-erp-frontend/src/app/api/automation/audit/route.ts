import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { listAutomationAudits } from "@/lib/automation/db";

export async function GET(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "read");
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 1, 1), 100) : 50;
    const audits = await listAutomationAudits(tenantSlug, limit);
    return NextResponse.json({ audits });
  } catch (error) {
    console.error("Automation audit GET failed", error);
    const message = error instanceof Error ? error.message : "Unable to fetch automation audits";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
