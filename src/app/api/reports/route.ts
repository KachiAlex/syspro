import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { CreateReportSchema, safeParse } from "@/lib/validation";
import { createReport, listReports } from "@/lib/reporting/db";

export async function GET(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "read");
    const reports = await listReports(tenantSlug);
    return NextResponse.json({ reports });
  } catch (error) {
    console.error("Reports GET failed", error);
    const message = error instanceof Error ? error.message : "Unable to fetch reports";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "write");
    const body = await request.json().catch(() => ({}));
    const validation = safeParse(CreateReportSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid report", details: validation.error.flatten() }, { status: 400 });
    }

    const report = await createReport({
      tenantSlug,
      name: validation.data.name,
      reportType: validation.data.reportType,
      definition: validation.data.definition,
      filters: validation.data.filters,
      schedule: validation.data.schedule,
      enabled: validation.data.enabled,
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    console.error("Report create failed", error);
    const message = error instanceof Error ? error.message : "Unable to create report";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
