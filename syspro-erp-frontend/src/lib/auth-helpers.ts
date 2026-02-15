/**
 * Helper utilities for user session and authentication
 * This is a simplified auth system for development/demo purposes
 * In production, integrate with NextAuth.js, Clerk, or your auth provider
 */

import { NextRequest } from "next/server";
import { db, sql as SQL, SqlClient } from "@/lib/sql-client";

export interface SessionUser {
  id: string;
  email: string;
  name?: string;
  tenantSlug?: string;
  roleId: string;
}

/**
 * Permission level type for modules and features
 */
export type PermissionLevel = "none" | "read" | "write" | "admin";

/**
 * Get current user from request headers or cookies
 * In development: Check for X-User-Id, X-User-Email, X-Tenant-Slug headers
 * In production: Verify JWT token or get from next-auth session
 */
export function getCurrentUser(request: NextRequest): SessionUser | null {
  // Method 1: Check for development headers
  const userId = typeof request.headers?.get === "function" ? request.headers.get("X-User-Id") : undefined;
  const userEmail = typeof request.headers?.get === "function" ? request.headers.get("X-User-Email") || "user@example.com" : "user@example.com";
  const tenantSlugFromHeader = typeof request.headers?.get === "function" ? request.headers.get("X-Tenant-Slug") || undefined : undefined;
  const roleIdFromHeader = typeof request.headers?.get === "function" ? request.headers.get("X-Role-Id") || "viewer" : "viewer";

  if (userId) {
    return {
      id: userId,
      email: userEmail,
      name: typeof request.headers?.get === "function" ? request.headers.get("X-User-Name") || undefined : undefined,
      tenantSlug: tenantSlugFromHeader,
      roleId: roleIdFromHeader,
    };
  }

  // Method 2: Check cookies (dev flows may set cookies from client Access page)
  try {
    if (typeof (request as any).cookies?.get === "function") {
      const cookieGet = (request as any).cookies.get as (k: string) => string | undefined | null;
      const cookieUserId = cookieGet("X-User-Id") || cookieGet("dev-user-id") || cookieGet("userId");
      if (cookieUserId) {
        const cookieEmail = cookieGet("X-User-Email") || "user@example.com";
        const cookieRole = cookieGet("X-Role-Id") || "viewer";
        const cookieTenant = cookieGet("tenantSlug") || cookieGet("X-Tenant-Slug") || undefined;
        return {
          id: cookieUserId,
          email: cookieEmail,
          name: cookieGet("X-User-Name") || undefined,
          tenantSlug: cookieTenant,
          roleId: cookieRole,
        };
      }
    }
  } catch (e) {
    // ignore cookie read errors and continue to returning null
  }

  // Method 2: Check cookies (would come from your auth provider)
  // const sessionCookie = request.cookies.get("next-auth.session-token");
  // if (sessionCookie) {
  //   const session = await getSession({ req: request });
  //   if (session?.user) {
  //     return {
  //       id: session.user.id || "anonymous",
  //       email: session.user.email || "unknown@example.com",
  //       name: session.user.name,
  //       tenantSlug: request.headers.get("X-Tenant-Slug") || "kreatix-default",
  //       roleId: session.user.roleId || "viewer",
  //     };
  //   }
  // }

  // Method 3: For strict tenant isolation we return null unless an explicit
  // authenticated user is present. This prevents accidental cross-tenant
  // data exposure when no tenant header/session is provided.
  return null;
}

/**
 * Validate that user has permission for the tenant
 */
export async function validateTenantAccess(user: SessionUser, requestedTenantSlug: string): Promise<boolean> {
  if (!requestedTenantSlug) return false;

  // Global admin roles are handled via RBAC; no hardcoded global role.

  // If the user's session already includes a tenant slug that matches,
  // allow access immediately (fast path).
  if (user.tenantSlug && user.tenantSlug === requestedTenantSlug) return true;

  // Otherwise, check the database for tenant membership/role assignment.
  try {
    const sql = SQL;

    // Check tenant_user_roles first (role assignment table)
    const roleRows = await sql`
      SELECT 1 FROM tenant_user_roles WHERE tenant_slug = ${requestedTenantSlug} AND user_id = ${user.id} LIMIT 1
    `;
    if (Array.isArray(roleRows) && roleRows.length > 0) return true;

    // Check tenant_members table as a fallback
    const memberRows = await sql`
      SELECT 1 FROM tenant_members WHERE tenant_slug = ${requestedTenantSlug} AND user_id = ${user.id} LIMIT 1
    `;
    if (Array.isArray(memberRows) && memberRows.length > 0) return true;

    return false;
  } catch (error) {
    console.error("validateTenantAccess DB check failed:", error);
    // On DB failure, be conservative and deny access
    return false;
  }
}

