/**
 * Hook for checking user permissions in frontend components
 * Used to gate Create/Edit/Delete buttons based on role
 */

"use client";

import { useEffect, useState } from "react";

export type PermissionLevel = "none" | "read" | "write" | "admin";

export interface UserPermissions {
  // Module permissions
  people: PermissionLevel;
  admin: PermissionLevel;
  integrations: PermissionLevel;
  billing: PermissionLevel;
  automation: PermissionLevel;
  crm: PermissionLevel;
  finance: PermissionLevel;
  projects: PermissionLevel;

  // User info
  userId?: string;
  roleId?: string;
  tenantSlug?: string;
  loading: boolean;
  error?: string;
}

/**
 * Default permissions for unauthenticated users (read-only)
 */
const DEFAULT_PERMISSIONS: UserPermissions = {
  people: "none",
  admin: "none",
  integrations: "none",
  billing: "none",
  automation: "none",
  crm: "none",
  finance: "none",
  projects: "none",
  loading: true,
};

/**
 * Hook to get current user permissions
 * Reads from headers (dev mode) or session (production)
 */
export function usePermissions() {
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);

  useEffect(() => {
    // Fetch permissions from session or headers
    const getUserPermissions = async () => {
      try {
        // In development: Check for headers (passed via query params or similar)
        // In production: Fetch from API using session token

        // Attempt to get from API endpoint that checks current session
        const res = await fetch("/api/user/permissions", {
          cache: "no-store",
        }).catch(() => null);

        if (res && res.ok) {
          const data = await res.json();
          setPermissions({
            ...data,
            loading: false,
          });
        } else {
          // Fallback: Check from headers (dev mode)
          const roleId = (
            typeof window !== "undefined"
              ? new URLSearchParams(window.location.search).get("roleId")
              : null
          ) || "viewer";

          setPermissions(getDefaultPermissionsForRole(roleId));
        }
      } catch (error) {
        console.error("Error fetching permissions:", error);
        setPermissions({
          ...DEFAULT_PERMISSIONS,
          loading: false,
          error: "Failed to fetch permissions",
        });
      }
    };

    // Small delay to avoid excessive re-renders
    const timer = setTimeout(getUserPermissions, 0);
    return () => clearTimeout(timer);
  }, []);

  return permissions;
}

/**
 * Get default role-based permissions
 * Used in development when no API is available
 */
export function getDefaultPermissionsForRole(roleId: string): UserPermissions {
  const basePermissions = {
    loading: false,
    roleId,
  };

  switch (roleId?.toLowerCase()) {
    case "admin": {
      return {
        ...basePermissions,
        people: "admin",
        admin: "admin",
        integrations: "admin",
        billing: "write",
        automation: "write",
        crm: "write",
        finance: "write",
        projects: "write",
      };
    }

    case "manager": {
      return {
        ...basePermissions,
        people: "write",
        admin: "none",
        integrations: "none",
        billing: "write",
        automation: "write",
        crm: "write",
        finance: "read",
        projects: "write",
      };
    }

    case "editor": {
      return {
        ...basePermissions,
        people: "read",
        admin: "none",
        integrations: "none",
        billing: "read",
        automation: "write",
        crm: "write",
        finance: "read",
        projects: "write",
      };
    }

    case "viewer":
    default: {
      return {
        ...basePermissions,
        people: "read",
        admin: "none",
        integrations: "none",
        billing: "read",
        automation: "read",
        crm: "read",
        finance: "read",
        projects: "read",
      };
    }
  }
}

/**
 * Check if user has specific permission level for a module
 */
export function hasPermission(
  permission: PermissionLevel,
  required: PermissionLevel
): boolean {
  if (required === "none") return true;
  if (permission === "none") return false;

  const levels = { none: 0, read: 1, write: 2, admin: 3 };
  return levels[permission] >= levels[required];
}

/**
 * Utility to gate buttons based on permissions
 */
export function canCreate(perm: PermissionLevel): boolean {
  return hasPermission(perm, "write");
}

export function canEdit(perm: PermissionLevel): boolean {
  return hasPermission(perm, "write");
}

export function canDelete(perm: PermissionLevel): boolean {
  return hasPermission(perm, "admin");
}

/**
 * Hook-like utility to check specific action permission
 */
export function useCanAction(perms: UserPermissions, module: string) {
  const perm = perms[module as keyof UserPermissions] as PermissionLevel || "none";

  return {
    canRead: perm !== "none",
    canCreate: canCreate(perm),
    canEdit: canEdit(perm),
    canDelete: canDelete(perm),
    permission: perm,
    loading: perms.loading,
  };
}
