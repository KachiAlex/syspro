import { NextRequest, NextResponse } from "next/server";
import {
  validateTenantContext,
  parseJsonRequest,
  getPaginationParams,
  getSortParams,
  errorResponse,
  handleTenantAdminError,
  checkRateLimit,
} from "@/lib/tenant-admin/utils";
import { AuditService } from "@/lib/tenant-admin/service";
import { z } from "zod";

const SecurityPolicySchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["mfa", "password", "session", "ip_restriction", "data_encryption"]),
  enforced: z.boolean().optional(),
  settings: z.record(z.any()),
  description: z.string().max(500).optional(),
});

const UpdateSecurityPolicySchema = z.object({
  enforced: z.boolean().optional(),
  settings: z.record(z.any()).optional(),
});

/**
 * GET /api/tenant/security
 * Retrieve security policies and audit logs
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`sec-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const type = new URL(request.url).searchParams.get("type") || "policies";
    const pagination = getPaginationParams(request);
    const sort = getSortParams(request);

    if (type === "policies") {
      // Return security policies
      // This would call a SecurityPolicyService in production
      return NextResponse.json({
        success: true,
        data: {
          policies: [],
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: 0,
          },
        },
      });
    } else if (type === "audit") {
      // Return audit logs
      const auditService = new AuditService(context.tenantSlug);
      const limit = parseInt(new URL(request.url).searchParams.get("limit") || "20");
      const logs = await auditService.getLogs({ limit, offset: (pagination.page - 1) * pagination.limit });

      return NextResponse.json({
        success: true,
        data: logs,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: logs.length,
        },
      });
    } else {
      return errorResponse("Invalid type parameter", 400);
    }
  } catch (error) {
    console.error("Security GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/security
 * Create security policy
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");

    const parsed = await parseJsonRequest(request, SecurityPolicySchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    // This would call a SecurityPolicyService in production
    const policy = {
      id: `sec-${Date.now()}`,
      ...parsed.data,
      tenantSlug: context.tenantSlug,
      createdAt: new Date().toISOString(),
      createdBy: context.userId,
    };

    const auditService = new AuditService(context.tenantSlug);
    await auditService.log({
      userId: context.userId,
      action: "create",
      resource: "security_policy",
      resourceId: policy.id,
      changes: { after: policy },
    });

    return NextResponse.json(
      {
        success: true,
        data: policy,
        message: "Security policy created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Security POST error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * PATCH /api/tenant/security?id=<id>
 * Update security policy
 */
export async function PATCH(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const id = new URL(request.url).searchParams.get("id");

    if (!id) {
      return errorResponse("Security policy ID is required", 400);
    }

    const parsed = await parseJsonRequest(request, UpdateSecurityPolicySchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    // This would call a SecurityPolicyService in production
    const updated = {
      id,
      ...parsed.data,
      tenantSlug: context.tenantSlug,
      updatedAt: new Date().toISOString(),
      updatedBy: context.userId,
    };

    const auditService = new AuditService(context.tenantSlug);
    await auditService.log({
      userId: context.userId,
      action: "update",
      resource: "security_policy",
      resourceId: id,
      changes: { after: updated },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Security policy updated successfully",
    });
  } catch (error) {
    console.error("Security PATCH error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * DELETE /api/tenant/security?id=<id>
 * Delete security policy
 */
export async function DELETE(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "delete");
    const id = new URL(request.url).searchParams.get("id");

    if (!id) {
      return errorResponse("Security policy ID is required", 400);
    }

    const auditService = new AuditService(context.tenantSlug);
    await auditService.log({
      userId: context.userId,
      action: "delete",
      resource: "security_policy",
      resourceId: id,
    });

    return NextResponse.json({
      success: true,
      message: "Security policy deleted successfully",
    });
  } catch (error) {
    console.error("Security DELETE error:", error);
    return handleTenantAdminError(error);
  }
}

