import { NextRequest } from "next/server";
import { verifySession } from "./session";

/**
 * Basic auth helper for tenant admin APIs.
 * In production, this would integrate with your auth system (Auth0, Clerk, etc.)
 * For now, we validate tenantSlug and provide hooks for role-based checks.
 */

export interface AuthContext {
  tenantSlug: string;
  userId?: string;
  userRole?: string; // e.g., "admin", "operator", "viewer"
  userPermissions?: string[];
}

/**
 * Extract auth context from request.
 * Prefers cookies/headers for user identity; only falls back to query params
 * in development. In production, untrusted query params are ignored for role
 * assignment to prevent privilege escalation.
 */
export function extractAuthContext(request: NextRequest): AuthContext {
  const url = new URL(request.url);
  const isDev = process.env.NODE_ENV !== "production";

  // 1. Attempt to read authenticated session from signed cookies
  let userId: string | undefined;
  let userRole: string | undefined;
  let sessionTenantSlug: string | undefined;

  // Superadmin session cookie (signed) — checked first so a caller holding
  // both a tenant session and a superadmin token resolves as superadmin,
  // matching getSessionUser in api-auth.ts. Superadmin tokens carry no
  // tenantSlug; the tenant is resolved from the request's tenantSlug param
  // below, matching requireTenantScope semantics.
  let isSuperadmin = false;
  const saCookie = request.cookies.get("superadmin_auth")?.value;
  if (saCookie) {
    const session = verifySession(saCookie);
    if (session?.id && session.roleId === "superadmin") {
      userId = session.id;
      userRole = "superadmin";
      isSuperadmin = true;
    }
  }

  if (!userId) {
    const sessionCookie = request.cookies.get("pisairtel_session")?.value;
    if (sessionCookie) {
      const session = verifySession(sessionCookie);
      if (session) {
        userId = session.id;
        userRole = session.roleId;
        sessionTenantSlug = session.tenantSlug;
      }
    }
  }

  // Employee session cookie (signed) — portal users
  if (!userId) {
    const empCookie = request.cookies.get("employee_session")?.value;
    if (empCookie) {
      const session = verifySession(empCookie);
      if (session) {
        userId = session.id;
        userRole = session.roleId || "staff";
        sessionTenantSlug = session.tenantSlug;
      }
    }
  }

  // 2. Dev-only fallbacks: unsigned headers/cookies/query params are NEVER
  //    trusted in production — a client can set them to claim any identity.
  if (isDev && !userId) {
    userId = request.headers.get("X-User-Id") || undefined;
    userRole = request.headers.get("X-Role-Id") || undefined;
  }

  if (isDev && !userId) {
    userId =
      request.cookies.get("X-User-Id")?.value ||
      request.cookies.get("dev-user-id")?.value ||
      request.cookies.get("userId")?.value ||
      undefined;
    userRole = userRole || request.cookies.get("X-Role-Id")?.value || undefined;
  }

  // Tenant slug resolution: session is authoritative in production.
  // Unsigned cookie/header tenant claims are accepted only in dev, and only
  // when they do not contradict the session's tenant.
  const cookieTenantSlug =
    request.cookies.get("tenantSlug")?.value ||
    request.headers.get("X-Tenant-Slug") ||
    undefined;

  const queryTenantSlug = url.searchParams.get("tenantSlug") || undefined;

  let tenantSlug: string;
  if (sessionTenantSlug) {
    // Session is authoritative — cookie/header tenant claims cannot override it
    tenantSlug = sessionTenantSlug;
  } else if (isSuperadmin) {
    // Superadmin sessions carry no tenant; they may act on the tenant named
    // by the request (middleware already exempts them from tenant binding).
    tenantSlug = queryTenantSlug || cookieTenantSlug || "";
  } else if (isDev && cookieTenantSlug) {
    tenantSlug = cookieTenantSlug;
  } else if (isDev && queryTenantSlug) {
    tenantSlug = queryTenantSlug;
  } else {
    tenantSlug = "";
  }

  // 4. Development-only fallback: allow query params when no real auth is present
  if (isDev && !userId) {
    userId = url.searchParams.get("userId") || undefined;
    userRole = url.searchParams.get("userRole") || "admin";
  }

  const userPermissions: string[] = [];
  return { tenantSlug, userId, userRole, userPermissions };
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
  // Role-based permission mapping — includes the roleIds actually issued in
  // session cookies: tenant_admins.role (admin/tenant_admin), superadmin, and
  // employee portal roles (staff/hod/executive).
  const rolePermissions: Record<string, Permission[]> = {
    admin: ["read", "write", "admin", "delete"],
    tenant_admin: ["read", "write", "admin", "delete"],
    superadmin: ["read", "write", "admin", "delete"],
    operator: ["read", "write"],
    manager: ["read", "write"],
    editor: ["read", "write"],
    hod: ["read", "write"],
    executive: ["read", "write"],
    staff: ["read"],
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
