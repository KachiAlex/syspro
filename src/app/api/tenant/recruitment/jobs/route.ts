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

const CreateJobSchema = z.object({
  title: z.string().min(1),
  department: z.string(),
  description: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  salary: z.number().optional(),
  location: z.string().optional(),
  status: z.enum(["open", "closed", "on-hold"]).optional(),
});

/**
 * GET /api/tenant/recruitment/jobs
 * Retrieve job postings for a tenant
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`jobs-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const pagination = getPaginationParams(request);
    const sort = getSortParams(request);

    // Mock job data
    const jobsData = {
      jobs: [
        {
          id: "job-1",
          title: "Senior Software Engineer",
          department: "Engineering",
          description: "We are looking for a senior software engineer",
          requirements: ["5+ years experience", "Node.js", "React"],
          salary: 120000,
          location: "San Francisco, CA",
          status: "open",
          postedDate: "2026-03-15",
          applicants: 12,
        },
        {
          id: "job-2",
          title: "Product Manager",
          department: "Product",
          description: "Lead product strategy and development",
          requirements: ["3+ years PM experience", "Data analysis"],
          salary: 110000,
          location: "New York, NY",
          status: "open",
          postedDate: "2026-03-20",
          applicants: 8,
        },
      ],
    };

    return NextResponse.json({
      success: true,
      data: jobsData,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: jobsData.jobs.length,
      },
    });
  } catch (error) {
    console.error("Jobs GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/recruitment/jobs
 * Create a job posting
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");

    const parsed = await parseJsonRequest(request, CreateJobSchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    const job = {
      id: `job-${Date.now()}`,
      ...parsed.data,
      tenantSlug: context.tenantSlug,
      status: parsed.data.status || "open",
      postedDate: new Date().toISOString().split('T')[0],
      applicants: 0,
      createdAt: new Date().toISOString(),
      createdBy: context.userId,
    };

    return NextResponse.json(
      {
        success: true,
        data: job,
        message: "Job posting created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Jobs POST error:", error);
    return handleTenantAdminError(error);
  }
}
