import { NextRequest, NextResponse } from "next/server";
import { ApprovalFlowService } from "@/lib/tenant-admin/service";
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
import { TenantSlug, UserId, ResourceId, AuditAction } from "@/lib/tenant-admin/types";
import { z } from "zod";

// Schemas for approval operations
const CreateApprovalFlowSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  steps: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        approverRole: z.string().optional(),
        approverUsers: z.array(z.string()).optional(),
        order: z.number(),
      })
    )
    .min(1),
  autoApproveThreshold: z.number().optional(),
});

const UpdateApprovalFlowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  steps: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        approverRole: z.string().optional(),
        approverUsers: z.array(z.string()).optional(),
        order: z.number(),
      })
    )
    .optional(),
});

const CreateApprovalRequestSchema = z.object({
  flowId: z.string(),
  resourceType: z.string(),
  resourceId: z.string(),
  requestedBy: z.string(),
  description: z.string().max(500).optional(),
});

const UpdateApprovalRequestSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
  comments: z.string().max(500).optional(),
});

/**
 * GET /api/tenant/approvals
 * Retrieve all approval flows for a tenant
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`approval-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const pagination = getPaginationParams(request);
    const filters = getFilterParams(request);
    const sort = getSortParams(request);

    // TODO: ApprovalFlowService needs getAll method
    const service = new ApprovalFlowService();
    // const flows = await service.getAll(context.tenantSlug);
    const flows: any[] = []; // Placeholder

    return NextResponse.json({
      success: true,
      data: flows,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: flows.length,
      },
    });
  } catch (error) {
    console.error("Approval GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/approvals
 * Create a new approval flow or approval request
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const type = new URL(request.url).searchParams.get("type") || "flow";

    if (type === "flow") {
      // Create approval flow
      const parsed = await parseJsonRequest(request, CreateApprovalFlowSchema);
      if (!parsed.success) {
        return errorResponse(parsed.error, 400, parsed.details);
      }

      const service = new ApprovalFlowService();
      // TODO: Create flow and return it with proper response
      const flowId = await service.createFlow(
        asTenantSlug(context.tenantSlug),
        parsed.data.name,
        'custom',
        parsed.data.steps || []
      );

      const auditService = new AuditService();
      await auditService.log(
        asTenantSlug(context.tenantSlug),
        context.userId as UserId,
        "create" as AuditAction,
        "approval_flow",
        flowId,
        { after: { id: flowId } }
      );

      return NextResponse.json(
        {
          success: true,
          data: { id: flowId },
          message: "Approval flow created successfully",
        },
        { status: 201 }
      );
    } else if (type === "request") {
      // Create approval request
      const parsed = await parseJsonRequest(request, CreateApprovalRequestSchema);
      if (!parsed.success) {
        return errorResponse(parsed.error, 400, parsed.details);
      }

      const service = new ApprovalFlowService();
      const request_obj = await service.createRequest(
        asTenantSlug(context.tenantSlug),
        parsed.data.flowId as ResourceId,
        parsed.data.resourceType,
        context.userId as UserId,
        parsed.data.resourceId as ResourceId
      );

      const auditService = new AuditService();
      await auditService.log(
        asTenantSlug(context.tenantSlug),
        context.userId as UserId,
        "create" as AuditAction,
        "approval_request",
        request_obj.id,
        { after: request_obj }
      );

      return NextResponse.json(
        {
          success: true,
          data: request_obj,
          message: "Approval request created successfully",
        },
        { status: 201 }
      );
    } else {
      return errorResponse("Invalid type parameter", 400);
    }
  } catch (error) {
    console.error("Approval POST error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * PATCH /api/tenant/approvals?id=<id>
 * Update an approval flow or request
 */
export async function PATCH(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const id = new URL(request.url).searchParams.get("id");
    const type = new URL(request.url).searchParams.get("type") || "flow";

    if (!id) {
      return errorResponse("ID is required", 400);
    }

    if (type === "flow") {
      const parsed = await parseJsonRequest(request, UpdateApprovalFlowSchema);
      if (!parsed.success) {
        return errorResponse(parsed.error, 400, parsed.details);
      }

      const service = new ApprovalFlowService();
      // TODO: Implement getFlow and updateFlow methods
      // const existing = await service.getFlow(context.tenantSlug, id);
      // const updated = await service.updateFlow(context.tenantSlug, id, parsed.data);

      return errorResponse("Flow update not yet implemented", 501);
    } else if (type === "request") {
      const parsed = await parseJsonRequest(request, UpdateApprovalRequestSchema);
      if (!parsed.success) {
        return errorResponse(parsed.error, 400, parsed.details);
      }

      const service = new ApprovalFlowService();
      
      const approvalAction = parsed.data.status === 'approved' ? 'approve' : 
                            parsed.data.status === 'rejected' ? 'reject' : 'cancel';
      
      await service.approveRequest(
        asTenantSlug(context.tenantSlug),
        id as ResourceId,
        approvalAction as any,
        context.userId as UserId,
        parsed.data.comments
      );

      const auditService = new AuditService();
      await auditService.log(
        asTenantSlug(context.tenantSlug),
        context.userId as UserId,
        "update" as AuditAction,
        "approval_request",
        id as ResourceId,
        { status: parsed.data.status }
      );

      return NextResponse.json({
        success: true,
        message: `Approval request ${parsed.data.status}`,
      });
    } else {
      return errorResponse("Invalid type parameter", 400);
    }
  } catch (error) {
    console.error("Approval PATCH error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * DELETE /api/tenant/approvals?id=<id>
 * Delete an approval flow or request
 */
export async function DELETE(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "delete");
    const id = new URL(request.url).searchParams.get("id");
    const type = new URL(request.url).searchParams.get("type") || "flow";

    if (!id) {
      return errorResponse("ID is required", 400);
    }

    const service = new ApprovalFlowService();

    if (type === "flow") {
      const existing = await service.getById(asTenantSlug(context.tenantSlug), id as ResourceId);
      await service.delete(asTenantSlug(context.tenantSlug), id as ResourceId);

      const auditService = new AuditService();
      await auditService.log(
        asTenantSlug(context.tenantSlug),
        context.userId as UserId,
        "delete" as AuditAction,
        "approval_flow",
        id as ResourceId,
        { before: existing }
      );
    } else if (type === "request") {
      const existing = await service.getRequestById(asTenantSlug(context.tenantSlug), id as ResourceId);
      await service.deleteRequest(asTenantSlug(context.tenantSlug), id as ResourceId);

      const auditService = new AuditService();
      await auditService.log(
        asTenantSlug(context.tenantSlug),
        context.userId as UserId,
        "delete" as AuditAction,
        "approval_request",
        id as ResourceId,
        { before: existing }
      );
    } else {
      return errorResponse("Invalid type parameter", 400);
    }

    return NextResponse.json({
      success: true,
      message: "Deleted successfully",
    });
  } catch (error) {
    console.error("Approval DELETE error:", error);
    return handleTenantAdminError(error);
  }
}
