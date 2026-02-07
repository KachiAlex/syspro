/**
 * API permission enforcement utilities
 * Ensures users can only access resources they have permission for
 */

import type { UserPermissions } from "@/lib/permissions";
import { canRead, canWrite, canAdmin } from "@/lib/permissions";

/**
 * Check if user has permission for an API operation
 */
export function hasApiPermission(
  permissions: UserPermissions | null,
  module: string,
  action: "read" | "write" | "admin" = "read"
): boolean {
  if (!permissions) return false;

  switch (action) {
    case "read":
      return canRead(permissions, module);
    case "write":
      return canWrite(permissions, module);
    case "admin":
      return canAdmin(permissions, module);
    default:
      return false;
  }
}

/**
 * Wrapper for fetch that adds permission checking
 */
export async function fetchWithPermissions(
  permissions: UserPermissions | null,
  module: string,
  action: "read" | "write" | "admin",
  url: string,
  init?: RequestInit
): Promise<Response> {
  // Check permissions before making the request
  if (!hasApiPermission(permissions, module, action)) {
    // Return a 403 Forbidden response
    return new Response(
      JSON.stringify({
        error: "Permission denied",
        message: `You don't have ${action} permission for the ${module} module`,
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // Make the actual request
  return fetch(url, init);
}

/**
 * Check if user owes permission for data based on resource ownership/scope
 */
export function canAccessResource(
  permissions: UserPermissions | null,
  resource: {
    ownerId?: string;
    tenantSlug?: string;
    branchId?: string;
    regionId?: string;
  },
  currentUserId: string | null
): boolean {
  if (!permissions) return false;

  // Check if resource belongs to user's tenant
  if (resource.tenantSlug && resource.tenantSlug !== permissions.tenantSlug) {
    return false;
  }

  // Check scope-based access
  if (permissions.scope === "branch" && resource.branchId) {
    // User can only access resources in their branch
    // This would need to be extended based on your actual branch assignment
    return true; // Simplified for now
  }

  if (permissions.scope === "region" && resource.regionId) {
    // User can only access resources in their region
    return true; // Simplified for now
  }

  // Check ownership if required
  if (resource.ownerId && resource.ownerId !== currentUserId) {
    // User can only access their own resources unless they're an admin
    return canAdmin(permissions, "admin");
  }

  return true;
}

/**
 * Create API request with permission checks (for use in API routes)
 */
export function createPermissionEnsurer(permissions: UserPermissions | null) {
  return {
    ensureRead: (module: string) => {
      if (!canRead(permissions, module)) {
        throw new Error(`Permission denied: cannot read ${module}`);
      }
    },

    ensureWrite: (module: string) => {
      if (!canWrite(permissions, module)) {
        throw new Error(`Permission denied: cannot write to ${module}`);
      }
    },

    ensureAdmin: (module: string) => {
      if (!canAdmin(permissions, module)) {
        throw new Error(`Permission denied: admin access required for ${module}`);
      }
    },

    canAccess: (module: string, action: "read" | "write" | "admin" = "read") => {
      return hasApiPermission(permissions, module, action);
    },
  };
}
