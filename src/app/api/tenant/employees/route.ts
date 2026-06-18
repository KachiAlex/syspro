import { NextRequest, NextResponse } from "next/server";
import { EmployeeService } from "@/lib/tenant-admin/service";
import { CreateEmployeeSchema, UpdateEmployeeSchema } from "@/lib/tenant-admin/validation";
import {
  validateTenantContext,
  parseJsonRequest,
  getPaginationParams,
  getFilterParams,
  getSortParams,
  errorResponse,
  handleTenantAdminError,
  checkRateLimit,
  asTenantSlug,
  asResourceId,
} from "@/lib/tenant-admin/utils";
import { AuditService } from "@/lib/tenant-admin/service";
import { TenantSlug, UserId, ResourceId, AuditAction } from "@/lib/tenant-admin/types";

/**
 * GET /api/tenant/employees
 * Retrieve all employees for a tenant
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`emp-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const pagination = getPaginationParams(request);
    const filters = getFilterParams(request);
    const sort = getSortParams(request);

    const service = new EmployeeService();
    const employees = await service.getAll(asTenantSlug(context.tenantSlug));

    return NextResponse.json({
      success: true,
      data: employees,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: employees.length,
      },
    });
  } catch (error) {
    console.error("Employee GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/employees
 * Create a new employee
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");

    const parsed = await parseJsonRequest(request, CreateEmployeeSchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    const service = new EmployeeService();
    const employee = await service.create(asTenantSlug(context.tenantSlug), {
      ...parsed.data,
      departmentId: parsed.data.departmentId as ResourceId,
      reportingManagerId: parsed.data.reportingManagerId as UserId | undefined,
      hireDate: parsed.data.hireDate ? new Date(parsed.data.hireDate) : undefined,
    });

    const auditService = new AuditService();
    await auditService.log(
      asTenantSlug(context.tenantSlug),
      context.userId as UserId,
      "create" as AuditAction,
      "employee",
      employee.id as ResourceId,
      { after: employee }
    );

    return NextResponse.json(
      {
        success: true,
        data: employee,
        message: "Employee created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Employee POST error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * PATCH /api/tenant/employees?id=<id>
 * Update an employee
 */
export async function PATCH(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const id = new URL(request.url).searchParams.get("id");

    if (!id) {
      return errorResponse("Employee ID is required", 400);
    }

    const parsed = await parseJsonRequest(request, UpdateEmployeeSchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    const service = new EmployeeService();
    const existing = await service.getById(asTenantSlug(context.tenantSlug), asResourceId(id!));
    const updated = await service.update(asTenantSlug(context.tenantSlug), asResourceId(id!), {
      ...parsed.data,
      departmentId: parsed.data.departmentId as ResourceId | undefined,
      reportingManagerId: parsed.data.reportingManagerId as UserId | undefined,
    });

    const auditService = new AuditService();
    await auditService.log(
      asTenantSlug(context.tenantSlug),
      context.userId as UserId,
      "update" as AuditAction,
      "employee",
      asResourceId(id!),
      { before: existing, after: updated }
    );

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Employee updated successfully",
    });
  } catch (error) {
    console.error("Employee PATCH error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * DELETE /api/tenant/employees?id=<id>
 * Delete an employee
 */
export async function DELETE(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "delete");
    const id = new URL(request.url).searchParams.get("id");

    if (!id) {
      return errorResponse("Employee ID is required", 400);
    }

    const service = new EmployeeService();
    const existing = await service.getById(asTenantSlug(context.tenantSlug), asResourceId(id!));
    await service.delete(asTenantSlug(context.tenantSlug), asResourceId(id!));

    const auditService = new AuditService();
    await auditService.log(
      asTenantSlug(context.tenantSlug),
      context.userId as UserId,
      "delete" as AuditAction,
      "employee",
      asResourceId(id!),
      { before: existing }
    );

    return NextResponse.json({
      success: true,
      message: "Employee deleted successfully",
    });
  } catch (error) {
    console.error("Employee DELETE error:", error);
    return handleTenantAdminError(error);
  }
}
