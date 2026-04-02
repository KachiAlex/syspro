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

const CreateGoalSchema = z.object({
  employeeId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  targetValue: z.number().optional(),
  deadline: z.string().optional(),
  status: z.enum(["not-started", "in-progress", "completed", "on-hold"]).optional(),
});

/**
 * GET /api/tenant/performance/goals
 * Retrieve performance goals for a tenant
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`goals-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const pagination = getPaginationParams(request);
    const sort = getSortParams(request);

    // Mock performance goals data
    const goalsData = {
      goals: [
        {
          id: "goal-1",
          employeeId: "emp-1",
          employeeName: "John Doe",
          title: "Complete project X",
          description: "Deliver project X on schedule",
          targetValue: 100,
          currentValue: 75,
          deadline: "2026-06-30",
          status: "in-progress",
          progress: 75,
          createdDate: "2026-01-15",
        },
        {
          id: "goal-2",
          employeeId: "emp-2",
          employeeName: "Jane Smith",
          title: "Improve code quality",
          description: "Reduce code defects by 30%",
          targetValue: 30,
          currentValue: 15,
          deadline: "2026-05-31",
          status: "in-progress",
          progress: 50,
          createdDate: "2026-02-01",
        },
        {
          id: "goal-3",
          employeeId: "emp-1",
          employeeName: "John Doe",
          title: "Team leadership training",
          description: "Complete leadership certification",
          targetValue: 1,
          currentValue: 0,
          deadline: "2026-08-31",
          status: "not-started",
          progress: 0,
          createdDate: "2026-03-01",
        },
      ],
    };

    return NextResponse.json({
      success: true,
      data: goalsData,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: goalsData.goals.length,
      },
    });
  } catch (error) {
    console.error("Performance goals GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/performance/goals
 * Create a performance goal
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");

    const parsed = await parseJsonRequest(request, CreateGoalSchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    const goal = {
      id: `goal-${Date.now()}`,
      ...parsed.data,
      tenantSlug: context.tenantSlug,
      status: parsed.data.status || "not-started",
      currentValue: 0,
      progress: 0,
      createdDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      createdBy: context.userId,
    };

    return NextResponse.json(
      {
        success: true,
        data: goal,
        message: "Performance goal created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Performance goals POST error:", error);
    return handleTenantAdminError(error);
  }
}
