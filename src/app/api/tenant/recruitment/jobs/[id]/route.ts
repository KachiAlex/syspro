export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { ensureRecruitmentTables } from "@/lib/hr/db-recruitment";
import {
  validateTenantContext,
  errorResponse,
  handleTenantAdminError,
} from "@/lib/tenant-admin/utils";

const STATUS_TO_DB: Record<string, string> = {
  open: "open",
  closed: "closed",
  "on-hold": "paused",
  paused: "paused",
  draft: "draft",
};

const STATUS_TO_UI: Record<string, string> = {
  open: "Open",
  approved: "Open",
  paused: "On Hold",
  closed: "Closed",
  cancelled: "Closed",
  draft: "Draft",
  pending_approval: "Pending Approval",
};

/**
 * PATCH /api/tenant/recruitment/jobs/[id]
 */
export async function PATCH(request: NextRequest, context: any) {
  try {
    const ctx = validateTenantContext(request, "write");
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    await ensureRecruitmentTables(sql);

    const rawStatus =
      typeof body?.status === "string" ? body.status.toLowerCase().replace(/\s+/g, "-") : null;
    const dbStatus = rawStatus ? STATUS_TO_DB[rawStatus] ?? null : null;
    if (rawStatus && !dbStatus) {
      return errorResponse("Invalid status (open|closed|on-hold)", 400);
    }

    const [row] = await sql`
      update admin_job_requisitions set
        status = coalesce(${dbStatus}, status),
        title = coalesce(${body?.title ?? null}, title),
        location = coalesce(${body?.location ?? null}, location),
        description = coalesce(${body?.description ?? null}, description),
        closed_at = case when ${dbStatus} = 'closed' then now() else closed_at end,
        updated_at = now()
      where id = ${id} and tenant_slug = ${ctx.tenantSlug}
      returning *
    `;

    if (!row) {
      return errorResponse("Job opening not found", 404);
    }

    const r = row as any;
    return NextResponse.json({
      success: true,
      data: {
        id: r.id,
        title: r.title,
        departmentId: r.department_id,
        status: STATUS_TO_UI[r.status] ?? r.status,
        postedDate: r.posted_at ? new Date(r.posted_at).toISOString().split("T")[0] : null,
      },
    });
  } catch (error) {
    console.error("Recruitment job PATCH error:", error);
    return handleTenantAdminError(error);
  }
}
