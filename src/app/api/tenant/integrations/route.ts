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
import { AuditService, IntegrationService, APIKeyService } from "@/lib/tenant-admin/service";
import { asTenantSlug } from "@/lib/tenant-admin/utils";
import type { UserId, ResourceId, AuditAction, Permission } from "@/lib/tenant-admin/types";
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
      const service = new IntegrationService();
      const integrations = await service.getAll(asTenantSlug(context.tenantSlug));
      return NextResponse.json({
        success: true,
        data: {
          integrations,
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: integrations.length,
          },
        },
      });
    } else if (type === "api-keys") {
      const service = new APIKeyService();
      const apiKeys = await service.getAll(asTenantSlug(context.tenantSlug));
      return NextResponse.json({
        success: true,
        data: {
          apiKeys,
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: apiKeys.length,
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

      const service = new IntegrationService();
      const integration = await service.create(asTenantSlug(context.tenantSlug), {
        name: parsed.data.name,
        type: parsed.data.type as any,
        status: parsed.data.enabled ? "active" : "inactive",
        config: parsed.data.config,
        webhookUrl: parsed.data.webhookUrl,
      }, context.userId as UserId);

      const auditService = new AuditService();
      await auditService.log(
        asTenantSlug(context.tenantSlug),
        context.userId as UserId,
        "create" as AuditAction,
        "integration",
        integration.id as ResourceId,
        { after: integration }
      );

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

      const service = new APIKeyService();
      const apiKey = await service.create(asTenantSlug(context.tenantSlug), {
        name: parsed.data.label,
        permissions: (parsed.data.permissions || []).map((p: string) => ({ id: p, module: "all", action: p as any, description: "" })),
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
      }, context.userId as UserId);

      const auditService = new AuditService();
      await auditService.log(
        asTenantSlug(context.tenantSlug),
        context.userId as UserId,
        "create" as AuditAction,
        "api_key",
        apiKey.id as ResourceId,
        { after: apiKey }
      );

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

      const service = new IntegrationService();
      const existing = await service.getById(asTenantSlug(context.tenantSlug), id as ResourceId);
      if (!existing) {
        return errorResponse("Integration not found", 404);
      }

      const updated = await service.update(asTenantSlug(context.tenantSlug), id as ResourceId, {
        name: parsed.data.name,
        status: parsed.data.enabled ? "active" : "inactive",
        config: parsed.data.config,
        webhookUrl: parsed.data.webhookUrl,
      });

      const auditService = new AuditService();
      await auditService.log(
        asTenantSlug(context.tenantSlug),
        context.userId as UserId,
        "update" as AuditAction,
        "integration",
        id as ResourceId,
        { before: existing, after: updated }
      );

      return NextResponse.json({
        success: true,
        data: updated,
        message: "Integration updated successfully",
      });
    } else if (type === "api-key" && action === "revoke") {
      const service = new APIKeyService();
      const existing = await service.getById(asTenantSlug(context.tenantSlug), id as ResourceId);
      if (!existing) {
        return errorResponse("API key not found", 404);
      }

      await service.revoke(asTenantSlug(context.tenantSlug), id as ResourceId);

      const auditService = new AuditService();
      await auditService.log(
        asTenantSlug(context.tenantSlug),
        context.userId as UserId,
        "delete" as AuditAction,
        "api_key",
        id as ResourceId,
        { before: existing }
      );

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

    const type = new URL(request.url).searchParams.get("type") || "integration";
    const auditService = new AuditService();

    if (type === "integration") {
      const service = new IntegrationService();
      const existing = await service.getById(asTenantSlug(context.tenantSlug), id as ResourceId);
      if (existing) {
        await service.delete(asTenantSlug(context.tenantSlug), id as ResourceId);
        await auditService.log(
          asTenantSlug(context.tenantSlug),
          context.userId as UserId,
          "delete" as AuditAction,
          "integration",
          id as ResourceId,
          { before: existing }
        );
      }
    } else if (type === "api-key") {
      const service = new APIKeyService();
      const existing = await service.getById(asTenantSlug(context.tenantSlug), id as ResourceId);
      if (existing) {
        await service.revoke(asTenantSlug(context.tenantSlug), id as ResourceId);
        await auditService.log(
          asTenantSlug(context.tenantSlug),
          context.userId as UserId,
          "delete" as AuditAction,
          "api_key",
          id as ResourceId,
          { before: existing }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Integration deleted successfully",
    });
  } catch (error) {
    console.error("Integration DELETE error:", error);
    return handleTenantAdminError(error);
  }
}
