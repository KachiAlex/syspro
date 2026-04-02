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
 * GET /api/tenant/payroll
 * Retrieve payroll data for a tenant
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`payroll-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const url = new URL(request.url);
    const period = url.searchParams.get("period") || new Date().toISOString().slice(0, 7);
    const pagination = getPaginationParams(request);
    const sort = getSortParams(request);

    // Mock payroll data
    const payrollData = {
      period,
      totalEmployees: 45,
      totalGross: 450000,
      totalDeductions: 67500,
      totalNet: 382500,
      payrolls: [
        {
          id: "payroll-1",
          employeeId: "emp-1",
          employeeName: "John Doe",
          period,
          grossSalary: 10000,
          deductions: 1500,
          netSalary: 8500,
          status: "processed",
          processedDate: new Date().toISOString(),
        },
        {
          id: "payroll-2",
          employeeId: "emp-2",
          employeeName: "Jane Smith",
          period,
          grossSalary: 12000,
          deductions: 1800,
          netSalary: 10200,
          status: "processed",
          processedDate: new Date().toISOString(),
        },
      ],
    };

    return NextResponse.json({
      success: true,
      data: payrollData,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: payrollData.payrolls.length,
      },
    });
  } catch (error) {
    console.error("Payroll GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/payroll
 * Create or process payroll
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const body = await request.json().catch(() => ({}));

    const payroll = {
      id: `payroll-${Date.now()}`,
      ...body,
      tenantSlug: context.tenantSlug,
      createdAt: new Date().toISOString(),
      createdBy: context.userId,
      status: "draft",
    };

    return NextResponse.json(
      {
        success: true,
        data: payroll,
        message: "Payroll created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Payroll POST error:", error);
    return handleTenantAdminError(error);
  }
}
