export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import {
  validateTenantContext,
  getPaginationParams,
  errorResponse,
  checkRateLimit,
} from "@/lib/tenant-admin/utils";

function statusLabel(s: string | null | undefined): string {
  const v = (s || "present").toLowerCase();
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function computeDuration(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn || !checkOut) return "0h";
  const parse = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const mins = Math.max(0, parse(checkOut) - parse(checkIn));
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/**
 * GET /api/tenant/attendance?date=YYYY-MM-DD
 * Real attendance records for the tenant on the given date.
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`attendance-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const url = new URL(request.url);
    const date = url.searchParams.get("date") || new Date().toISOString().split("T")[0];
    const pagination = getPaginationParams(request);
    await ensureHrTables(sql);

    const rows = await sql`
      select id, employee_id, employee_name, work_date, attendance_status,
             check_in_time, check_out_time, work_mode
      from attendance_records
      where tenant_id = ${context.tenantSlug} and work_date = ${date}
      order by employee_name asc nulls last
      limit ${pagination.limit} offset ${(pagination.page - 1) * pagination.limit}
    `;

    const records = (rows as any[]).map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      employeeName: r.employee_name || r.employee_id,
      date: r.work_date instanceof Date ? r.work_date.toISOString().split("T")[0] : r.work_date,
      status: statusLabel(r.attendance_status),
      checkInTime: r.check_in_time,
      checkOutTime: r.check_out_time,
      duration: computeDuration(r.check_in_time, r.check_out_time),
      workMode: r.work_mode,
    }));

    const [{ count }] = await sql`
      select count(*)::int as count from attendance_records
      where tenant_id = ${context.tenantSlug} and work_date = ${date}
    `;

    return NextResponse.json({
      success: true,
      data: records,
      pagination: { page: pagination.page, limit: pagination.limit, total: count ?? records.length },
    });
  } catch (error) {
    console.error("Attendance GET error:", error);
    return errorResponse("Failed to load attendance", 500);
  }
}

/**
 * POST /api/tenant/attendance
 * Mark attendance for an employee: { employeeId, date, status }
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");

    if (!checkRateLimit(`attendance-post-${context.tenantSlug}`, 60, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const body = await request.json().catch(() => null);
    const employeeId = body?.employeeId;
    const date = body?.date || new Date().toISOString().split("T")[0];
    const status = typeof body?.status === "string" ? body.status.toLowerCase() : null;

    if (!employeeId || !status || !["present", "absent", "late", "remote", "leave"].includes(status)) {
      return errorResponse("employeeId and a valid status are required", 400);
    }

    await ensureHrTables(sql);

    const [emp] = await sql`
      select name from admin_employees
      where tenant_slug = ${context.tenantSlug} and id = ${employeeId}
      limit 1
    `;

    await sql`
      insert into attendance_records (
        id, tenant_id, employee_id, work_date, attendance_status, employee_name,
        check_in_time, check_out_time, notes, work_mode, created_at, updated_at
      ) values (
        ${randomUUID()}, ${context.tenantSlug}, ${employeeId}, ${date}, ${status},
        ${(emp as any)?.name ?? null}, ${body.checkInTime ?? null},
        ${body.checkOutTime ?? null}, ${body.notes ?? null}, ${body.workMode ?? null},
        now(), now()
      )
      on conflict (tenant_id, employee_id, work_date)
      do update set
        attendance_status = ${status},
        employee_name = coalesce(excluded.employee_name, attendance_records.employee_name),
        check_in_time = coalesce(excluded.check_in_time, attendance_records.check_in_time),
        check_out_time = coalesce(excluded.check_out_time, attendance_records.check_out_time),
        notes = coalesce(excluded.notes, attendance_records.notes),
        work_mode = coalesce(excluded.work_mode, attendance_records.work_mode),
        updated_at = now()
    `;

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Attendance POST error:", error);
    return errorResponse("Failed to mark attendance", 500);
  }
}
