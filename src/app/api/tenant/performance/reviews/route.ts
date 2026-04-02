import { NextRequest, NextResponse } from "next/server";
import {
  validateTenantContext,
  getPaginationParams,
  getSortParams,
  errorResponse,
  handleTenantAdminError,
  checkRateLimit,
  parseJsonRequest,
} from "@/lib/tenant-admin/utils";
import { z } from "zod";

const CreateReviewSchema = z.object({
  employeeId: z.string(),
  reviewerId: z.string(),
  rating: z.number().min(1).max(5),
  comments: z.string().optional(),
  reviewDate: z.string().optional(),
});

/**
 * GET /api/tenant/performance/reviews
 * Retrieve performance reviews for a tenant
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`reviews-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const pagination = getPaginationParams(request);
    const sort = getSortParams(request);

    // Mock performance review data
    const reviewsData = {
      reviews: [
        {
          id: "review-1",
          employeeId: "emp-1",
          employeeName: "John Doe",
          reviewerId: "emp-10",
          reviewerName: "Manager",
          rating: 4.5,
          comments: "Excellent performance and leadership skills",
          reviewDate: "2026-03-15",
          status: "completed",
        },
        {
          id: "review-2",
          employeeId: "emp-2",
          employeeName: "Jane Smith",
          reviewerId: "emp-10",
          reviewerName: "Manager",
          rating: 4.0,
          comments: "Strong technical skills and teamwork",
          reviewDate: "2026-03-18",
          status: "completed",
        },
        {
          id: "review-3",
          employeeId: "emp-3",
          employeeName: "Bob Wilson",
          reviewerId: "emp-10",
          reviewerName: "Manager",
          rating: null,
          comments: null,
          reviewDate: null,
          status: "pending",
        },
      ],
    };

    return NextResponse.json({
      success: true,
      data: reviewsData,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: reviewsData.reviews.length,
      },
    });
  } catch (error) {
    console.error("Performance reviews GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/performance/reviews
 * Create a performance review
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");

    const parsed = await parseJsonRequest(request, CreateReviewSchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    const review = {
      id: `review-${Date.now()}`,
      ...parsed.data,
      tenantSlug: context.tenantSlug,
      reviewDate: parsed.data.reviewDate || new Date().toISOString().split('T')[0],
      status: "completed",
      createdAt: new Date().toISOString(),
      createdBy: context.userId,
    };

    return NextResponse.json(
      {
        success: true,
        data: review,
        message: "Performance review created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Performance reviews POST error:", error);
    return handleTenantAdminError(error);
  }
}
