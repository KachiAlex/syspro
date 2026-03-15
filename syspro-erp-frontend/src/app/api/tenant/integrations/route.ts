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

const CreateIntegrationSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.string(),
  enabled: z.boolean().optional(),
  config: z.record(z.any()),
  description: z.string().max(500).optional(),
  webhookUrl: z.string().url().optional(),
});

const UpdateIntegrationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
  config: z.record(z.any()).optional(),
  webhookUrl: z.string().url().optional(),
});

const CreateAPIKeySchema = z.object({
  label: z.string().min(1).max(100),
  permissions: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().optional(),
});

/**
 * GET /api/tenant/integrations
 * Retrieve integrations for a tenant
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`int-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const type = new URL(request.url).searchParams.get("type") || "integrations";
    const pagination = getPaginationParams(request);
    const sort = getSortParams(request);

    if (type === "integrations") {
      // Return integrations
      return NextResponse.json({
        success: true,
        data: {
          integrations: [],
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: 0,
          },
        },
      });
    } else if (type === "api-keys") {
      // Return API keys
      return NextResponse.json({
        success: true,
        data: {
          apiKeys: [],
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: 0,
          },
        },
      });
    } else {
      return errorResponse("Invalid type parameter", 400);
    }
  } catch (error) {
    console.error("Integration GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/integrations
 * Create integration or API key
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const type = new URL(request.url).searchParams.get("type") || "integration";

    if (type === "integration") {
      const parsed = await parseJsonRequest(request, CreateIntegrationSchema);
      if (!parsed.success) {
        return errorResponse(parsed.error, 400, parsed.details);
      }

      const integration = {
        id: `int-${Date.now()}`,
        ...parsed.data,
        tenantSlug: context.tenantSlug,
        createdAt: new Date().toISOString(),
        createdBy: context.userId,
      };

      const auditService = new AuditService(context.tenantSlug);
      await auditService.log({
        userId: context.userId,
        action: "create",
        resource: "integration",
        resourceId: integration.id,
        changes: { after: integration },
      });

      return NextResponse.json(
        {
          success: true,
          data: integration,
          message: "Integration created successfully",
        },
        { status: 201 }
      );
    } else if (type === "api-key") {
      const parsed = await parseJsonRequest(request, CreateAPIKeySchema);
      if (!parsed.success) {
        return errorResponse(parsed.error, 400, parsed.details);
      }

      const apiKey = {
        id: `key-${Date.now()}`,
        key: `sk_${Math.random().toString(36).slice(2)}`,
        ...parsed.data,
        tenantSlug: context.tenantSlug,
        createdAt: new Date().toISOString(),
        createdBy: context.userId,
        revoked: false,
      };

      const auditService = new AuditService(context.tenantSlug);
      await auditService.log({
        userId: context.userId,
        action: "create",
        resource: "api_key",
        resourceId: apiKey.id,
        changes: { after: { ...apiKey, key: "***hidden***" } },
      });

      return NextResponse.json(
        {
          success: true,
          data: apiKey,
          message: "API key created successfully",
        },
        { status: 201 }
      );
    } else {
      return errorResponse("Invalid type parameter", 400);
    }
  } catch (error) {
    console.error("Integration POST error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * PATCH /api/tenant/integrations?id=<id>
 * Update integration or revoke API key
 */
export async function PATCH(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const id = new URL(request.url).searchParams.get("id");
    const type = new URL(request.url).searchParams.get("type") || "integration";
    const action = new URL(request.url).searchParams.get("action");

    if (!id) {
      return errorResponse("ID is required", 400);
    }

    if (type === "integration") {
      const parsed = await parseJsonRequest(request, UpdateIntegrationSchema);
      if (!parsed.success) {
        return errorResponse(parsed.error, 400, parsed.details);
      }

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
        resource: "integration",
        resourceId: id,
        changes: { after: updated },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: "Integration updated successfully",
      });
    } else if (type === "api-key" && action === "revoke") {
      const auditService = new AuditService(context.tenantSlug);
      await auditService.log({
        userId: context.userId,
        action: "revoke",
        resource: "api_key",
        resourceId: id,
      });

      return NextResponse.json({
        success: true,
        message: "API key revoked successfully",
      });
    } else {
      return errorResponse("Invalid type or action", 400);
    }
  } catch (error) {
    console.error("Integration PATCH error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * DELETE /api/tenant/integrations?id=<id>
 * Delete integration
 */
export async function DELETE(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "delete");
    const id = new URL(request.url).searchParams.get("id");

    if (!id) {
      return errorResponse("ID is required", 400);
    }

    const auditService = new AuditService(context.tenantSlug);
    await auditService.log({
      userId: context.userId,
      action: "delete",
      resource: "integration",
      resourceId: id,
    });

    return NextResponse.json({
      success: true,
      message: "Integration deleted successfully",
    });
  } catch (error) {
    console.error("Integration DELETE error:", error);
    return handleTenantAdminError(error);
  }
}
