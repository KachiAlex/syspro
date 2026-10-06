export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql } from "@/lib/sql-client";
import { ensureRecruitmentTables } from "@/lib/hr/db-recruitment";
import {
  validateTenantContext,
  getPaginationParams,
  errorResponse,
  handleTenantAdminError,
  checkRateLimit,
  parseJsonRequest,
} from "@/lib/tenant-admin/utils";
import { z } from "zod";

const CreateJobSchema = z.object({
  title: z.string().min(1),
  department: z.string(),
  description: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  salary: z.number().optional(),
  location: z.string().optional(),
  status: z
    .string()
    .optional()
    .transform((s) => (s ?? "open").toLowerCase().replace(/\s+/g, "-"))
    .pipe(z.enum(["open", "closed", "on-hold"])),
  employmentType: z.string().optional(),
});

const STATUS_TO_DB: Record<string, string> = {
  open: "open",
  closed: "closed",
  "on-hold": "paused",
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

function mapJob(r: any) {
  return {
    id: r.id,
    title: r.title,
    department: r.department_name ?? r.department_id,
    departmentId: r.department_id,
    description: r.description,
    location: r.location,
    salaryRange: r.salary_range,
    status: STATUS_TO_UI[r.status] ?? r.status,
    applicants: Number(r.applicant_count) || 0,
    headcount: r.headcount,
    postedDate: (r.posted_at ?? r.created_at)
      ? new Date(r.posted_at ?? r.created_at).toISOString().split("T")[0]
      : null,
    createdDate: r.created_at ? new Date(r.created_at).toISOString().split("T")[0] : null,
  };
}

/**
 * GET /api/tenant/recruitment/jobs
 * Job requisitions with live applicant counts.
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`jobs-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const pagination = getPaginationParams(request);
    await ensureRecruitmentTables(sql);

    const rows = await sql`
      select r.*, d.name as department_name,
        (select count(*)::int from admin_applications a
          where a.requisition_id = r.id) as applicant_count
      from admin_job_requisitions r
      left join admin_departments d
        on d.tenant_slug = r.tenant_slug and d.id = r.department_id
      where r.tenant_slug = ${context.tenantSlug}
      order by r.created_at desc
      limit ${pagination.limit} offset ${(pagination.page - 1) * pagination.limit}
    `;

    const jobs = (rows as any[]).map(mapJob);

    return NextResponse.json({
      success: true,
      data: jobs,
      pagination: { page: pagination.page, limit: pagination.limit, total: jobs.length },
    });
  } catch (error) {
    console.error("Recruitment jobs GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/recruitment/jobs
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");

    const parsed = await parseJsonRequest(request, CreateJobSchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    await ensureRecruitmentTables(sql);

    // Resolve the department name to an id when possible — admin_job_requisitions
    // keys off department_id.
    const [dept] = await sql`
      select id from admin_departments
      where tenant_slug = ${context.tenantSlug}
        and (id = ${parsed.data.department} or name ilike ${parsed.data.department})
      limit 1
    `;
    const departmentId = (dept as any)?.id ?? parsed.data.department;

    const id = randomUUID();
    const [row] = await sql`
      insert into admin_job_requisitions (
        id, tenant_slug, title, department_id, description, requirements,
        location, salary_range, employment_type, status, headcount,
        requested_by, posted_at, created_at, updated_at
      ) values (
        ${id}, ${context.tenantSlug}, ${parsed.data.title}, ${departmentId},
        ${parsed.data.description ?? ""},
        ${parsed.data.requirements ? parsed.data.requirements.join("\n") : null},
        ${parsed.data.location ?? null},
        ${parsed.data.salary != null ? String(parsed.data.salary) : null},
        ${parsed.data.employmentType ?? "full-time"},
        ${STATUS_TO_DB[parsed.data.status ?? "open"]}, 1,
        ${context.userId}, now(), now(), now()
      )
      returning *
    `;

    return NextResponse.json(
      { success: true, data: mapJob({ ...(row as any), applicant_count: 0, department_name: parsed.data.department }), message: "Job opening created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Recruitment jobs POST error:", error);
    return handleTenantAdminError(error);
  }
}
