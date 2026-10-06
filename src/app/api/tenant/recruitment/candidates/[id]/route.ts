export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { ensureRecruitmentTables } from "@/lib/hr/db-recruitment";
import {
  validateTenantContext,
  errorResponse,
  handleTenantAdminError,
} from "@/lib/tenant-admin/utils";

const VALID_STAGES = new Set([
  "new", "applied", "screening", "shortlist", "interview",
  "offer", "hired", "rejected", "talent_pool",
]);

const STAGE_TO_DB: Record<string, string> = {
  applied: "new",
  "talent-pool": "talent_pool",
  "on-hold": "talent_pool",
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

/**
 * PATCH /api/tenant/recruitment/candidates/[id]
 * Update candidate stage or rating.
 */
export async function PATCH(request: NextRequest, context: any) {
  try {
    const ctx = validateTenantContext(request, "write");
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    await ensureRecruitmentTables(sql);

    let stage = typeof body?.stage === "string" ? body.stage.toLowerCase().replace(/\s+/g, "_") : null;
    if (stage) stage = STAGE_TO_DB[stage] ?? stage;
    if (stage && !VALID_STAGES.has(stage)) {
      return errorResponse("Invalid stage", 400);
    }

    const rating = typeof body?.rating === "number" ? body.rating : null;
    if (rating !== null && (rating < 0 || rating > 5)) {
      return errorResponse("rating must be between 0 and 5", 400);
    }

    const [row] = await sql`
      update admin_candidates set
        current_stage = coalesce(${stage}, current_stage),
        overall_score = coalesce(${rating}, overall_score),
        updated_at = now()
      where id = ${id} and tenant_slug = ${ctx.tenantSlug}
      returning *
    `;

    if (!row) {
      return errorResponse("Candidate not found", 404);
    }

    const r = row as any;
    return NextResponse.json({
      success: true,
      data: {
        id: r.id,
        name: r.full_name,
        stage: STAGE_TO_UI[r.current_stage] ?? r.current_stage,
        rating: r.overall_score != null ? Number(r.overall_score) : null,
      },
    });
  } catch (error) {
    console.error("Candidate PATCH error:", error);
    return handleTenantAdminError(error);
  }
}
