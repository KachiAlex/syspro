import { NextRequest, NextResponse } from "next/server";
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
import { AuditAction, UserId, ResourceId } from "@/lib/tenant-admin/types";
import { z } from "zod";

const CreateReportSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["departments", "employees", "roles", "workflows", "approvals", "security", "billing", "custom"]),
  filters: z.record(z.any()).optional(),
  metrics: z.array(z.string()).optional(),
  schedule: z.enum(["once", "daily", "weekly", "monthly"]).optional(),
});

const ExportReportSchema = z.object({
  reportId: z.string(),
  format: z.enum(["csv", "json", "pdf", "xlsx"]),
  scheduleFor: z.string().datetime().optional(),
});

/**
 * GET /api/tenant/analytics
 * Retrieve analytics reports and metrics
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`analytics-get-${context.tenantSlug}`, 50, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const type = new URL(request.url).searchParams.get("type") || "overview";
    const pagination = getPaginationParams(request);
    const sort = getSortParams(request);

    if (type === "reports") {
      return NextResponse.json({
        success: true,
        data: {
          reports: [],
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: 0,
          },
        },
      });
    } else if (type === "metrics") {
      return NextResponse.json({
        success: true,
        data: {
          departments: {
            total: 0,
            active: 0,
            avgEmployeesPerDept: 0,
          },
          employees: {
            total: 0,
            active: 0,
            byStatus: {},
            avgTenure: 0,
            turnover: 0,
          },
          approvals: {
            pending: 0,
            approved: 0,
            rejected: 0,
            avgTimeToApprove: 0,
          },
          workflows: {
            total: 0,
            active: 0,
            executed: 0,
          },
        },
      });
    } else if (type === "security") {
      return NextResponse.json({
        success: true,
        data: {
          auditLogsCount: 0,
          activePolicies: 0,
          suspiciousActivities: 0,
          lastPolicyUpdate: null,
        },
      });
    } else if (type === "overview") {
      return NextResponse.json({
        success: true,
        data: {
          summary: {
            totalPages: 0,
            lastUpdated: new Date().toISOString(),
          },
          charts: [],
        },
      });
    } else {
      return errorResponse("Invalid type parameter", 400);
    }
  } catch (error) {
    console.error("Analytics GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/analytics
 * Create or generate reports
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const action = new URL(request.url).searchParams.get("action") || "create";

    if (action === "create") {
      const parsed = await parseJsonRequest(request, CreateReportSchema);
      if (!parsed.success) {
        return errorResponse(parsed.error, 400, parsed.details);
      }

      const report = {
        id: `rep-${Date.now()}`,
        ...parsed.data,
        tenantSlug: context.tenantSlug,
        status: "generating",
        createdAt: new Date().toISOString(),
        createdBy: context.userId,
      };

      const auditService = new AuditService();
      await auditService.log(
        asTenantSlug(context.tenantSlug),
        context.userId as UserId,
        "create",
        "report",
        report.id as ResourceId,
        { after: report }
      );

      return NextResponse.json(
        {
          success: true,
          data: report,
          message: "Report generation started",
        },
        { status: 201 }
      );
    } else if (action === "export") {
      const parsed = await parseJsonRequest(request, ExportReportSchema);
      if (!parsed.success) {
        return errorResponse(parsed.error, 400, parsed.details);
      }

      const exportJob = {
        id: `exp-${Date.now()}`,
        ...parsed.data,
        tenantSlug: context.tenantSlug,
        status: "queued",
        createdAt: new Date().toISOString(),
        createdBy: context.userId,
      };

      const auditService = new AuditService();
      await auditService.log(
        asTenantSlug(context.tenantSlug),
        context.userId as UserId,
        "create",
        "export",
        exportJob.id as ResourceId,
        { after: exportJob }
      );

      return NextResponse.json(
        {
          success: true,
          data: exportJob,
          message: "Export job queued",
        },
        { status: 201 }
      );
    } else {
      return errorResponse("Invalid action", 400);
    }
  } catch (error) {
    console.error("Analytics POST error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * PATCH /api/tenant/analytics?id=<id>
 * Update or re-run report
 */
export async function PATCH(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const id = new URL(request.url).searchParams.get("id");
    const action = new URL(request.url).searchParams.get("action") || "update";

    if (!id) {
      return errorResponse("Report ID is required", 400);
    }

    const body = await request.json().catch(() => ({}));

    const updated = {
      id,
      ...body,
      tenantSlug: context.tenantSlug,
      updatedAt: new Date().toISOString(),
      updatedBy: context.userId,
    };

    const auditService = new AuditService();
    await auditService.log(
      asTenantSlug(context.tenantSlug),
      context.userId as UserId,
      action === "rerun" ? "execute" as AuditAction : "update",
      "report",
      id as ResourceId,
      { after: updated }
    );

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Report updated successfully",
    });
  } catch (error) {
    console.error("Analytics PATCH error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * DELETE /api/tenant/analytics?id=<id>
 * Delete report or export
 */
export async function DELETE(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "delete");
    const id = new URL(request.url).searchParams.get("id");

    if (!id) {
      return errorResponse("ID is required", 400);
    }

    const auditService = new AuditService();
    await auditService.log(
      asTenantSlug(context.tenantSlug),
      context.userId as UserId,
      "delete",
      "report",
      id as ResourceId
    );

    return NextResponse.json({
      success: true,
      message: "Report deleted successfully",
    });
  } catch (error) {
    console.error("Analytics DELETE error:", error);
    return handleTenantAdminError(error);
  }
}
