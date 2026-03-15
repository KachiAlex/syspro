import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { CreateReportSchema, safeParse } from "@/lib/validation";
import { createReport, listReports, listReportsCursor } from "@/lib/reporting/db";

export async function GET(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "read");
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const limit = Number(url.searchParams.get("limit") || "20");
    if (cursor !== null) {
      const { items, nextCursor } = await listReportsCursor(tenantSlug, cursor || null, limit);
      return NextResponse.json({ reports: items, nextCursor, limit });
    }

    // fallback to page-based for older callers
    const page = Number(url.searchParams.get("page") || "1");
    const reports = await listReports(tenantSlug, page, limit);
    return NextResponse.json({ reports, page, limit });
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
