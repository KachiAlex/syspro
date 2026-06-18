import { NextRequest, NextResponse } from "next/server";
import { WorkflowService } from "@/lib/tenant-admin/service";
import { AuditService } from "@/lib/tenant-admin/service";
import {
  validateTenantContext,
  parseJsonRequest,
  errorResponse,
  handleTenantAdminError,
  checkRateLimit,
  asTenantSlug,
  asResourceId,
} from "@/lib/tenant-admin/utils";
import { TenantSlug, UserId, ResourceId, AuditAction } from "@/lib/tenant-admin/types";
import { z } from "zod";

const ToggleStatusSchema = z.object({
  status: z.enum(["active", "paused"]),
});

/**
 * PATCH /api/tenant/workflows/{id}/status
 * Toggle workflow status between active and paused
 */
export async function PATCH(request: NextRequest, context: any) {
  try {
    const { params } = context;
    const id = params.id;
    if (!id) {
      return errorResponse("Workflow ID is required", 400);
    }

    const tenantContext = validateTenantContext(request, "write");

    if (!checkRateLimit(`workflow-status-${tenantContext.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const parsed = await parseJsonRequest(request, ToggleStatusSchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    const { status } = parsed.data as { status: "active" | "paused" };

    const service = new WorkflowService();
    const existing = await service.getById(asTenantSlug(tenantContext.tenantSlug), id as ResourceId);
    if (!existing) {
      return errorResponse("Workflow not found", 404);
    }

    const updated = await service.update(asTenantSlug(tenantContext.tenantSlug), id as ResourceId, {
      isActive: status === "active",
      updatedBy: tenantContext.userId as UserId,
    });

    const auditService = new AuditService();
    await auditService.log(
      asTenantSlug(tenantContext.tenantSlug),
      tenantContext.userId as UserId,
      "update" as AuditAction,
      "workflow",
      id as ResourceId,
      { before: existing, after: updated }
    );

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Workflow ${status === "active" ? "activated" : "paused"} successfully`,
    });
  } catch (error) {
    console.error("Workflow status PATCH error:", error);
    return handleTenantAdminError(error);
  }
}
