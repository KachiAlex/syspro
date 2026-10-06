export const dynamic = "force-dynamic";
/**
 * GET /api/tenant/role-history?tenantSlug=...&userId=...&limit=...
 * Role assignment audit log — reads admin_role_history.
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { setupTenantAdminSchema } from "@/lib/tenant-admin/schema";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "admin", "read");
  if (!_scope.ok) return _scope.response;

  const tenantSlug =
    request.nextUrl.searchParams.get("tenantSlug") || _scope.user.tenantSlug;
  const userId = request.nextUrl.searchParams.get("userId");
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "50", 10) || 50, 200);

  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  try {
    await setupTenantAdminSchema(sql);
    const rows = userId
      ? await sql`
          select h.*, r.name as role_name from admin_role_history h
          left join admin_roles r on r.id = h.new_role_id
          where h.tenant_slug = ${tenantSlug} and h.user_id = ${userId}
          order by h.created_at desc limit ${limit}
        `
      : await sql`
          select h.*, r.name as role_name from admin_role_history h
          left join admin_roles r on r.id = h.new_role_id
          where h.tenant_slug = ${tenantSlug}
          order by h.created_at desc limit ${limit}
        `;

    const history = (Array.isArray(rows) ? rows : []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email,
      oldRoleId: row.old_role_id,
      newRoleId: row.role_name || row.new_role_id,
      assignedAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      assignedByUserId: row.assigned_by_user_id,
      assignedByEmail: row.assigned_by_email,
      justification: row.justification,
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    }));

    return NextResponse.json({ history, total: history.length });
  } catch (error) {
    console.error("Failed to fetch role history:", error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
