export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import {
  validateTenantContext,
  errorResponse,
  handleTenantAdminError,
} from "@/lib/tenant-admin/utils";

function statusLabel(s: string | null | undefined): string {
  const v = (s || "pending").toLowerCase();
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/**
 * PATCH /api/tenant/leave/requests/[id]
 * Approve or reject a leave request.
 */
export async function PATCH(request: NextRequest, context: any) {
  try {
    const ctx = validateTenantContext(request, "write");
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const status = typeof body?.status === "string" ? body.status.toLowerCase() : null;
    if (!status || !["pending", "approved", "rejected", "cancelled"].includes(status)) {
      return errorResponse("Valid status required (pending|approved|rejected|cancelled)", 400);
    }

    await ensureHrTables(sql);

    const [approver] = await sql`
      select coalesce(a.name, e.name) as name
      from (select ${ctx.tenantSlug}::text as ts) t
      left join tenant_admins a on a.tenant_slug = t.ts and a.id::text = ${ctx.userId}
      left join admin_employees e on e.tenant_slug = t.ts and e.id::text = ${ctx.userId}
      limit 1
    `;
    const approvedBy = (approver as any)?.name ?? ctx.userId;

    const [row] = await sql`
      update admin_leave
      set status = ${status},
          approved_by = ${approvedBy},
          updated_at = now()
      where id = ${id} and tenant_slug = ${ctx.tenantSlug}
      returning *
    `;

    if (!row) {
      return errorResponse("Leave request not found", 404);
    }

    const r = row as any;
    return NextResponse.json({
      success: true,
      data: {
        id: r.id,
        employeeId: r.employee_id,
        employeeName: r.employee_name,
        leaveType: r.leave_type,
        startDate: r.start_date instanceof Date ? r.start_date.toISOString().split("T")[0] : r.start_date,
        endDate: r.end_date instanceof Date ? r.end_date.toISOString().split("T")[0] : r.end_date,
        reason: r.reason,
        status: statusLabel(r.status),
        approvedBy: r.approved_by,
      },
    });
  } catch (error) {
    console.error("Leave request PATCH error:", error);
    return handleTenantAdminError(error);
  }
}
