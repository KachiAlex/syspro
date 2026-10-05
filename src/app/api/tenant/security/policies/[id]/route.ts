import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  validateTenantContext,
  errorResponse,
  handleTenantAdminError,
} from "@/lib/tenant-admin/utils";
import { sql as SQL } from "@/lib/sql-client";
import { ensureTenantTable } from "@/lib/tenant/tenant-table";
import { setupTenantAdminSchema } from "@/lib/tenant-admin/schema";

type Params = { params: Promise<{ id: string }> };

function mapPolicy(row: any) {
  const rules = typeof row.rules === "string" ? JSON.parse(row.rules || "{}") : row.rules || {};
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    enabled: row.is_active,
    severity: rules.severity || "medium",
    lastModified: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

/**
 * PATCH /api/tenant/security/policies/[id]?tenantSlug=
 * Toggle a security policy ({ enabled: boolean }).
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const context = validateTenantContext(request, "write");
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const enabled = body?.enabled === undefined ? undefined : !!body.enabled;
    if (enabled === undefined) {
      return errorResponse("'enabled' is required", 400);
    }

    await ensureTenantTable(SQL);
    await setupTenantAdminSchema(SQL);

    const rows = await SQL`
      update admin_security_policies
      set is_active = ${enabled}, updated_at = now(), updated_by = ${context.userId}
      where id = ${id} and tenant_slug = ${context.tenantSlug}
      returning *
    `;
    if (!rows.length) return errorResponse("Security policy not found", 404);

    await SQL`
      insert into admin_audit_logs (id, tenant_slug, user_id, action, resource, resource_id, changes, ip_address, created_at)
      values (${randomUUID()}, ${context.tenantSlug}, ${context.userId}, 'update', 'security_policy',
              ${id}, ${JSON.stringify({ status: "success", details: `${enabled ? "Enabled" : "Disabled"} ${rows[0].name}` })},
              ${request.headers.get("x-forwarded-for") || null}, now())
    `;

    return NextResponse.json({
      success: true,
      data: mapPolicy(rows[0]),
      message: "Security policy updated successfully",
    });
  } catch (error) {
    console.error("Security policy PATCH error:", error);
    return handleTenantAdminError(error);
  }
}
