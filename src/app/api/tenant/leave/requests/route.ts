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

const CreateLeaveRequestSchema = z.object({
  employeeId: z.string(),
  leaveType: z.enum(["annual", "sick", "maternity", "unpaid", "other"]),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
  approverComments: z.string().optional(),
});

/**
 * GET /api/tenant/leave/requests
 * Retrieve leave requests for a tenant
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`leave-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const pagination = getPaginationParams(request);
    const sort = getSortParams(request);

    // Mock leave request data
    const leaveData = {
      requests: [
        {
          id: "leave-1",
          employeeId: "emp-1",
          employeeName: "John Doe",
          leaveType: "annual",
          startDate: "2026-04-10",
          endDate: "2026-04-15",
          days: 5,
          reason: "Vacation",
          status: "approved",
          approvedBy: "Manager",
          approvedDate: "2026-04-01",
        },
        {
          id: "leave-2",
          employeeId: "emp-2",
          employeeName: "Jane Smith",
          leaveType: "sick",
          startDate: "2026-04-02",
          endDate: "2026-04-03",
          days: 2,
          reason: "Medical appointment",
          status: "pending",
          approvedBy: null,
          approvedDate: null,
        },
      ],
    };

    return NextResponse.json({
      success: true,
      data: leaveData,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: leaveData.requests.length,
      },
    });
  } catch (error) {
    console.error("Leave request GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/leave/requests
 * Create a leave request
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");

    const parsed = await parseJsonRequest(request, CreateLeaveRequestSchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    const leaveRequest = {
      id: `leave-${Date.now()}`,
      ...parsed.data,
      tenantSlug: context.tenantSlug,
      status: "pending",
      createdAt: new Date().toISOString(),
      createdBy: context.userId,
    };

    return NextResponse.json(
      {
        success: true,
        data: leaveRequest,
        message: "Leave request created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Leave request POST error:", error);
    return handleTenantAdminError(error);
  }
}
