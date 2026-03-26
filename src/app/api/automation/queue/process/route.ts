import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { fetchPendingActions, markActionStatus } from "@/lib/automation/db";
import { handleAutomationAction } from "@/lib/automation/connectors";
import { fetchQueuedReportJobs, updateReportJobStatus } from "@/lib/reporting/db";

export async function POST(request: NextRequest) {
  const auth = extractAuthContext(request);
  const tenantSlug = validateTenant(auth.tenantSlug);
  requirePermission(auth.userRole, "write");

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 1, 1), 50) : 25;

  try {
    const maxAttempts = 3;
    const actions = await fetchPendingActions(limit, tenantSlug, maxAttempts);
    const actionResults = [] as Array<{ id: string; status: string; error?: string }>;
    for (const action of actions) {
      await markActionStatus(action.id, "processing", null);
      const result = await handleAutomationAction(action as any);
      await markActionStatus(action.id, result.status, result.error || null);
      actionResults.push({ id: action.id, status: result.status, error: result.error });
    }

    const reportMaxAttempts = 3;
    const reportJobs = await fetchQueuedReportJobs(limit, tenantSlug, reportMaxAttempts);
    const reportResults = [] as Array<{ id: string; status: string; outputLocation?: string; error?: string }>;
    for (const job of reportJobs) {
      await updateReportJobStatus(job.id, "running");
      // Placeholder execution hook; replace with real report generation.
      const outputLocation = `s3://reports/${tenantSlug}/${job.id}.json`;
      await updateReportJobStatus(job.id, "succeeded", { location: outputLocation });
      reportResults.push({ id: job.id, status: "succeeded", outputLocation });
    }

    return NextResponse.json({ actions: actionResults, reports: reportResults });
  } catch (error) {
    console.error("Automation queue processing failed", error);
    const message = error instanceof Error ? error.message : "Unable to process queue";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
