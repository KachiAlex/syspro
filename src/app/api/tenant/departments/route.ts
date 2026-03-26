import { NextRequest, NextResponse } from "next/server";
import { DepartmentService } from "@/lib/tenant-admin/service";
import { CreateDepartmentSchema, UpdateDepartmentSchema } from "@/lib/tenant-admin/validation";
import {
  extractTenantContext,
  validateTenantContext,
  parseJsonRequest,
  getPaginationParams,
  getFilterParams,
  getSortParams,
  buildAuditTrail,
  errorResponse,
  handleTenantAdminError,
  checkRateLimit,
  asTenantSlug,
  asResourceId,
} from "@/lib/tenant-admin/utils";
import { AuditService } from "@/lib/tenant-admin/service";

/**
 * GET /api/tenant/departments
 * Retrieve all departments for a tenant with optional filtering/pagination
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");
    
    // Rate limiting check
    if (!checkRateLimit(`dept-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const pagination = getPaginationParams(request);
    const filters = getFilterParams(request);
    const sort = getSortParams(request);

    const service = new DepartmentService(context.tenantSlug);
    const departments = await service.getAll(context.tenantSlug);

    return NextResponse.json({
      success: true,
      data: departments,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: departments.length,
      },
    });
  } catch (error) {
    console.error("Department GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/departments
 * Create a new department
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");

    const parsed = await parseJsonRequest(request, CreateDepartmentSchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    const service = new DepartmentService();
    const department = await service.create(asTenantSlug(context.tenantSlug), parsed.data);

    // Log audit trail
    const auditService = new AuditService();
    await auditService.log(
      asTenantSlug(context.tenantSlug),
      context.userId,
      "create",
      "department",
      department.id,
      { after: department }
    );

    return NextResponse.json(
      {
        success: true,
        data: department,
        message: "Department created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Department POST error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * PATCH /api/tenant/departments?id=<id>
 * Update a department
 */
export async function PATCH(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const id = new URL(request.url).searchParams.get("id");

    if (!id) {
      return errorResponse("Department ID is required", 400);
    }

    const parsed = await parseJsonRequest(request, UpdateDepartmentSchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    const service = new DepartmentService();
    const existing = await service.getById(asTenantSlug(context.tenantSlug), asResourceId(id!));
    const updated = await service.update(asTenantSlug(context.tenantSlug), asResourceId(id!), parsed.data);

    // Log audit trail
    const auditService = new AuditService();
    await auditService.log(
      asTenantSlug(context.tenantSlug),
      context.userId,
      "update",
      "department",
      asResourceId(id!),
      { before: existing, after: updated }
    );

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Department updated successfully",
    });
  } catch (error) {
    console.error("Department PATCH error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * DELETE /api/tenant/departments?id=<id>
 * Delete a department
 */
export async function DELETE(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "delete");
    const id = new URL(request.url).searchParams.get("id");

    if (!id) {
      return errorResponse("Department ID is required", 400);
    }

    const service = new DepartmentService();
    const existing = await service.getById(asTenantSlug(context.tenantSlug), asResourceId(id!));
    await service.delete(asTenantSlug(context.tenantSlug), asResourceId(id!));

    // Log audit trail
    const auditService = new AuditService();
    await auditService.log(
      asTenantSlug(context.tenantSlug),
      context.userId,
      "delete",
      "department",
      asResourceId(id!),
      { before: existing }
    );

    return NextResponse.json({
      success: true,
      message: "Department deleted successfully",
    });
  } catch (error) {
    console.error("Department DELETE error:", error);
    return handleTenantAdminError(error);
  }
}
