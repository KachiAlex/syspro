import { NextRequest, NextResponse } from "next/server";
import { WorkflowService } from "@/lib/tenant-admin/service";
import { AuditService } from "@/lib/tenant-admin/service";
import {
  validateTenantContext,
  errorResponse,
  handleTenantAdminError,
  checkRateLimit,
  asTenantSlug,
  asResourceId,
} from "@/lib/tenant-admin/utils";
import { TenantSlug, UserId, ResourceId, AuditAction } from "@/lib/tenant-admin/types";

/**
 * POST /api/tenant/workflows/{id}/duplicate
 * Duplicate an existing workflow
 */
export async function POST(request: NextRequest, context: any) {
  try {
    const { params } = context;
    const id = params.id;
    if (!id) {
      return errorResponse("Workflow ID is required", 400);
    }

    const tenantContext = validateTenantContext(request, "write");

    if (!checkRateLimit(`workflow-duplicate-${tenantContext.tenantSlug}`, 50, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const service = new WorkflowService();
    const duplicated = await service.duplicate(
      asTenantSlug(tenantContext.tenantSlug),
      id as ResourceId
    );

    const auditService = new AuditService();
    await auditService.log(
      asTenantSlug(tenantContext.tenantSlug),
      tenantContext.userId as UserId,
      "create" as AuditAction,
      "workflow",
      duplicated.id as ResourceId,
      { after: duplicated }
    );

    return NextResponse.json({
      success: true,
      data: duplicated,
      message: "Workflow duplicated successfully",
    }, { status: 201 });
  } catch (error) {
    console.error("Workflow duplicate POST error:", error);
    return handleTenantAdminError(error);
  }
}