/**
 * Get user from database - called by routes that need user info
 * This would query the tenant_users table
 */
export async function getUserFromDB(userId: string, tenantSlug: string) {
  try {
    // This is a placeholder - implement with your database client
    // const pool = await getDbConnection();
    // const result = await pool.query(
    //   'SELECT * FROM tenant_users WHERE id = $1 AND tenant_slug = $2',
    //   [userId, tenantSlug]
    // );
    // return result.rows[0] || null;

    // For now, return mock user
    return {
      id: userId,
      email: "user@example.com",
      name: "User",
      tenant_slug: tenantSlug,
      role_id: "admin",
      is_active: true,
    };
  } catch (error) {
    console.error("Failed to get user from DB:", error);
    return null;
  }
}

/**
 * Get role permissions from database
 */
export async function getRolePermissionsFromDB(roleId: string) {
  try {
    // This is a placeholder - implement with your database client
    // const pool = await getDbConnection();
    // const result = await pool.query(
    //   'SELECT permissions FROM roles WHERE id = $1',
    //   [roleId]
    // );
    // return result.rows[0]?.permissions || getDefaultRolePermissions(roleId);

    // For now, return default permissions based on role
    return getDefaultRolePermissions(roleId);
  } catch (error) {
    console.error("Failed to get role permissions from DB:", error);
    return getDefaultRolePermissions(roleId);
  }
}

/**
 * Convert permission level number to string
 * 0 = none, 1 = read, 2 = write, 3 = admin
 */
function getPermissionLevelString(level: number | string): "none" | "read" | "write" | "admin" {
  if (typeof level === "string") {
    if (["none", "read", "write", "admin"].includes(level)) {
      return level as "none" | "read" | "write" | "admin";
    }
  }
  const numLevel = typeof level === "string" ? parseInt(level, 10) : level;
  const mapping: Record<number, "none" | "read" | "write" | "admin"> = {
    0: "none",
    1: "read",
    2: "write",
    3: "admin",
  };
  return mapping[numLevel] || "none";
}

/**
 * Default role permission definitions (fallback)
 * Returns permissions as string levels: "none" | "read" | "write" | "admin"
 */
function getDefaultRolePermissions(roleId: string): Record<string, "none" | "read" | "write" | "admin"> {
  const defaults: Record<string, Record<string, "none" | "read" | "write" | "admin">> = {
    admin: {
      overview: "admin",
      crm: "admin",
      finance: "admin",
      people: "admin",
      projects: "admin",
      billing: "admin",
      inventory: "admin",
      procurement: "admin",
      itsupport: "admin",
      revops: "admin",
      automation: "admin",
      admin: "admin",
      integrations: "admin",
      analytics: "admin",
      security: "admin",
      policies: "admin",
      reports: "admin",
      dashboards: "admin",
      approvals: "admin",
      workflows: "admin",
    },
    manager: {
      overview: "read",
      crm: "write",
      finance: "read",
      people: "write",
      projects: "write",
      billing: "read",
      inventory: "read",
      procurement: "read",
      itsupport: "read",
      revops: "read",
      automation: "read",
      admin: "read",
      integrations: "read",
      analytics: "read",
      security: "read",
      policies: "read",
      reports: "read",
      dashboards: "read",
      approvals: "write",
      workflows: "write",
    },
    editor: {
      overview: "read",
      crm: "write",
      finance: "read",
      people: "read",
      projects: "write",
      billing: "read",
      inventory: "read",
      procurement: "read",
      itsupport: "read",
      revops: "read",
      automation: "read",
      admin: "none",
      integrations: "none",
      analytics: "read",
      security: "none",
      policies: "none",
      reports: "read",
      dashboards: "read",
      approvals: "read",
      workflows: "read",
    },
    viewer: {
      overview: "read",
      crm: "read",
      finance: "read",
      people: "read",
      projects: "read",
      billing: "read",
      inventory: "read",
      procurement: "read",
      itsupport: "read",
      revops: "read",
      automation: "none",
      admin: "none",
      integrations: "none",
      analytics: "read",
      security: "none",
      policies: "none",
      reports: "read",
      dashboards: "read",
      approvals: "none",
      workflows: "none",
    },
  };

  return defaults[roleId] || defaults.viewer;
}
