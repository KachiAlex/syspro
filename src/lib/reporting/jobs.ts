import {
  fetchDueScheduledReports,
  fetchQueuedReportJobs,
  getReportForJob,
  updateReportJobOutput,
  updateReportJobStatus,
  createReportJob,
} from "./db";
import { executeReport } from "./execute";

export interface ReportJobResult {
  id: string;
  status: string;
  outputLocation?: string;
  error?: string;
}

/** Drains queued report jobs. Pass tenantSlug to scope, omit for global (cron) processing. */
export async function processQueuedReportJobs(limit = 25, tenantSlug?: string, maxAttempts = 3): Promise<ReportJobResult[]> {
  const jobs = await fetchQueuedReportJobs(limit, tenantSlug, maxAttempts);
  const results: ReportJobResult[] = [];
  for (const job of jobs) {
    const jobTenant = job.tenantSlug || tenantSlug;
    await updateReportJobStatus(job.id, "running");
    try {
      const report = await getReportForJob(job.reportId, jobTenant!);
      if (!report) {
        await updateReportJobStatus(job.id, "failed", { error: "Report not found" });
        results.push({ id: job.id, status: "failed", error: "Report not found" });
        continue;
      }
      const dataset = await executeReport(jobTenant!, {
        reportType: report.report_type,
        definition: report.definition,
        filters: job.filters ?? report.filters,
      });
      await updateReportJobOutput(job.id, dataset);
      const location = `db://report_jobs/${job.id}`;
      await updateReportJobStatus(job.id, "succeeded", { location });
      results.push({ id: job.id, status: "succeeded", outputLocation: location });
    } catch (jobErr) {
      const msg = jobErr instanceof Error ? jobErr.message : String(jobErr);
      await updateReportJobStatus(job.id, "failed", { error: msg });
      results.push({ id: job.id, status: "failed", error: msg });
    }
  }
  return results;
}

/** Queues a job for every enabled report whose schedule interval has elapsed. */
export async function queueDueScheduledReports(limit = 50) {
  const due = await fetchDueScheduledReports(limit);
  const queued: Array<{ reportId: string; jobId: string; tenantSlug: string; schedule: string }> = [];
  for (const report of due) {
    const job = await createReportJob({
      reportId: report.id,
      tenantSlug: report.tenantSlug,
      requestedBy: "scheduler",
      filters: report.filters ?? null,
      status: "queued",
    });
    queued.push({ reportId: report.id, jobId: job.id, tenantSlug: report.tenantSlug, schedule: report.schedule });
  }
  return queued;
}
