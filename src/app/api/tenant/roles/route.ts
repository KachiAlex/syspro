import { NextRequest, NextResponse } from "next/server";
import { RoleService } from "@/lib/tenant-admin/service";
import { CreateRoleSchema, UpdateRoleSchema } from "@/lib/tenant-admin/validation";
import {
  extractTenantContext,
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
import { UserId } from "@/lib/tenant-admin/types";

/**
 * GET /api/tenant/roles
 * Retrieve all roles for a tenant
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`role-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const pagination = getPaginationParams(request);
    const filters = getFilterParams(request);
    const sort = getSortParams(request);

    const service = new RoleService();
    const roles = await service.getAll(asTenantSlug(context.tenantSlug));

    return NextResponse.json({
      success: true,
      data: roles,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: roles.length,
      },
    });
  } catch (error) {
    console.error("Role GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/roles
 * Create a new role
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");

    const parsed = await parseJsonRequest(request, CreateRoleSchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    const service = new RoleService();
    const role = await service.create(asTenantSlug(context.tenantSlug), parsed.data);

    const auditService = new AuditService();
    await auditService.log(
      asTenantSlug(context.tenantSlug),
      { __brand: "UserId", value: context.userId } as unknown as UserId,
      "create",
      "role",
      role.id,
      { after: role }
    );

    return NextResponse.json(
      {
        success: true,
        data: role,
        message: "Role created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Role POST error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * PATCH /api/tenant/roles?id=<id>
 * Update a role
 */
export async function PATCH(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const id = new URL(request.url).searchParams.get("id");

    if (!id) {
      return errorResponse("Role ID is required", 400);
    }

    const parsed = await parseJsonRequest(request, UpdateRoleSchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    const service = new RoleService();
    const existing = await service.getById(asTenantSlug(context.tenantSlug), asResourceId(id!));
    const updated = await service.update(asTenantSlug(context.tenantSlug), asResourceId(id!), parsed.data);

    const auditService = new AuditService();
    await auditService.log(
      asTenantSlug(context.tenantSlug),
      { __brand: "UserId", value: context.userId } as unknown as UserId,
      "update",
      "role",
      asResourceId(id!),
      { before: existing, after: updated }
    );

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Role updated successfully",
    });
  } catch (error) {
    console.error("Role PATCH error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * DELETE /api/tenant/roles?id=<id>
 * Delete a role
 */
export async function DELETE(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "delete");
    const id = new URL(request.url).searchParams.get("id");

    if (!id) {
      return errorResponse("Role ID is required", 400);
    }

    const service = new RoleService();
    const existing = await service.getById(asTenantSlug(context.tenantSlug), asResourceId(id!));
    await service.delete(asTenantSlug(context.tenantSlug), asResourceId(id!));

    const auditService = new AuditService();
    await auditService.log(
      asTenantSlug(context.tenantSlug),
      { __brand: "UserId", value: context.userId } as unknown as UserId,
      "delete",
      "role",
      asResourceId(id!),
      { before: existing }
    );

    return NextResponse.json({
      success: true,
      message: "Role deleted successfully",
    });
  } catch (error) {
    console.error("Role DELETE error:", error);
    return handleTenantAdminError(error);
  }
}
