export const dynamic = "force-dynamic";
/**
 * Assign a role to a user — routed through the gated-action registry.
 * POST /api/tenant/users/assign-role
 *   { userId, newRoleId, tenantSlug, oldRoleId?, expiresAt?, justification? }
 *
 * newRoleId accepts an admin_roles.id or a preset name ("admin", "manager",
 * "editor", "viewer" — resolved to the tenant's seeded system role).
 * Privilege grants are staged as "role_assignment" gated actions: the
 * admin_user_roles row only changes once the approval chain approves.
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { setupTenantAdminSchema } from "@/lib/tenant-admin/schema";
import { requireModuleAccess } from "@/lib/api-auth";
import { ensureTenantTable } from "@/lib/tenant/tenant-table";
import { gateOrRun } from "@/lib/finance/gated-actions";

interface AssignRoleRequest {
  userId: string;
  oldRoleId?: string;
  newRoleId: string;
  tenantSlug: string;
  expiresAt?: string;
  justification?: string;
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

    // Validate before staging — don't open an approval for a bad request.
    const roleRows = await sql`
      select id, name from admin_roles
      where tenant_slug = ${tenantSlug}
        and (id = ${newRoleId} or id = ${`sys-${tenantSlug}-${newRoleId}`} or lower(name) = lower(${newRoleId}))
      limit 1
    `;
    const role = (Array.isArray(roleRows) ? roleRows : [])[0] as { id: string; name: string } | undefined;
    if (!role) {
      return NextResponse.json(
        { error: `Role "${newRoleId}" not found for this tenant` },
        { status: 404 }
      );
    }

    const userRows = await sql`
      select id::text as id, email from admin_employees
      where tenant_slug = ${tenantSlug} and id = ${userId}
      union all
      select id::text as id, email from tenant_admins
      where tenant_slug = ${tenantSlug} and id::text = ${userId}
      limit 1
    `;
    const target = (Array.isArray(userRows) ? userRows : [])[0] as any;
    if (!target) {
      return NextResponse.json({ error: "User not found in this tenant" }, { status: 404 });
    }

    const outcome = await gateOrRun(
      tenantSlug,
      "role_assignment",
      {
        userId,
        newRoleId,
        oldRoleId,
        expiresAt,
        justification,
        userEmail: target.email,
        roleName: role.name,
        assignedBy: _scope.user.id,
        assignedByEmail: _scope.user.email || null,
      },
      { requestedBy: _scope.user.id }
    );

    if (outcome.status === "pending") {
      return NextResponse.json(
        {
          success: true,
          pendingApproval: true,
          approvalId: outcome.approvalId,
          message: `Role assignment staged — ${role.name} → ${target.email} awaits approval`,
        },
        { status: 202 }
      );
    }
    if (outcome.status === "denied") {
      return NextResponse.json({ error: outcome.error }, { status: 403 });
    }

    const result = outcome.result;
    if (!result?.ok) {
      return NextResponse.json({ error: result?.error ?? "Role assignment failed" }, { status: result?.status ?? 500 });
    }

    return NextResponse.json({
      success: true,
      userId: result.userId,
      oldRoleId: result.oldRoleId,
      newRoleId: result.newRoleId,
      roleName: result.roleName,
      tenantSlug,
      expiresAt: result.expiresAt,
      assignedAt: result.assignedAt,
      assignedBy: _scope.user.email || _scope.user.id,
      message: `Assigned ${result.roleName} to ${result.userEmail}${result.expiresAt ? ` until ${new Date(result.expiresAt).toLocaleDateString()}` : ""}`,
    });
  } catch (error) {
    console.error("Error assigning role:", error);
    return NextResponse.json({ error: "Failed to assign role" }, { status: 500 });
  }
}
