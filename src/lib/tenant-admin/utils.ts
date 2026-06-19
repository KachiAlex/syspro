/**
 * Tenant Admin Utilities
 * Helper functions and utilities for tenant-admin operations
 */

import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requirePermission } from "@/lib/auth-helper";
import { validateSchema } from "./validation";
import type { TenantSlug, ResourceId, UserId } from "./types";

// Re-export for convenience
export { validateSchema };

/**
 * Type helpers for branded types
 */
export function asTenantSlug(str: string): TenantSlug {
  return str as TenantSlug;
}

export function asResourceId(str: string): ResourceId {
  return str as ResourceId;
}

export function asUserId(str: string): UserId {
  return str as UserId;
}
import type { z } from "zod";
import type { AuditAction } from "./types";

/**
 * API Response Helpers
 */
export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status = 400, details?: any) {
  return NextResponse.json(
    {
      error: message,
      ...(details && { details }),
    },
    { status }
  );
}

/**
 * Request Parsing & Validation
 */
export async function parseJsonRequest<T>(
  request: NextRequest,
  schema?: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: string; details?: any }> {
  try {
    const body = await request.json();

    if (schema) {
      const validation = validateSchema(schema, body);
      if (!validation.success) {
        return {
          success: false,
          error: "Validation failed",
          details: validation.error.flatten(),
        };
      }
      return { success: true, data: validation.data };
    }

    return { success: true, data: body as T };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Invalid JSON",
    };
  }
}

/**
 * Tenant Context Extraction
 */
export interface TenantRequestContext {
  tenantSlug: string;
  userId: string;
  userRole: string;
  userPermissions: string[];
  managedDepartmentId?: string;
}

export function extractTenantContext(request: NextRequest): TenantRequestContext {
  const auth = extractAuthContext(request);
  return {
    tenantSlug: auth.tenantSlug,
    userId: auth.userId || 'unknown',
    userRole: auth.userRole || 'user',
    userPermissions: auth.userPermissions || [],
  };
}

export function validateTenantContext(request: NextRequest, requiredPermission?: string): TenantRequestContext {
  const context = extractTenantContext(request);

  if (!context.tenantSlug) {
    throw new Error("Missing tenant context");
  }

  if (requiredPermission) {
    requirePermission(context.userRole, requiredPermission as any);
  }

  return context;
}

export async function resolveDepartmentHeadContext(context: TenantRequestContext): Promise<TenantRequestContext> {
  if (context.userId && context.userId !== 'unknown' && context.tenantSlug) {
    try {
      const { db } = await import('@/lib/sql-client');
      const rows = await db.sql<any>`
        select id from admin_departments
        where tenant_slug = ${context.tenantSlug} and manager_id = ${context.userId}
        limit 1
      `;
      if (Array.isArray(rows) && rows.length > 0) {
        context.managedDepartmentId = rows[0].id;
      }
    } catch {
      // ignore — no managed department
    }
  }
  return context;
}

/**
 * Query Parameter Parsing
 */
export function getPaginationParams(request: NextRequest) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

export function getFilterParams(request: NextRequest) {
  const url = new URL(request.url);
  const filters: Record<string, string> = {};

  for (const [key, value] of url.searchParams.entries()) {
    if (!["page", "limit", "sort", "order"].includes(key)) {
      filters[key] = value;
    }
  }

  return filters;
}

export function getSortParams(request: NextRequest) {
  const url = new URL(request.url);
  const sort = url.searchParams.get("sort") || "created_at";
  const order = (url.searchParams.get("order") || "desc") as "asc" | "desc";

  return { sort, order };
}

/**
 * Audit Trail Helpers
 */
export function buildAuditTrail(
  action: AuditAction,
  resource: string,
  before?: any,
  after?: any
) {
  return {
    action,
    resource,
    changes: before && after ? { before, after } : undefined,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Permission Helpers
 */
export const MODULE_PERMISSIONS = {
  department: ["read", "write", "delete"],
  role: ["read", "write", "delete"],
  employee: ["read", "write", "delete"],
  approval: ["read", "write", "approve"],
  workflow: ["read", "write", "execute"],
  module: ["read", "admin"],
  security: ["read", "write", "admin"],
  billing: ["read", "write", "admin"],
  integration: ["read", "write", "admin"],
} as const;

export function canPerformAction(
  userPermissions: string[],
  module: keyof typeof MODULE_PERMISSIONS,
  action: string
): boolean {
  return userPermissions.some((perm) =>
    perm === `${module}:${action}` || perm === `${module}:admin`
  );
}

/**
 * Error Handling
 */
export class TenantAdminError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "TenantAdminError";
  }
}

export function handleTenantAdminError(error: unknown): NextResponse {
  if (error instanceof TenantAdminError) {
    return errorResponse(error.message, error.statusCode);
  }

  if (error instanceof Error) {
    console.error("Unhandled error:", error);
    return errorResponse(error.message, 500);
  }

  console.error("Unknown error:", error);
  return errorResponse("An unexpected error occurred", 500);
}

/**
 * Rate Limiting
 */
class RateLimitStore {
  private limits: Map<string, { count: number; resetAt: number }> = new Map();

  check(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const current = this.limits.get(key);

    if (!current || now > current.resetAt) {
      this.limits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (current.count < maxRequests) {
      current.count++;
      return true;
    }

    return false;
  }
}

export const rateLimitStore = new RateLimitStore();

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): boolean {
  return rateLimitStore.check(identifier, maxRequests, windowMs);
}

/**
 * Data Transformation
 */
export function formatResponse<T>(data: T) {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

export function formatPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
) {
  return {
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Input Sanitization
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  return input
    .substring(0, maxLength)
    .trim()
    .replace(/[<>]/g, ""); // Basic XSS prevention
}

export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = { ...obj };

  for (const key in sanitized) {
    if (typeof sanitized[key] === "string") {
      (sanitized as any)[key] = sanitizeString(sanitized[key]);
    }
  }

  return sanitized;
}
