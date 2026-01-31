import { NextRequest } from "next/server";

/**
 * Basic auth helper for tenant admin APIs.
 * In production, this would integrate with your auth system (Auth0, Clerk, etc.)
 * For now, we validate tenantSlug and provide hooks for role-based checks.
 */

export interface AuthContext {
  tenantSlug: string;
  userId?: string;
  userRole?: string; // e.g., "admin", "operator", "viewer"
}

/**
 * Extract auth context from request.
 * Currently uses tenantSlug from query params as the primary tenant identifier.
 * Should be extended to validate against actual user session/JWT.
 */
export function extractAuthContext(request: NextRequest): AuthContext {
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug") ?? "kreatix-default";
  const userId = url.searchParams.get("userId"); // placeholder
  const userRole = url.searchParams.get("userRole") ?? "admin"; // default to admin for scaffold

  return { tenantSlug, userId: userId || undefined, userRole };
}

/**
 * Validate that tenantSlug is provided and not empty.
 * Returns true if valid, throws error otherwise.
 */
export function validateTenant(tenantSlug?: string | null): string {
  if (!tenantSlug || tenantSlug.trim().length === 0) {
    throw new Error("Invalid tenant context: tenantSlug is required");
  }
  return tenantSlug;
}

/**
 * Permission levels for actions.
 * read: view data only
 * write: create/update data
 * admin: manage roles, permissions, sensitive settings
 * delete: delete data (requires admin)
 */
export type Permission = "read" | "write" | "admin" | "delete";

/**
 * Check if a user role has the required permission.
 * In production, this would check against a permission matrix or ACL.
 */
export function hasPermission(userRole: string | undefined, requiredPermission: Permission): boolean {
  // Simple role-based permission mapping (scaffold)
  const rolePermissions: Record<string, Permission[]> = {
    admin: ["read", "write", "admin", "delete"],
    operator: ["read", "write"],
    viewer: ["read"],
  };

  const permissions = rolePermissions[userRole || "viewer"] || [];
  return permissions.includes(requiredPermission);
}

/**
 * Validate a specific permission and throw error if not authorized.
 * Usage in API handlers: requirePermission(auth.userRole, "admin");
 */
export function requirePermission(userRole: string | undefined, requiredPermission: Permission): void {
  if (!hasPermission(userRole, requiredPermission)) {
    throw new Error(`Unauthorized: requires ${requiredPermission} permission`);
  }
}

/**
 * Audit log entry (placeholder for future logging system).
 */
export interface AuditLogEntry {
  tenantSlug: string;
  actor: string;
  action: string;
  resource: string;
  resourceId?: string;
  changes?: Record<string, any>;
  timestamp: string;
  status: "success" | "error";
}

/**
 * Log an action for audit purposes.
 * In production, would persist to audit log table or external service.
 */
export function logAuditEvent(
  tenantSlug: string,
  actor: string | undefined,
  action: string,
  resource: string,
  resourceId?: string,
  status: "success" | "error" = "success"
): AuditLogEntry {
  return {
    tenantSlug,
    actor: actor || "system",
    action,
    resource,
    resourceId,
    timestamp: new Date().toISOString(),
    status,
  };
}

/**
 * Class for fluent error handling with tenant context.
 */
export class AuthorizationError extends Error {
  constructor(message: string, public tenantSlug?: string, public action?: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}
