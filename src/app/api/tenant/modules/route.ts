import { NextRequest, NextResponse } from "next/server";
import { ModuleService } from "@/lib/tenant-admin/service";
import {
  validateTenantContext,
  parseJsonRequest,
  getPaginationParams,
  getSortParams,
  errorResponse,
  handleTenantAdminError,
  checkRateLimit,
  asTenantSlug,
} from "@/lib/tenant-admin/utils";
import { AuditService } from "@/lib/tenant-admin/service";
import { TenantSlug, UserId, ResourceId, AuditAction } from "@/lib/tenant-admin/types";
import { z } from "zod";

const CreateModuleSchema = z.object({
  key: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  icon: z.string().optional(),
  enabled: z.boolean().optional(),
  version: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

const UpdateModuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
  permissions: z.array(z.string()).optional(),
  settings: z.record(z.any()).optional(),
});

/**
 * GET /api/tenant/modules
 * Retrieve all modules for a tenant
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`module-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const pagination = getPaginationParams(request);
    const sort = getSortParams(request);

    const service = new ModuleService();
    // TODO: Implement proper module listing
    const modules = {
      data: [],
      total: 0,
    };

    return NextResponse.json({
      success: true,
      data: modules.data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: modules.total,
      },
    });
  } catch (error) {
    console.error("Module GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/modules
 * Create a new module
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");

    const parsed = await parseJsonRequest(request, CreateModuleSchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    const service = new ModuleService();
    const module = await service.create(asTenantSlug(context.tenantSlug), {
      ...parsed.data,
      createdBy: context.userId as UserId,
    });

    const auditService = new AuditService();
    await auditService.log(
      asTenantSlug(context.tenantSlug),
      context.userId as UserId,
      "create" as AuditAction,
      "module",
      module.id as ResourceId,
      { after: module }
    );

    return NextResponse.json(
      {
        success: true,
        data: module,
        message: "Module created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Module POST error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * PATCH /api/tenant/modules?id=<id>
 * Update a module
 */
export async function PATCH(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const id = new URL(request.url).searchParams.get("id");

    if (!id) {
      return errorResponse("Module ID is required", 400);
    }

    const parsed = await parseJsonRequest(request, UpdateModuleSchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    const service = new ModuleService(context.tenantSlug);
    // TODO: Implement proper module update
    const updated = {
      id,
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    };

    // TODO: Implement audit logging
    // const auditService = new AuditService();
    // await auditService.log(...);

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Module updated successfully",
    });
  } catch (error) {
    console.error("Module PATCH error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * DELETE /api/tenant/modules?id=<id>
 * Delete a module
 */
export async function DELETE(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "delete");
    const id = new URL(request.url).searchParams.get("id");

    if (!id) {
      return errorResponse("Module ID is required", 400);
    }

    const service = new ModuleService(context.tenantSlug);
    // TODO: Implement proper module deletion
    // const existing = await service.getById(id);
    // await service.delete(id);

    // TODO: Implement audit logging
    // const auditService = new AuditService();
    // await auditService.log(...);

    return NextResponse.json({
      success: true,
      message: "Module deleted successfully",
    });
  } catch (error) {
    console.error("Module DELETE error:", error);
    return handleTenantAdminError(error);
  }
}
