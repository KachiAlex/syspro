import { db, sql as SQL } from '@/lib/sql-client';

// Minimal RBAC engine: checks whether a user has a permission key within a tenant.
export async function userHasPermission(tenantSlug: string, userId: string, permissionKey: string): Promise<boolean> {
  // Check primary role and secondary roles
  const rows = await SQL`
    select ar.permissions from admin_roles ar
    join admin_user_roles aur on aur.role_id = ar.id
    where ar.tenant_slug = ${tenantSlug} and aur.user_id = ${userId}
  `;
  for (const row of rows) {
    const perms: string[] = Array.isArray(row.permissions) ? row.permissions : [];
    if (perms.includes(permissionKey)) {
      return true;
    }
  }
  return false;
}

const rbacEngine = { userHasPermission };
export default rbacEngine;
