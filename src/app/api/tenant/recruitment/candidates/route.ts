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

const CreateCandidateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  jobId: z.string(),
  resume: z.string().optional(),
  status: z.enum(["applied", "screening", "interview", "offer", "rejected"]).optional(),
});

/**
 * GET /api/tenant/recruitment/candidates
 * Retrieve candidates for a tenant
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`candidates-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const pagination = getPaginationParams(request);
    const sort = getSortParams(request);

    // Mock candidate data
    const candidatesData = {
      candidates: [
        {
          id: "cand-1",
          name: "Alice Johnson",
          email: "alice@example.com",
          phone: "+1-555-0101",
          jobId: "job-1",
          jobTitle: "Senior Software Engineer",
          status: "interview",
          appliedDate: "2026-03-25",
          rating: 4.5,
          notes: "Strong technical background",
        },
        {
          id: "cand-2",
          name: "Bob Martinez",
          email: "bob@example.com",
          phone: "+1-555-0102",
          jobId: "job-1",
          jobTitle: "Senior Software Engineer",
          status: "screening",
          appliedDate: "2026-03-28",
          rating: 4.0,
          notes: "Good fit for the role",
        },
        {
          id: "cand-3",
          name: "Carol Davis",
          email: "carol@example.com",
          phone: "+1-555-0103",
          jobId: "job-2",
          jobTitle: "Product Manager",
          status: "applied",
          appliedDate: "2026-03-30",
          rating: 3.5,
          notes: "Relevant experience",
        },
      ],
    };

    return NextResponse.json({
      success: true,
      data: candidatesData,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: candidatesData.candidates.length,
      },
    });
  } catch (error) {
    console.error("Candidates GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/recruitment/candidates
 * Create a candidate record
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");

    const parsed = await parseJsonRequest(request, CreateCandidateSchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    const candidate = {
      id: `cand-${Date.now()}`,
      ...parsed.data,
      tenantSlug: context.tenantSlug,
      status: parsed.data.status || "applied",
      appliedDate: new Date().toISOString().split('T')[0],
      rating: 0,
      createdAt: new Date().toISOString(),
      createdBy: context.userId,
    };

    return NextResponse.json(
      {
        success: true,
        data: candidate,
        message: "Candidate created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Candidates POST error:", error);
    return handleTenantAdminError(error);
  }
}
