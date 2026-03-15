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
} from "@/lib/tenant-admin/utils";
import { AuditService } from "@/lib/tenant-admin/service";
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

    const service = new WorkflowService(context.tenantSlug);
    const workflows = await service.list({
      ...pagination,
      ...filters,
      sort: sort.sort,
      order: sort.order,
    });

    return NextResponse.json({
      success: true,
      data: workflows,
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

      const service = new WorkflowService(context.tenantSlug);
      const workflow = await service.create({
        ...parsed.data,
        createdBy: context.userId,
      });

      const auditService = new AuditService(context.tenantSlug);
      await auditService.log({
        userId: context.userId,
        action: "create",
        resource: "workflow",
        resourceId: workflow.id,
        changes: { after: workflow },
      });

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

      const service = new WorkflowService(context.tenantSlug);
      const execution = await service.execute(workflowId, {
        ...parsed.data,
        executedBy: context.userId,
        startedAt: new Date().toISOString(),
      });

      const auditService = new AuditService(context.tenantSlug);
      await auditService.log({
        userId: context.userId,
        action: "execute",
        resource: "workflow",
        resourceId: workflowId,
        changes: { after: execution },
      });

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

    const service = new WorkflowService(context.tenantSlug);
    const existing = await service.getById(id);
    const updated = await service.update(id, parsed.data);

    const auditService = new AuditService(context.tenantSlug);
    await auditService.log({
      userId: context.userId,
      action: "update",
      resource: "workflow",
      resourceId: id,
      changes: { before: existing, after: updated },
    });

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

    const service = new WorkflowService(context.tenantSlug);
    const existing = await service.getById(id);
    await service.delete(id);

    const auditService = new AuditService(context.tenantSlug);
    await auditService.log({
      userId: context.userId,
      action: "delete",
      resource: "workflow",
      resourceId: id,
      changes: { before: existing },
    });

    return NextResponse.json({
      success: true,
      message: "Workflow deleted successfully",
    });
  } catch (error) {
    console.error("Workflow DELETE error:", error);
    return handleTenantAdminError(error);
  }
}

function updateFallbackWorkflow(tenantSlug: string, id: string, updates: { steps?: WorkflowStep[] }) {
  const store = getTenantWorkflows(tenantSlug);
  const index = store.findIndex((wf) => wf.id === id);
  if (index === -1) {
    throw new Error("Workflow not found");
  }
  if (updates.steps) {
    store[index] = {
      ...store[index],
      steps: sanitizeSteps(updates.steps),
      updatedAt: new Date().toISOString(),
    };
  }
  return cloneWorkflow(store[index]);
}

function deleteFallbackWorkflow(tenantSlug: string, id: string) {
  const store = getTenantWorkflows(tenantSlug);
  const index = store.findIndex((wf) => wf.id === id);
  if (index === -1) {
    throw new Error("Workflow not found");
  }
  store.splice(index, 1);
}
