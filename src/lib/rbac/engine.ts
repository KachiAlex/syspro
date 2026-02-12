import { db, sql as SQL } from '@/lib/sql-client';

// Minimal RBAC engine: checks whether a user has a permission key within a tenant.
export async function userHasPermission(tenantSlug: string, userId: string, permissionKey: string): Promise<boolean> {
  // Check primary role and secondary roles
  const rows = await SQL`
    select p.key from permissions p
    join role_permissions rp on rp.permission_id = p.id
    join roles r on r.id = rp.role_id
    join user_roles ur on ur.role_id = r.id
    where r.tenant_slug = ${tenantSlug} and ur.user_id = ${userId} and p.key = ${permissionKey}
    limit 1
  `;
  if (rows.length) return true;

  // Check primary role
  const primary = await SQL`select p.key from permissions p join role_permissions rp on rp.permission_id = p.id join roles r on r.id = rp.role_id join users u on u.primary_role_id = r.id where u.id = ${userId} and p.key = ${permissionKey} limit 1`;
  return primary.length > 0;
}

export default { userHasPermission };
