/**
 * Role-Based Access Control (RBAC) Utilities
 * Manages user permissions across modules and features
 */

export type PermissionLevel = "none" | "read" | "write" | "admin";

export type ModulePermissions = Record<string, PermissionLevel>;

export interface UserPermissions {
  userId: string;
  tenantSlug: string;
  role: string;
  scope: "tenant" | "region" | "branch";
  modules: ModulePermissions;
  features: string[]; // Feature flags
  restrictions: string[]; // Restricted modules/features
}

export const PERMISSION_LEVELS = {
  none: 0,
  read: 1,
  write: 2,
  admin: 3,
} as const;

/**
 * Navigation modules that support RBAC
 */
export const RBAC_MODULES = {
  overview: "overview",
  crm: "crm",
  finance: "finance",
  inventory: "inventory",
  procurement: "procurement",
  "hr-ops": "people",
  projects: "projects",
  "it-support": "itsupport",
  revops: "revops",
  workflows: "workflows",
  approvals: "approvals",
  "automation-rules": "automation",
  policies: "policies",
  reports: "reports",
  dashboards: "dashboards",
  "admin-control": "admin",
  "people-access": "people",
  structure: "people",
  modules: "admin",
  billing: "billing",
  "cost-allocation": "finance",
  integrations: "integrations",
  analytics: "analytics",
  security: "security",
} as const;

/**
 * Check if user has permission for a module at specified level
 */
export function hasPermission(
  permissions: UserPermissions | null,
  module: string,
  level: PermissionLevel = "read"
): boolean {
  if (!permissions) return false;

  // Check if module is explicitly restricted
  if (permissions.restrictions.includes(module)) {
    return false;
  }

  const modulePermission = permissions.modules[module];
  if (!modulePermission) return false;

  return PERMISSION_LEVELS[modulePermission] >= PERMISSION_LEVELS[level];
}

/**
 * Check if user can read a module
 */
export function canRead(permissions: UserPermissions | null, module: string): boolean {
  return hasPermission(permissions, module, "read");
}

/**
 * Check if user can write/edit in a module
 */
export function canWrite(permissions: UserPermissions | null, module: string): boolean {
  return hasPermission(permissions, module, "write");
}

/**
 * Check if user is admin for a module
 */
export function canAdmin(permissions: UserPermissions | null, module: string): boolean {
  return hasPermission(permissions, module, "admin");
}

/**
 * Check if user has a specific feature flag
 */
export function hasFeature(permissions: UserPermissions | null, feature: string): boolean {
  if (!permissions) return false;
  return permissions.features.includes(feature);
}

/**
 * Check if user is full tenant admin
 */
export function isTenantAdmin(permissions: UserPermissions | null): boolean {
  if (!permissions) return false;
  return (
    permissions.role === "admin" &&
    Object.values(permissions.modules).every((p) => p === "admin")
  );
}

/**
 * Filter navigation items based on user permissions
 */
export function filterNavigation(
  navigation: Array<{
    label: string;
    links: Array<{ label: string; key: string; icon: any }>;
  }>,
  permissions: UserPermissions | null
) {
  if (!permissions) return [];

  return navigation
    .map((section) => ({
      ...section,
      links: section.links.filter((link) => {
        const module = RBAC_MODULES[link.key as keyof typeof RBAC_MODULES];
        if (!module) return true; // Allow if not protected
        return canRead(permissions, module);
      }),
    }))
    .filter((section) => section.links.length > 0);
}

/**
 * Get visible modules for user
 */
export function getVisibleModules(permissions: UserPermissions | null): string[] {
  if (!permissions) return [];

  return Object.entries(permissions.modules)
    .filter(([module, level]) => {
      // Check if module is restricted
      if (permissions.restrictions.includes(module)) return false;
      return level !== "none";
    })
    .map(([module]) => module);
}

/**
 * Create default permissions for a new user (read-only viewer)
 */
export function createDefaultPermissions(userId: string, tenantSlug: string): UserPermissions {
  return {
    userId,
    tenantSlug,
    role: "viewer",
    scope: "tenant",
    modules: {
      overview: "read",
      crm: "read",
      finance: "read",
      people: "read",
      projects: "read",
      billing: "read",
      itsupport: "none",
      revops: "none",
      automation: "none",
      admin: "none",
      integrations: "none",
      analytics: "read",
      security: "none",
    },
    features: [],
    restrictions: [],
  };
}

/**
 * Create admin permissions for tenant admins
 */
export function createAdminPermissions(userId: string, tenantSlug: string): UserPermissions {
  return {
    userId,
    tenantSlug,
    role: "admin",
    scope: "tenant",
    modules: {
      overview: "admin",
      crm: "admin",
      finance: "admin",
      people: "admin",
      projects: "admin",
      billing: "admin",
      itsupport: "admin",
      revops: "admin",
      automation: "admin",
      admin: "admin",
      integrations: "admin",
      analytics: "admin",
      security: "admin",
    },
    features: ["all"],
    restrictions: [],
  };
}

/**
 * Apply restrictions from tenant admin settings
 */
export function applyRestrictions(
  permissions: UserPermissions,
  restrictedModules: string[]
): UserPermissions {
  return {
    ...permissions,
    restrictions: [...permissions.restrictions, ...restrictedModules],
  };
}

/**
 * Merge permission sets (for combining role and feature permissions)
 */
export function mergePermissions(
  base: UserPermissions,
  overrides: Partial<UserPermissions>
): UserPermissions {
  return {
    ...base,
    ...overrides,
    modules: {
      ...base.modules,
      ...(overrides.modules || {}),
    },
    features: [...new Set([...base.features, ...(overrides.features || [])])],
    restrictions: [...new Set([...base.restrictions, ...(overrides.restrictions || [])])],
  };
}
