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

const CreateCandidateSchema = z.object({
  name: z.string().optional(),
  fullName: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  jobId: z.string().optional(),
  resume: z.string().optional(),
  resumeUrl: z.string().optional(),
  source: z.string().optional(),
  status: z.string().optional(),
  currentStage: z.string().optional(),
});

const STAGE_TO_DB: Record<string, string> = {
  applied: "new",
  new: "new",
  screening: "screening",
  shortlist: "shortlist",
  interview: "interview",
  offer: "offer",
  hired: "hired",
  rejected: "rejected",
  talent_pool: "talent_pool",
  "talent-pool": "talent_pool",
};

const STAGE_TO_UI: Record<string, string> = {
  new: "Applied",
  applied: "Applied",
  screening: "Screening",
  shortlist: "Screening",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
  talent_pool: "Applied",
};

function mapCandidate(r: any) {
  return {
    id: r.id,
    name: r.full_name,
    email: r.email,
    phone: r.phone,
    jobId: r.requisition_id ?? null,
    jobTitle: r.job_title ?? null,
    stage: STAGE_TO_UI[r.current_stage] ?? r.current_stage,
    rating: r.overall_score != null ? Number(r.overall_score) : null,
    appliedDate: r.created_at ? new Date(r.created_at).toISOString().split("T")[0] : null,
  };
}

/**
 * GET /api/tenant/recruitment/candidates
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`candidates-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const pagination = getPaginationParams(request);
    await ensureRecruitmentTables(sql);

    const rows = await sql`
      select c.*, a.requisition_id, r.title as job_title
      from admin_candidates c
      left join admin_applications a
        on a.tenant_slug = c.tenant_slug and a.candidate_id = c.id
      left join admin_job_requisitions r
        on r.id = a.requisition_id
      where c.tenant_slug = ${context.tenantSlug}
      order by c.created_at desc
      limit ${pagination.limit} offset ${(pagination.page - 1) * pagination.limit}
    `;

    const candidates = (rows as any[]).map(mapCandidate);

    return NextResponse.json({
      success: true,
      data: candidates,
      pagination: { page: pagination.page, limit: pagination.limit, total: candidates.length },
    });
  } catch (error) {
    console.error("Recruitment candidates GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/recruitment/candidates
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");

    const parsed = await parseJsonRequest(request, CreateCandidateSchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    await ensureRecruitmentTables(sql);

    const name = parsed.data.name ?? parsed.data.fullName;
    if (!name) {
      return errorResponse("name is required", 400);
    }
    const stageInput = (parsed.data.status ?? parsed.data.currentStage ?? "applied").toLowerCase();
    const stage = STAGE_TO_DB[stageInput] ?? "new";

    const id = randomUUID();
    const [row] = await sql`
      insert into admin_candidates (
        id, tenant_slug, full_name, email, phone, resume_url,
        source, current_stage, created_at, updated_at
      ) values (
        ${id}, ${context.tenantSlug}, ${name}, ${parsed.data.email},
        ${parsed.data.phone ?? null}, ${parsed.data.resume ?? parsed.data.resumeUrl ?? null},
        ${parsed.data.source ?? "manual"}, ${stage}, now(), now()
      )
      returning *
    `;

    // Link to the job via an application record when a jobId was supplied.
    if (parsed.data.jobId) {
      await sql`
        insert into admin_applications (
          id, tenant_slug, requisition_id, candidate_id, status, created_at, updated_at
        ) values (
          ${randomUUID()}, ${context.tenantSlug}, ${parsed.data.jobId}, ${id}, 'applied', now(), now()
        )
        on conflict do nothing
      `;
    }

    return NextResponse.json(
      { success: true, data: mapCandidate(row), message: "Candidate created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Recruitment candidates POST error:", error);
    return handleTenantAdminError(error);
  }
}
