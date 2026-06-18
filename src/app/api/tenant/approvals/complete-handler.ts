/**
 * API: Approval Flow Management
 * POST   /api/tenant/approvals/flows - Create approval flow
 * GET    /api/tenant/approvals/flows - List approval flows
 * POST   /api/tenant/approvals/requests - Create approval request
 * GET    /api/tenant/approvals/requests - List pending approvals
 * PATCH  /api/tenant/approvals/requests/{id} - Approve/reject request
 */

import { NextRequest, NextResponse } from "next/server";
import { ApprovalFlowService } from "@/lib/tenant-admin/service";
import {
  validateTenantContext,
  parseJsonRequest,
  errorResponse,
  successResponse,
  handleTenantAdminError,
  validateSchema,
  getPaginationParams,
} from "@/lib/tenant-admin/utils";
import {
  CreateApprovalFlowSchema,
  CreateApprovalRequestSchema,
  ApproveRequestSchema,
} from "@/lib/tenant-admin/validation";
import { AuditService } from "@/lib/tenant-admin/service";
import type { TenantSlug, ResourceId, UserId } from "@/lib/tenant-admin/types";

const approvalService = new ApprovalFlowService();
const auditService = new AuditService();

/**
 * GET /api/tenant/approvals/flows
 * List all approval flows for tenant
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");
    const { page, limit, offset } = getPaginationParams(request);

    const flows = await approvalService.getAll(context.tenantSlug as TenantSlug);
    const total = flows.length;

    return successResponse({
      flows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/approvals/flows
 * Create new approval flow
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const parsed = await parseJsonRequest(request, CreateApprovalFlowSchema);

    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    const flowId = await approvalService.createFlow(
      context.tenantSlug as TenantSlug,
      parsed.data.name,
      parsed.data.type,
      parsed.data.steps
    );

    await auditService.log(
      context.tenantSlug as TenantSlug,
      context.userId as UserId,
      "create",
      "approval_flow",
      flowId,
      { name: parsed.data.name, type: parsed.data.type }
    );

    return successResponse({ id: flowId }, 201);
  } catch (error) {
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/approvals/requests
 * Create new approval request
 */
export async function handleApprovalRequestCreate(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const parsed = await parseJsonRequest(request, CreateApprovalRequestSchema);

    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    const approvalRequest = await approvalService.createRequest(
      context.tenantSlug as TenantSlug,
      parsed.data.flowId as ResourceId,
      "", // flowType - should be determined from flowId
      context.userId as UserId,
      parsed.data.subjectId as ResourceId
    );

    await auditService.log(
      context.tenantSlug as TenantSlug,
      context.userId as UserId,
      "create",
      "approval_request",
      approvalRequest.id,
      { flowId: parsed.data.flowId }
    );

    return successResponse(approvalRequest, 201);
  } catch (error) {
    return handleTenantAdminError(error);
  }
}

/**
 * PATCH /api/tenant/approvals/requests/:id
 * Approve or reject approval request
 */
export async function handleApprovalRequestUpdate(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = validateTenantContext(request, "approve");
    const parsed = await parseJsonRequest(request, ApproveRequestSchema);

    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    await approvalService.approveRequest(
      context.tenantSlug as TenantSlug,
      params.id as ResourceId,
      parsed.data.action as any,
      context.userId as UserId,
      parsed.data.comment
    );

    await auditService.log(
      context.tenantSlug as TenantSlug,
      context.userId as UserId,
      "update",
      "approval_request",
      params.id as ResourceId,
      { action: parsed.data.action }
    );

    return successResponse({ message: "Request updated" });
  } catch (error) {
    return handleTenantAdminError(error);
  }
}
