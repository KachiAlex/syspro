/**
 * Tenant role assignment — the grant itself. Extracted from the
 * /api/tenant/users/assign-role route so the gated-action registry can
 * replay it on approval. Resolution is idempotent: callers may validate
 * first (routes do), the function re-resolves defensively when replaying.
 */

import { randomUUID } from "crypto";
import { sql } from "../sql-client";
import { setupTenantAdminSchema } from "../tenant-admin/schema";
import { invalidateTenantPermissions } from "../tenant-admin/permissions";
import { ensureTenantTable } from "./tenant-table";

export interface AssignRoleInput {
  userId: string;
  newRoleId: string;
  oldRoleId?: string;
  expiresAt?: string;
  justification?: string;
  /** The user granting the role (requester when ungated, decider when an
      approval chain applied it). */
  assignedBy: string;
  assignedByEmail?: string | null;
}

export type AssignRoleResult =
  | {
      ok: true;
      userId: string;
      oldRoleId: string | null;
      newRoleId: string;
      roleName: string;
      userEmail: string;
      expiresAt: string | null;
      assignedAt: string;
    }
  | { ok: false; status: number; error: string };

async function resolveRole(newRoleId: string, tenantSlug: string) {
  const rows = await sql`
    select id, name from admin_roles
    where tenant_slug = ${tenantSlug}
      and (id = ${newRoleId} or id = ${`sys-${tenantSlug}-${newRoleId}`} or lower(name) = lower(${newRoleId}))
    limit 1
  `;
  return (Array.isArray(rows) ? rows : [])[0] as { id: string; name: string } | undefined;
}

export async function assignUserRole(
  tenantSlug: string,
  input: AssignRoleInput
): Promise<AssignRoleResult> {
  await setupTenantAdminSchema(sql);
  await ensureTenantTable(sql);

  const role = await resolveRole(input.newRoleId, tenantSlug);
  if (!role) {
    return { ok: false, status: 404, error: `Role "${input.newRoleId}" not found for this tenant` };
  }

  // Resolve the target user's email for the audit trail (employees first,
  // then tenant_admins — both are assignable principals).
  const userRows = await sql`
    select id::text as id, email from admin_employees
    where tenant_slug = ${tenantSlug} and id = ${input.userId}
    union all
    select id::text as id, email from tenant_admins
    where tenant_slug = ${tenantSlug} and id::text = ${input.userId}
    limit 1
  `;
  const target = (Array.isArray(userRows) ? userRows : [])[0] as any;
  if (!target) {
    return { ok: false, status: 404, error: "User not found in this tenant" };
  }

  const expires = input.expiresAt ? new Date(input.expiresAt) : null;
  if (input.expiresAt && isNaN(expires!.getTime())) {
    return { ok: false, status: 400, error: "Invalid expiresAt date" };
  }

  // Single-role-per-user semantics (matches the assignment UI): replace
  // existing tenant-scoped assignments, then insert the new one.
  await sql`
    delete from admin_user_roles
    where tenant_slug = ${tenantSlug} and user_id = ${input.userId} and scope = 'tenant'
  `;

  const assignmentId = randomUUID();
  await sql`
    insert into admin_user_roles (id, tenant_slug, user_id, role_id, scope, expires_at, justification, approved_by, created_by)
    values (${assignmentId}, ${tenantSlug}, ${input.userId}, ${role.id}, 'tenant', ${expires}, ${input.justification || null}, ${input.assignedBy}, ${input.assignedBy})
  `;

  await sql`
    insert into admin_role_history (id, tenant_slug, user_id, user_email, old_role_id, new_role_id, justification, expires_at, assigned_by_user_id, assigned_by_email)
    values (${randomUUID()}, ${tenantSlug}, ${input.userId}, ${target.email}, ${input.oldRoleId || null}, ${role.id}, ${input.justification || null}, ${expires}, ${input.assignedBy}, ${input.assignedByEmail || null})
  `;

  // Permission lookups are cached per (tenant, user) — invalidate so the
  // new assignment takes effect immediately.
  invalidateTenantPermissions(tenantSlug, input.userId);

  return {
    ok: true,
    userId: input.userId,
    oldRoleId: input.oldRoleId || null,
    newRoleId: role.id,
    roleName: role.name,
    userEmail: target.email,
    expiresAt: expires?.toISOString() ?? null,
    assignedAt: new Date().toISOString(),
  };
}
