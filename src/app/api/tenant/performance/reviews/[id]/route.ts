export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import {
  validateTenantContext,
  errorResponse,
  handleTenantAdminError,
} from "@/lib/tenant-admin/utils";
import { ensureReviewTables } from "@/lib/tenant/performance-reviews";

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
 * PATCH /api/tenant/performance/reviews/[id]
 */
export async function PATCH(request: NextRequest, context: any) {
  try {
    const ctx = validateTenantContext(request, "write");
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    await ensureReviewTables(sql);

    const status = typeof body?.status === "string" ? body.status.toLowerCase().replace(/ /g, "_") : null;
    const rating = typeof body?.rating === "number" ? body.rating : null;
    if (rating !== null && (rating < 1 || rating > 5)) {
      return errorResponse("rating must be between 1 and 5", 400);
    }

    const [row] = await sql`
      update tenant_performance_reviews set
        status = coalesce(${status}, status),
        rating = coalesce(${rating}, rating),
        comments = coalesce(${body?.comments ?? body?.feedback ?? null}, comments),
        review_date = coalesce(${body?.reviewDate ?? null}, review_date),
        updated_at = now()
      where id = ${id} and tenant_slug = ${ctx.tenantSlug}
      returning *
    `;

    if (!row) {
      return errorResponse("Review not found", 404);
    }

    return NextResponse.json({ success: true, data: mapReview(row) });
  } catch (error) {
    console.error("Performance review PATCH error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * DELETE /api/tenant/performance/reviews/[id]
 */
export async function DELETE(request: NextRequest, context: any) {
  try {
    const ctx = validateTenantContext(request, "write");
    const { id } = await context.params;

    await ensureReviewTables(sql);

    const rows = await sql`
      delete from tenant_performance_reviews
      where id = ${id} and tenant_slug = ${ctx.tenantSlug}
      returning id
    `;

    if (!(rows as any[]).length) {
      return errorResponse("Review not found", 404);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Performance review DELETE error:", error);
    return handleTenantAdminError(error);
  }
}
