export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql } from "@/lib/sql-client";
import { ensureReviewTables } from "@/lib/tenant/performance-reviews";
import {
  validateTenantContext,
  getPaginationParams,
  errorResponse,
  handleTenantAdminError,
  checkRateLimit,
  parseJsonRequest,
} from "@/lib/tenant-admin/utils";
import { z } from "zod";

const CreateReviewSchema = z.object({
  employeeId: z.string(),
  reviewerId: z.string().optional(),
  reviewer: z.string().optional(),
  status: z.string().optional(),
  rating: z.number().min(1).max(5),
  comments: z.string().optional(),
  feedback: z.string().optional(),
  reviewDate: z.string().optional(),
  reviewPeriod: z.string().optional(),
});


function mapReview(r: any) {
  return {
    id: r.id,
    employeeId: r.employee_id,
    employeeName: r.employee_name ?? r.employee_id,
    reviewerId: r.reviewer_id,
    reviewer: r.reviewer_name ?? r.reviewer_id,
    rating: Number(r.rating) || 0,
    comments: r.comments,
    feedback: r.comments,
    reviewDate: r.review_date ? new Date(r.review_date).toISOString().split("T")[0] : null,
    reviewPeriod: r.review_period,
    status: r.status === "completed" ? "Completed" : "In Progress",
    createdDate: r.created_at ? new Date(r.created_at).toISOString().split("T")[0] : null,
  };
}

/**
 * GET /api/tenant/performance/reviews
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`reviews-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const pagination = getPaginationParams(request);
    await ensureReviewTables(sql);

    const rows = await sql`
      select * from tenant_performance_reviews
      where tenant_slug = ${context.tenantSlug}
      order by created_at desc
      limit ${pagination.limit} offset ${(pagination.page - 1) * pagination.limit}
    `;

    const reviews = (rows as any[]).map(mapReview);

    return NextResponse.json({
      success: true,
      data: reviews,
      pagination: { page: pagination.page, limit: pagination.limit, total: reviews.length },
    });
  } catch (error) {
    console.error("Performance reviews GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/performance/reviews
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");

    const parsed = await parseJsonRequest(request, CreateReviewSchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    await ensureReviewTables(sql);

    const [emp] = await sql`
      select name from admin_employees
      where tenant_slug = ${context.tenantSlug} and id = ${parsed.data.employeeId}
      limit 1
    `;
    const reviewerId = parsed.data.reviewerId ?? context.userId;
    const [rev] = await sql`
      select coalesce(e.name, a.name) as name
      from (select ${context.tenantSlug}::text as ts) t
      left join admin_employees e on e.tenant_slug = t.ts and e.id::text = ${reviewerId}
      left join tenant_admins a on a.tenant_slug = t.ts and a.id::text = ${reviewerId}
      limit 1
    `;
    const reviewerName = parsed.data.reviewer ?? (rev as any)?.name ?? null;
    const status = (parsed.data.status ?? "").toLowerCase() === "completed" ? "completed" : "in_progress";

    const id = randomUUID();
    const [row] = await sql`
      insert into tenant_performance_reviews (
        id, tenant_slug, employee_id, employee_name, reviewer_id, reviewer_name,
        rating, comments, review_date, review_period, status, created_at, updated_at
      ) values (
        ${id}, ${context.tenantSlug}, ${parsed.data.employeeId}, ${(emp as any)?.name ?? null},
        ${reviewerId}, ${reviewerName},
        ${parsed.data.rating}, ${parsed.data.comments ?? parsed.data.feedback ?? null},
        ${parsed.data.reviewDate ?? null}, ${parsed.data.reviewPeriod ?? null},
        ${status}, now(), now()
      )
      returning *
    `;

    return NextResponse.json(
      { success: true, data: mapReview(row), message: "Performance review created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Performance reviews POST error:", error);
    return handleTenantAdminError(error);
  }
}
