import type { Permission } from './types';

// Predefined role -> permission keys (expandable)
export const predefinedRolePermissions: Record<string, string[]> = {
  'Admin': ['tenant.admin:users:view', 'tenant.admin:users:create', 'tenant.admin:users:edit', 'tenant.admin:roles:manage'],
  'Finance Manager': ['tenant.finance:*'],
  'HR Manager': ['tenant.hr:*'],
  'HOD': ['tenant.*:approve'],
  'Staff': ['tenant.*:view'],
};

export function permissionMatches(permissionKey: string, requiredKey: string) {
  if (permissionKey === requiredKey) return true;
  if (permissionKey.endsWith(':*')) {
    const prefix = permissionKey.slice(0, -2);
    return requiredKey.startsWith(prefix + ':');
  }
  // simple wildcard at action level
  return false;
}

// Check if a user's permission list satisfies a required permission key
export function hasPermission(userPermissions: string[], requiredKey: string) {
  for (const p of userPermissions) {
    if (permissionMatches(p, requiredKey)) return true;
  }
  return false;
}

// Build user permission set from roles (role names) using predefined map
export function buildPermissionsFromRoles(roleNames: string[], extraPermissions: string[] = []) {
  const perms = new Set<string>(extraPermissions);
  for (const r of roleNames) {
    const list = predefinedRolePermissions[r];
    if (list) list.forEach((p) => perms.add(p));
  }
  return Array.from(perms);
}

export default {
  predefinedRolePermissions,
  permissionMatches,
  hasPermission,
  buildPermissionsFromRoles,
};
