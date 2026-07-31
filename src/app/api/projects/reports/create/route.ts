import { NextResponse } from 'next/server';
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { createProjectReport } from "@/lib/projects/db";

function toClientReport(row: any) {
  return {
    id: row.id,
    project: row.project_id,
    projectId: row.project_id,
    title: row.title ?? undefined,
    type: row.report_type,
    content: row.content,
    status: row.status,
    submittedBy: row.submitted_by_name ?? row.submitted_by,
    createdBy: row.submitted_by_name ?? row.submitted_by,
    date: row.created_at,
    createdAt: row.created_at,
  };
}

// Admin-created report — persisted for real, covering multiple projects,
// a date range, and freeform metrics, sent to real recipients.
export async function POST(request: Request) {
  try {
    const context = validateTenantContext(request as any, "write");
    const body = await request.json();
    const { reportTitle, reportType, projectIds, dateRange, metrics, recipients, submittedBy } = body as any;

    if (!reportTitle || !Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json({ error: "reportTitle and at least one project are required" }, { status: 400 });
    }

    const content = JSON.stringify({
      projectIds,
      dateRange: dateRange ?? {},
      metrics: Array.isArray(metrics) ? metrics : [],
    });

    const report = await createProjectReport(
      context.tenantSlug,
      {
        projectId: projectIds[0],
        reportType: reportType || "summary",
        title: reportTitle,
        content,
        recipients: Array.isArray(recipients) ? recipients : [],
        status: "created",
        submittedByName: submittedBy || null,
      },
      context.userId
    );

    if (!report) {
      return NextResponse.json({ error: "Failed to create report" }, { status: 500 });
    }

    return NextResponse.json(
      { report: toClientReport(report), message: "Report created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create admin report:', error);
    const message = error instanceof Error ? error.message : 'Failed to create report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
