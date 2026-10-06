export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
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

    const [existing] = await sql`
      select status, employee_id, employee_name, leave_type, start_date, end_date
      from admin_leave
      where id = ${id} and tenant_slug = ${ctx.tenantSlug}
      limit 1
    `;
    if (!existing) {
      return errorResponse("Leave request not found", 404);
    }
    const prev = existing as any;

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

    // Maintain the leave balance when the decision changes
    if (prev.status !== status) {
      const ms = new Date(prev.end_date).getTime() - new Date(prev.start_date).getTime();
      const days = Math.max(1, Math.round(ms / 86400000) + 1);
      const year = new Date(prev.start_date).getUTCFullYear();

      if (prev.status === "pending" && status === "approved") {
        await sql`
          insert into admin_leave_balances (
            id, tenant_slug, employee_id, employee_name, leave_type, year, entitled, used, pending
          ) values (
            ${randomUUID()}, ${ctx.tenantSlug}, ${prev.employee_id},
            ${prev.employee_name}, ${prev.leave_type}, ${year}, 0, ${days}, 0
          )
          on conflict (tenant_slug, employee_id, leave_type, year)
          do update set
            pending = greatest(0, admin_leave_balances.pending - ${days}),
            used = admin_leave_balances.used + ${days},
            updated_at = now()
        `;
      } else if (prev.status === "pending" && ["rejected", "cancelled"].includes(status)) {
        await sql`
          update admin_leave_balances
          set pending = greatest(0, pending - ${days}), updated_at = now()
          where tenant_slug = ${ctx.tenantSlug} and employee_id = ${prev.employee_id}
            and leave_type = ${prev.leave_type} and year = ${year}
        `;
      } else if (prev.status === "approved" && ["rejected", "cancelled"].includes(status)) {
        await sql`
          update admin_leave_balances
          set used = greatest(0, used - ${days}), updated_at = now()
          where tenant_slug = ${ctx.tenantSlug} and employee_id = ${prev.employee_id}
            and leave_type = ${prev.leave_type} and year = ${year}
        `;
      }
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
