import { NextRequest, NextResponse } from "next/server";
import { AccessControlService } from "@/lib/tenant-admin/service";
import { UpdateAccessControlSchema, GrantTemporaryAccessSchema } from "@/lib/tenant-admin/validation";
import {
  validateTenantContext,
  parseJsonRequest,
  getPaginationParams,
  getSortParams,
  errorResponse,
  handleTenantAdminError,
  checkRateLimit,
  asTenantSlug,
  asResourceId,
  asUserId,
} from "@/lib/tenant-admin/utils";
import { AuditService } from "@/lib/tenant-admin/service";

/**
 * GET /api/tenant/access-control
 * Retrieve access control rules for a tenant
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`acl-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const userId = new URL(request.url).searchParams.get("userId");
    const pagination = getPaginationParams(request);
    const sort = getSortParams(request);

    const service = new AccessControlService();
    let controls;
    if (userId) {
      controls = await service.getUserAccess(asTenantSlug(context.tenantSlug), userId);
    } else {
      controls = await service.getAll(asTenantSlug(context.tenantSlug));
    }

    return NextResponse.json({
      success: true,
      data: controls,
      pagination: userId ? undefined : {
        page: pagination.page,
        limit: pagination.limit,
        total: Array.isArray(controls) ? controls.length : 0,
      },
    });
  } catch (error) {
    console.error("Access control GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/access-control
 * Grant access or create access control rule
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const action = new URL(request.url).searchParams.get("action") || "grant-temporary";

    if (action === "grant-temporary") {
      const parsed = await parseJsonRequest(request, GrantTemporaryAccessSchema);
      if (!parsed.success) {
        return errorResponse(parsed.error, 400, parsed.details);
      }

      const service = new AccessControlService();
      const accessId = await service.grantTemporaryAccess(
        asTenantSlug(context.tenantSlug),
        parsed.data.grantedTo,
        parsed.data.moduleKey,
        parsed.data.permissions as any,
        new Date(parsed.data.expiresAt),
        parsed.data.justification,
        context.userId
      );

      const auditService = new AuditService();
      await auditService.log(
        asTenantSlug(context.tenantSlug),
        context.userId,
        "create",
        "temporary_access",
        accessId,
        { access: parsed.data }
      );

      return NextResponse.json(
        {
          success: true,
          message: "Temporary access granted successfully",
        },
        { status: 201 }
      );
    } else {
      return errorResponse("Invalid action", 400);
    }
  } catch (error) {
    console.error("Access control POST error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * PATCH /api/tenant/access-control?id=<id>
 * Update access control rules
 */
export async function PATCH(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const id = new URL(request.url).searchParams.get("id");
    const action = new URL(request.url).searchParams.get("action");

    if (action === "revoke-temporary") {
      // Revoke temporary access
      if (!id) {
        return errorResponse("ID is required", 400);
      }

      const service = new AccessControlService();
      await service.revokeTemporaryAccess(asTenantSlug(context.tenantSlug), asResourceId(id!));

      const auditService = new AuditService();
      await auditService.log(
        asTenantSlug(context.tenantSlug),
        context.userId,
        "revoke",
        "temporary_access",
        asResourceId(id!)
      );

      return NextResponse.json({
        success: true,
        message: "Temporary access revoked successfully",
      });
    } else if (action === "update-module") {
      // Update module access rules
      const parsed = await parseJsonRequest(request, UpdateAccessControlSchema);
      if (!parsed.success) {
        return errorResponse(parsed.error, 400, parsed.details);
      }

      if (!id) {
        return errorResponse("Role ID is required", 400);
      }

      const service = new AccessControlService();
      const updated = await service.updateModuleAccess(
        asTenantSlug(context.tenantSlug),
        asResourceId(id!),
        parsed.data.moduleAccess
      );

      const auditService = new AuditService();
      await auditService.log(
        asTenantSlug(context.tenantSlug),
        context.userId,
        "update",
        "access_control",
        asResourceId(id!),
        { after: updated }
      );

      return NextResponse.json({
        success: true,
        data: updated,
        message: "Module access updated successfully",
      });
    } else {
      return errorResponse("Invalid action", 400);
    }
  } catch (error) {
    console.error("Access control PATCH error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * DELETE /api/tenant/access-control?id=<id>
 * Revoke or delete access control
 */
export async function DELETE(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "delete");
    const id = new URL(request.url).searchParams.get("id");

    if (!id) {
      return errorResponse("ID is required", 400);
    }

    const service = new AccessControlService();
    await service.delete(asTenantSlug(context.tenantSlug), asResourceId(id!));

    const auditService = new AuditService();
    await auditService.log(
      asTenantSlug(context.tenantSlug),
      context.userId,
      "delete",
      "access_control",
      asResourceId(id!)
    );

    return NextResponse.json({
      success: true,
      message: "Access control deleted successfully",
    });
  } catch (error) {
    console.error("Access control DELETE error:", error);
    return handleTenantAdminError(error);
  }
}
