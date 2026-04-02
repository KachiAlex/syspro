import { NextRequest, NextResponse } from "next/server";
import {
  validateTenantContext,
  getPaginationParams,
  getSortParams,
  errorResponse,
  handleTenantAdminError,
  checkRateLimit,
} from "@/lib/tenant-admin/utils";

/**
 * GET /api/tenant/attendance
 * Retrieve attendance data for a tenant
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`attendance-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const url = new URL(request.url);
    const date = url.searchParams.get("date") || new Date().toISOString().split('T')[0];
    const pagination = getPaginationParams(request);
    const sort = getSortParams(request);

    // Mock attendance data
    const attendanceData = {
      date,
      totalEmployees: 45,
      presentCount: 42,
      absentCount: 2,
      lateCount: 1,
      records: [
        {
          id: "att-1",
          employeeId: "emp-1",
          employeeName: "John Doe",
          date,
          checkIn: "09:00",
          checkOut: "17:30",
          status: "present",
          duration: "8h 30m",
        },
        {
          id: "att-2",
          employeeId: "emp-2",
          employeeName: "Jane Smith",
          date,
          checkIn: "09:15",
          checkOut: "17:45",
          status: "late",
          duration: "8h 30m",
        },
        {
          id: "att-3",
          employeeId: "emp-3",
          employeeName: "Bob Wilson",
          date,
          checkIn: null,
          checkOut: null,
          status: "absent",
          duration: "0h",
        },
      ],
    };

    return NextResponse.json({
      success: true,
      data: attendanceData,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: attendanceData.records.length,
      },
    });
  } catch (error) {
    console.error("Attendance GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/attendance
 * Record attendance (check-in/check-out)
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const body = await request.json().catch(() => ({}));

    const attendance = {
      id: `att-${Date.now()}`,
      ...body,
      tenantSlug: context.tenantSlug,
      createdAt: new Date().toISOString(),
      createdBy: context.userId,
    };

    return NextResponse.json(
      {
        success: true,
        data: attendance,
        message: "Attendance recorded successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Attendance POST error:", error);
    return handleTenantAdminError(error);
  }
}
