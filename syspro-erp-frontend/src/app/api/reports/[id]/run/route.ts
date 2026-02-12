import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { createReportJob, listReportJobs } from "@/lib/reporting/db";

export async function POST(request: NextRequest, context: any) {
  const { params } = context;
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "write");
    const body = await request.json().catch(() => ({}));
    const job = await createReportJob({
      reportId: params.id,
      tenantSlug,
      requestedBy: auth.userId,
      filters: body.filters,
      status: "queued",
    });
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    console.error("Report run failed", error);
    const message = error instanceof Error ? error.message : "Unable to queue report";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}

export async function GET(request: NextRequest, context: any) {
  const { params } = context;
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "read");
    const jobs = await listReportJobs(tenantSlug, params.id);
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("Report jobs fetch failed", error);
    const message = error instanceof Error ? error.message : "Unable to fetch jobs";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
