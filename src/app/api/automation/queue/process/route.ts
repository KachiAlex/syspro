export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { requireModuleAccess } from "@/lib/api-auth";
import { fetchPendingActions, markActionStatus } from "@/lib/automation/db";
import { handleAutomationAction } from "@/lib/automation/connectors";
import { fetchQueuedReportJobs, getReportForJob, updateReportJobOutput, updateReportJobStatus } from "@/lib/reporting/db";
import { executeReport } from "@/lib/reporting/execute";

export async function POST(request: NextRequest) {
  const scope = await requireModuleAccess(request, "automation", "write");
  if (!scope.ok) return scope.response;

  const auth = extractAuthContext(request);
  const tenantSlug = validateTenant(auth.tenantSlug);

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
      try {
        const report = await getReportForJob(job.reportId, tenantSlug);
        if (!report) {
          await updateReportJobStatus(job.id, "failed", { error: "Report not found" });
          reportResults.push({ id: job.id, status: "failed", error: "Report not found" });
          continue;
        }
        const dataset = await executeReport(tenantSlug, {
          reportType: report.report_type,
          definition: report.definition,
          filters: job.filters ?? report.filters,
        });
        await updateReportJobOutput(job.id, dataset);
        await updateReportJobStatus(job.id, "succeeded", { location: `db://report_jobs/${job.id}` });
        reportResults.push({ id: job.id, status: "succeeded", outputLocation: `db://report_jobs/${job.id}` });
      } catch (jobErr) {
        const msg = jobErr instanceof Error ? jobErr.message : String(jobErr);
        await updateReportJobStatus(job.id, "failed", { error: msg });
        reportResults.push({ id: job.id, status: "failed", error: msg });
      }
    }

    return NextResponse.json({ actions: actionResults, reports: reportResults });
  } catch (error) {
    console.error("Automation queue processing failed", error);
    const message = error instanceof Error ? error.message : "Unable to process queue";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
