/**
 * Assign a role to a user — real persistence.
 * POST /api/tenant/users/assign-role
 *   { userId, newRoleId, tenantSlug, oldRoleId?, expiresAt?, justification? }
 *
 * newRoleId accepts an admin_roles.id or a preset name ("admin", "manager",
 * "editor", "viewer" — resolved to the tenant's seeded system role).
 * Assigning is single-role: existing tenant-scoped assignments are replaced.
 * Optional expiresAt + justification turn this into a time-bound delegation.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql } from "@/lib/sql-client";
import { setupTenantAdminSchema } from "@/lib/tenant-admin/schema";
import { requireModuleAccess } from "@/lib/api-auth";
import { invalidateTenantPermissions } from "@/lib/tenant-admin/permissions";
import { ensureTenantTable } from "@/lib/tenant/tenant-table";

interface AssignRoleRequest {
  userId: string;
  oldRoleId?: string;
  newRoleId: string;
  tenantSlug: string;
  expiresAt?: string;
  justification?: string;
}

async function resolveRole(newRoleId: string, tenantSlug: string) {
  const rows = await sql`
    select id, name from admin_roles
    where tenant_slug = ${tenantSlug}
      and (id = ${newRoleId} or id = ${`sys-${tenantSlug}-${newRoleId}`} or lower(name) = lower(${newRoleId}))
    limit 1
  `;
  return (Array.isArray(rows) ? rows : [])[0] as { id: string; name: string } | undefined;
}

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "admin", "write");
  if (!_scope.ok) return _scope.response;

  try {
    const body: AssignRoleRequest = await request.json();
    const { userId, oldRoleId, newRoleId, expiresAt, justification } = body;
    const tenantSlug = body.tenantSlug || _scope.user.tenantSlug;

    if (!userId || !newRoleId || !tenantSlug) {
      return NextResponse.json(
        { error: "Missing required fields: userId, newRoleId, tenantSlug" },
        { status: 400 }
      );
    }

    await setupTenantAdminSchema(sql);
    await ensureTenantTable(sql);

    const role = await resolveRole(newRoleId, tenantSlug);
    if (!role) {
      return NextResponse.json(
        { error: `Role "${newRoleId}" not found for this tenant` },
        { status: 404 }
      );
    }

    // Resolve the target user's email for the audit trail (employees first,
    // then tenant_admins — both are assignable principals).
    const userRows = await sql`
      select id, email from admin_employees
      where tenant_slug = ${tenantSlug} and id = ${userId}
      union all
      select id, email from tenant_admins
      where tenant_slug = ${tenantSlug} and id = ${userId}
      limit 1
    `;
    const target = (Array.isArray(userRows) ? userRows : [])[0] as any;
    if (!target) {
      return NextResponse.json({ error: "User not found in this tenant" }, { status: 404 });
    }

    const expires = expiresAt ? new Date(expiresAt) : null;
    if (expiresAt && isNaN(expires!.getTime())) {
      return NextResponse.json({ error: "Invalid expiresAt date" }, { status: 400 });
    }

    // Single-role-per-user semantics (matches the assignment UI): replace
    // existing tenant-scoped assignments, then insert the new one.
    await sql`
      delete from admin_user_roles
      where tenant_slug = ${tenantSlug} and user_id = ${userId} and scope = 'tenant'
    `;

    const assignmentId = randomUUID();
    await sql`
      insert into admin_user_roles (id, tenant_slug, user_id, role_id, scope, expires_at, justification, approved_by, created_by)
      values (${assignmentId}, ${tenantSlug}, ${userId}, ${role.id}, 'tenant', ${expires}, ${justification || null}, ${_scope.user.id}, ${_scope.user.id})
    `;

    await sql`
      insert into admin_role_history (id, tenant_slug, user_id, user_email, old_role_id, new_role_id, justification, expires_at, assigned_by_user_id, assigned_by_email)
      values (${randomUUID()}, ${tenantSlug}, ${userId}, ${target.email}, ${oldRoleId || null}, ${role.id}, ${justification || null}, ${expires}, ${_scope.user.id}, ${_scope.user.email || null})
    `;

    // Permission lookups are cached per (tenant, user) — invalidate so the
    // new assignment takes effect immediately.
    invalidateTenantPermissions(tenantSlug, userId);

    return NextResponse.json({
      success: true,
      userId,
      oldRoleId: oldRoleId || null,
      newRoleId: role.id,
      roleName: role.name,
      tenantSlug,
      expiresAt: expires?.toISOString() ?? null,
      assignedAt: new Date().toISOString(),
      assignedBy: _scope.user.email || _scope.user.id,
      message: `Assigned ${role.name} to ${target.email}${expires ? ` until ${expires.toLocaleDateString()}` : ""}`,
    });
  } catch (error) {
    console.error("Error assigning role:", error);
    return NextResponse.json({ error: "Failed to assign role" }, { status: 500 });
  }
}
