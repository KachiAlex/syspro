import { NextRequest, NextResponse } from "next/server";
import { WorkflowService } from "@/lib/tenant-admin/service";
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
} from "@/lib/tenant-admin/utils";
import { AuditService } from "@/lib/tenant-admin/service";
import { TenantSlug, UserId, ResourceId, AuditAction, WorkflowStep } from "@/lib/tenant-admin/types";
import { z } from "zod";

const WorkflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number(),
  triggerType: z.enum(["manual", "automatic", "scheduled"]).optional(),
  actions: z.array(z.object({ type: z.string(), config: z.record(z.any()) })).optional(),
});

const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(["onboarding", "transfer", "promotion", "exit", "approval", "custom"]),
  steps: z.array(WorkflowStepSchema).min(1),
  isActive: z.boolean().optional(),
  autoTrigger: z.boolean().optional(),
});

const UpdateWorkflowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  steps: z.array(WorkflowStepSchema).optional(),
  isActive: z.boolean().optional(),
});

const ExecuteWorkflowSchema = z.object({
  resourceType: z.string(),
  resourceId: z.string(),
  variables: z.record(z.any()).optional(),
});

/**
 * GET /api/tenant/workflows
 * Retrieve workflows for a tenant
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`workflow-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const pagination = getPaginationParams(request);
    const filters = getFilterParams(request);
    const sort = getSortParams(request);

    const service = new WorkflowService();
    const workflows = await service.list(asTenantSlug(context.tenantSlug), {
      page: pagination.page,
      limit: pagination.limit,
      sort: sort.sort,
      order: sort.order,
      filters,
    });

    return NextResponse.json({
      success: true,
      workflows,
      total: workflows.length,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: workflows.length,
      },
    });
  } catch (error) {
    console.error("Workflow GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/workflows
 * Create a workflow or execute workflow
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const action = new URL(request.url).searchParams.get("action") || "create";

    if (action === "create") {
      const parsed = await parseJsonRequest(request, CreateWorkflowSchema);
      if (!parsed.success) {
        return errorResponse(parsed.error, 400, parsed.details);
      }

      const service = new WorkflowService();
      const workflow = await service.create(asTenantSlug(context.tenantSlug), {
        ...parsed.data,
        steps: parsed.data.steps.map((step: any) => ({
          id: step.id,
          name: step.name,
          type: step.triggerType || 'manual',
          action: {
            type: 'actions',
            config: step.actions || []
          },
          conditions: [],
          nextStepId: undefined,
        })),
        createdBy: context.userId as UserId,
      });

      const auditService = new AuditService();
      await auditService.log(
        asTenantSlug(context.tenantSlug),
        context.userId as UserId,
        "create" as AuditAction,
        "workflow",
        workflow.id as ResourceId,
        { after: workflow }
      );

      return NextResponse.json(
        {
          success: true,
          data: workflow,
          message: "Workflow created successfully",
        },
        { status: 201 }
      );
    } else if (action === "execute") {
      const parsed = await parseJsonRequest(request, ExecuteWorkflowSchema);
      if (!parsed.success) {
        return errorResponse(parsed.error, 400, parsed.details);
      }

      const workflowId = new URL(request.url).searchParams.get("id");
      if (!workflowId) {
        return errorResponse("Workflow ID is required for execution", 400);
      }

      const service = new WorkflowService();
      const execution = await service.executeWorkflow(asTenantSlug(context.tenantSlug), workflowId as ResourceId, context.userId as UserId);

      const auditService = new AuditService();
      await auditService.log(
        asTenantSlug(context.tenantSlug),
        context.userId as UserId,
        "execute" as AuditAction,
        "workflow",
        workflowId as ResourceId,
        { after: execution }
      );

      return NextResponse.json(
        {
          success: true,
          data: execution,
          message: "Workflow execution started",
        },
        { status: 201 }
      );
    } else {
      return errorResponse("Invalid action", 400);
    }
  } catch (error) {
    console.error("Workflow POST error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * PATCH /api/tenant/workflows?id=<id>
 * Update a workflow
 */
export async function PATCH(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const id = new URL(request.url).searchParams.get("id");

    if (!id) {
      return errorResponse("Workflow ID is required", 400);
    }

    const parsed = await parseJsonRequest(request, UpdateWorkflowSchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    const service = new WorkflowService();
    const existing = await service.getById(asTenantSlug(context.tenantSlug), id as ResourceId);
    const updated = await service.update(asTenantSlug(context.tenantSlug), id as ResourceId, {
      ...parsed.data,
      steps: parsed.data.steps ? parsed.data.steps.map((step: any) => ({
        id: step.id,
        name: step.name,
        type: step.triggerType || 'manual',
        action: {
          type: 'actions',
          config: step.actions || []
        },
        conditions: [],
        nextStepId: undefined,
      })) : undefined,
      updatedBy: context.userId as UserId,
    });

    const auditService = new AuditService();
    await auditService.log(
      asTenantSlug(context.tenantSlug),
      context.userId as UserId,
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
 * DELETE /api/tenant/workflows?id=<id>
 * Delete a workflow
 */
export async function DELETE(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "delete");
    const id = new URL(request.url).searchParams.get("id");

    if (!id) {
      return errorResponse("Workflow ID is required", 400);
    }

    const service = new WorkflowService();
    const existing = await service.getById(asTenantSlug(context.tenantSlug), id as ResourceId);
    await service.delete(asTenantSlug(context.tenantSlug), id as ResourceId);

    const auditService = new AuditService();
    await auditService.log(
      asTenantSlug(context.tenantSlug),
      context.userId as UserId,
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
