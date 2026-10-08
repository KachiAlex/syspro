export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { createReportJob, getReportForJob, listReportJobs } from "@/lib/reporting/db";

import { requireModuleAccess } from "@/lib/api-auth";
export async function POST(request: NextRequest, context: any) {
    const _scope = await requireModuleAccess(request, "analytics", "write");
    if (!_scope.ok) return _scope.response;

  const { params } = context;
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "write");
    const report = await getReportForJob(params.id, tenantSlug);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
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
    const _scope = await requireModuleAccess(request, "analytics", "read");
    if (!_scope.ok) return _scope.response;

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
