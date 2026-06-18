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

const WorkflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number(),
  triggerType: z.enum(["manual", "automatic", "scheduled"]).optional(),
  actions: z.array(z.object({ type: z.string(), config: z.record(z.any()) })).optional(),
});

const UpdateWorkflowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  steps: z.array(WorkflowStepSchema).optional(),
  isActive: z.boolean().optional(),
});

/**
 * PATCH /api/tenant/workflows/{id}
 * Update a workflow by ID
 */
export async function PATCH(request: NextRequest, context: any) {
  try {
    const { params } = context;
    const id = params.id;
    if (!id) {
      return errorResponse("Workflow ID is required", 400);
    }

    const tenantContext = validateTenantContext(request, "write");

    if (!checkRateLimit(`workflow-update-${tenantContext.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const parsed = await parseJsonRequest(request, UpdateWorkflowSchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    const service = new WorkflowService();
    const existing = await service.getById(asTenantSlug(tenantContext.tenantSlug), id as ResourceId);
    if (!existing) {
      return errorResponse("Workflow not found", 404);
    }

    const updated = await service.update(asTenantSlug(tenantContext.tenantSlug), id as ResourceId, {
      ...parsed.data,
      steps: parsed.data.steps ? parsed.data.steps.map((step: any) => ({
        id: step.id,
        name: step.name,
        type: step.triggerType || "manual",
        action: {
          type: "actions",
          config: step.actions || [],
        },
        conditions: [],
        nextStepId: undefined,
      })) : undefined,
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
      message: "Workflow updated successfully",
    });
  } catch (error) {
    console.error("Workflow PATCH error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * DELETE /api/tenant/workflows/{id}
 * Delete a workflow by ID
 */
export async function DELETE(request: NextRequest, context: any) {
  try {
    const { params } = context;
    const id = params.id;
    if (!id) {
      return errorResponse("Workflow ID is required", 400);
    }

    const tenantContext = validateTenantContext(request, "delete");

    if (!checkRateLimit(`workflow-delete-${tenantContext.tenantSlug}`, 50, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const service = new WorkflowService();
    const existing = await service.getById(asTenantSlug(tenantContext.tenantSlug), id as ResourceId);
    if (!existing) {
      return errorResponse("Workflow not found", 404);
    }

    await service.delete(asTenantSlug(tenantContext.tenantSlug), id as ResourceId);

    const auditService = new AuditService();
    await auditService.log(
      asTenantSlug(tenantContext.tenantSlug),
      tenantContext.userId as UserId,
      "delete" as AuditAction,
      "workflow",
      id as ResourceId,
      { before: existing }
    );

    return NextResponse.json({
      success: true,
      message: "Workflow deleted successfully",
    });
  } catch (error) {
    console.error("Workflow DELETE error:", error);
    return handleTenantAdminError(error);
  }
}
