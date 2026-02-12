/**
 * API Permission Enforcer
 * 
 * Utilities for enforcing permission checks on API routes
 * Provides consistent pattern for protecting endpoints based on user role/permissions
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentUser,
  getRolePermissionsFromDB,
  validateTenantAccess,
  type SessionUser,
  type PermissionLevel,
} from "./auth-helpers";

/**
 * Permission requirement for an operation
 * "read" - User can view (level must be at least "read")
 * "write" - User can create/edit (level must be at least "write")
 * "admin" - User can perform admin actions (level must be "admin")
 */
type PermissionRequired = "read" | "write" | "admin";

interface PermissionCheckResult {
  allowed: boolean;
  user: SessionUser;
  permissions: Record<string, PermissionLevel>;
  reason?: string;
}

/**
 * Check if user has permission for a module operation
 * 
 * @param user - Current user
 * @param module - Module name (e.g., "crm", "finance")
 * @param required - Required permission level
 * @returns true if user has permission
 */
export function hasPermission(
  user: SessionUser,
  module: string,
  permissions: Record<string, PermissionLevel>,
  required: PermissionRequired
): boolean {
  const userLevel = permissions[module];

  if (!userLevel) {
    return false;
  }

  if (required === "read") {
    // Can read if: read, write, or admin
    return userLevel === "read" || userLevel === "write" || userLevel === "admin";
  }

  if (required === "write") {
    // Can write if: write or admin
    return userLevel === "write" || userLevel === "admin";
  }

  if (required === "admin") {
    // Can admin if: admin only
    return userLevel === "admin";
  }

  return false;
}

/**
 * Enforce permission check on an API route
 * 
 * Usage:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const check = await enforcePermission(request, "crm", "write", "kreatix-default");
 *   if (!check.allowed) {
 *     return check.response; // Returns 403 Forbidden response
 *   }
 *   
 *   // Continue with operation
 *   const user = check.user;
 *   const permissions = check.permissions;
 * }
 * ```
 * 
 * @param request - Next.js request object
 * @param module - Module name (e.g., "crm", "finance")
 * @param required - Required permission level ("read" | "write" | "admin")
 * @param tenantSlug - Tenant slug for validation
 */
export async function enforcePermission(
  request: NextRequest,
  module: string,
  required: PermissionRequired,
  tenantSlug: string
): Promise<PermissionCheckResult & { response?: NextResponse }> {
  // Step 1: Get current user
  const user = getCurrentUser(request);
  if (!user) {
    return {
      allowed: false,
      user: null as unknown as SessionUser,
      permissions: {},
      reason: "Unauthorized",
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  // Step 2: Validate tenant access
  try {
    validateTenantAccess(user, tenantSlug);
  } catch (error) {
    return {
      allowed: false,
      user,
      permissions: {},
      reason: "Tenant mismatch",
      response: NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  // Step 3: Get role permissions
  const permissions = await getRolePermissionsFromDB(user.roleId);

  // Step 4: Check if user has required permission
  const allowed = hasPermission(user, module, permissions, required);

  if (!allowed) {
    const reason = `User role "${user.roleId}" lacks ${required} permission on ${module}`;
    return {
      allowed: false,
      user,
      permissions,
      reason,
      response: NextResponse.json(
        {
          error: "Forbidden",
          message: `Insufficient permissions for ${required} access to ${module}`,
        },
        { status: 403 }
      ),
    };
  }

  return {
    allowed: true,
    user,
    permissions,
  };
}

/**
 * Middleware-style enforcer for routes
 * Throws error if permission denied (use in try-catch)
 * 
 * Usage:
 * ```typescript
 * export async function DELETE(request, { params }) {
 *   const { user, permissions } = await checkPermission(
 *     request, "crm", "admin", params.tenantSlug
 *   );
 *   // Continue - throws if denied
 * }
 * ```
 */
export async function checkPermission(
  request: NextRequest,
  module: string,
  required: PermissionRequired,
  tenantSlug: string
): Promise<{ user: SessionUser; permissions: Record<string, PermissionLevel> }> {
  const check = await enforcePermission(request, module, required, tenantSlug);

  if (!check.allowed) {
    // Throw error that can be caught in route handler
    const error = new Error(check.reason || "Permission denied");
    (error as any).status = 403;
    throw error;
  }

  return {
    user: check.user,
    permissions: check.permissions,
  };
}

/**
 * Get permission level description for logging/debugging
 */
export function getPermissionLabel(level: PermissionLevel): string {
  const labels: Record<PermissionLevel, string> = {
    admin: "Full Access (Admin)",
    write: "Read & Write",
    read: "Read Only",
    none: "No Access",
  };
  return labels[level] || "Unknown";
}
