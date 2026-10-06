export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import {
  validateTenantContext,
  getPaginationParams,
  errorResponse,
  handleTenantAdminError,
  checkRateLimit,
  parseJsonRequest,
} from "@/lib/tenant-admin/utils";
import { z } from "zod";

const CreateLeaveRequestSchema = z.object({
  employeeId: z.string(),
  employeeName: z.string().optional(),
  leaveType: z.enum(["annual", "sick", "personal", "maternity", "paternity", "unpaid", "other"]),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
  approverComments: z.string().optional(),
});

function daysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

function statusLabel(s: string | null | undefined): string {
  const v = (s || "pending").toLowerCase();
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/**
 * GET /api/tenant/leave/requests
 * Real leave requests for the tenant.
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`leave-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const pagination = getPaginationParams(request);
    await ensureHrTables(sql);

    const rows = status
      ? await sql`
          select * from admin_leave
          where tenant_slug = ${context.tenantSlug} and status = ${status.toLowerCase()}
          order by created_at desc
          limit ${pagination.limit} offset ${(pagination.page - 1) * pagination.limit}
        `
      : await sql`
          select * from admin_leave
          where tenant_slug = ${context.tenantSlug}
          order by created_at desc
          limit ${pagination.limit} offset ${(pagination.page - 1) * pagination.limit}
        `;

    const requests = (rows as any[]).map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      employeeName: r.employee_name,
      leaveType: r.leave_type,
      startDate: r.start_date instanceof Date ? r.start_date.toISOString().split("T")[0] : r.start_date,
      endDate: r.end_date instanceof Date ? r.end_date.toISOString().split("T")[0] : r.end_date,
      days: daysBetween(String(r.start_date), String(r.end_date)),
      reason: r.reason,
      status: statusLabel(r.status),
      approvedBy: r.approved_by,
      createdAt: r.created_at,
    }));

    return NextResponse.json({
      success: true,
      data: requests,
      pagination: { page: pagination.page, limit: pagination.limit, total: requests.length },
    });
  } catch (error) {
    console.error("Leave request GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/leave/requests
 * Create a leave request (persisted to admin_leave).
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");

    const parsed = await parseJsonRequest(request, CreateLeaveRequestSchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    await ensureHrTables(sql);
    const leaveType = parsed.data.leaveType === "other" ? "personal" : parsed.data.leaveType;
    const id = randomUUID();

    // Resolve employee name when not supplied
    let employeeName = parsed.data.employeeName;
    if (!employeeName) {
      const [emp] = await sql`
        select name from admin_employees
        where tenant_slug = ${context.tenantSlug} and id = ${parsed.data.employeeId}
        limit 1
      `;
      employeeName = (emp as any)?.name ?? parsed.data.employeeId;
    }

    const [row] = await sql`
      insert into admin_leave (
        id, tenant_slug, employee_id, employee_name, leave_type,
        start_date, end_date, reason, status, created_at, updated_at
      ) values (
        ${id}, ${context.tenantSlug}, ${parsed.data.employeeId}, ${employeeName},
        ${leaveType}, ${parsed.data.startDate}, ${parsed.data.endDate},
        ${parsed.data.reason ?? ""}, 'pending', now(), now()
      )
      returning *
    `;

    // Track the request against the employee's leave balance
    const days = daysBetween(parsed.data.startDate, parsed.data.endDate);
    const year = new Date(parsed.data.startDate).getUTCFullYear();
    await sql`
      insert into admin_leave_balances (
        id, tenant_slug, employee_id, employee_name, leave_type, year, entitled, pending
      ) values (
        ${randomUUID()}, ${context.tenantSlug}, ${parsed.data.employeeId},
        ${employeeName}, ${leaveType}, ${year}, 0, ${days}
      )
      on conflict (tenant_slug, employee_id, leave_type, year)
      do update set pending = admin_leave_balances.pending + ${days}, updated_at = now()
    `;

    return NextResponse.json(
      {
        success: true,
        data: {
          id: (row as any).id,
          employeeId: (row as any).employee_id,
          employeeName: (row as any).employee_name,
          leaveType: (row as any).leave_type,
          startDate: (row as any).start_date,
          endDate: (row as any).end_date,
          status: "Pending",
        },
        message: "Leave request created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Leave request POST error:", error);
    return handleTenantAdminError(error);
  }
}
