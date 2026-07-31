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
    progress: row.progress !== null ? Number(row.progress) : undefined,
    blockers: row.blockers ?? [],
    nextSteps: row.next_steps ?? undefined,
    status: row.status,
    submittedBy: row.submitted_by_name ?? row.submitted_by,
    createdBy: row.submitted_by_name ?? row.submitted_by,
    date: row.created_at,
    createdAt: row.created_at,
  };
}

// Staff report submission — persisted for real, no mock echo.
export async function POST(request: Request) {
  try {
    const context = validateTenantContext(request as any, "write");
    const body = await request.json();
    const { projectId, reportType, content, progress, blockers, nextSteps, submittedBy } = body as any;

    if (!projectId || !content) {
      return NextResponse.json({ error: "projectId and content are required" }, { status: 400 });
    }

    const report = await createProjectReport(
      context.tenantSlug,
      {
        projectId,
        reportType: reportType || "daily",
        content,
        progress: progress !== undefined ? Number(progress) : null,
        blockers: Array.isArray(blockers) ? blockers : [],
        nextSteps: nextSteps || null,
        status: "submitted",
        submittedByName: submittedBy || null,
      },
      context.userId
    );

    if (!report) {
      return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
    }

    return NextResponse.json(
      { report: toClientReport(report), message: "Report submitted successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to submit staff report:', error);
    const message = error instanceof Error ? error.message : 'Failed to submit report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
