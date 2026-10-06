export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import { randomUUID } from "crypto";
import {
  validateTenantContext,
  errorResponse,
  checkRateLimit,
  handleTenantAdminError,
} from "@/lib/tenant-admin/utils";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalize(row: any) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.emp_name ?? row.employee_name,
    shiftId: row.shift_id,
    shiftName: row.shift_name,
    startTime: row.start_time,
    endTime: row.end_time,
    effectiveFrom: row.effective_from instanceof Date
      ? row.effective_from.toISOString().split("T")[0]
      : row.effective_from,
    effectiveTo: row.effective_to instanceof Date
      ? row.effective_to.toISOString().split("T")[0]
      : row.effective_to,
    createdAt: row.created_at,
  };
}

/**
 * GET /api/tenant/shifts/assignments
 * ?date=YYYY-MM-DD → roster view: assignments active on that date
 * ?employeeId=     → filter to one employee
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");
    if (!checkRateLimit(`shift-assign-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }
    await ensureHrTables(sql);

    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const employeeId = url.searchParams.get("employeeId");

    const rows = await sql`
      select a.*, e.name as emp_name, s.name as shift_name, s.start_time, s.end_time
      from admin_shift_assignments a
      join admin_shifts s on s.tenant_slug = a.tenant_slug and s.id = a.shift_id
      left join admin_employees e on e.tenant_slug = a.tenant_slug and e.id = a.employee_id
      where a.tenant_slug = ${context.tenantSlug}
        ${date && DATE_RE.test(date) ? sql`and a.effective_from <= ${date} and (a.effective_to is null or a.effective_to >= ${date})` : sql``}
        ${employeeId ? sql`and a.employee_id = ${employeeId}` : sql``}
      order by e.name asc nulls last, a.effective_from desc
    `;
    return NextResponse.json({ success: true, data: (rows as any[]).map(normalize) });
  } catch (error) {
    console.error("Shift assignments GET error:", error);
    return errorResponse("Failed to load shift assignments", 500);
  }
}

/**
 * POST /api/tenant/shifts/assignments
 * Body: { employeeId, shiftId, effectiveFrom, effectiveTo? }
 * Ends any overlapping assignment for the employee on the day before the new
 * one starts (single active assignment per employee).
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    if (!checkRateLimit(`shift-assign-post-${context.tenantSlug}`, 30, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }
    await ensureHrTables(sql);

    const body = await request.json().catch(() => ({}));
    if (!body?.employeeId || !body?.shiftId) {
      return errorResponse("employeeId and shiftId are required", 400);
    }
    if (!DATE_RE.test(body?.effectiveFrom ?? "")) {
      return errorResponse("effectiveFrom is required (YYYY-MM-DD)", 400);
    }
    if (body?.effectiveTo != null && !DATE_RE.test(body.effectiveTo)) {
      return errorResponse("effectiveTo must be YYYY-MM-DD", 400);
    }
    if (body?.effectiveTo && body.effectiveTo < body.effectiveFrom) {
      return errorResponse("effectiveTo must be on or after effectiveFrom", 400);
    }

    const [emp] = await sql`
      select id from admin_employees
      where tenant_slug = ${context.tenantSlug} and id = ${body.employeeId}
    ` as any[];
    if (!emp) return errorResponse("Employee not found", 404);

    const [shift] = await sql`
      select id from admin_shifts
      where tenant_slug = ${context.tenantSlug} and id = ${body.shiftId} and is_active
    ` as any[];
    if (!shift) return errorResponse("Shift not found or inactive", 404);

    // Close any open assignment overlapping the new one
    await sql`
      update admin_shift_assignments
      set effective_to = (${body.effectiveFrom}::date - 1), updated_at = now()
      where tenant_slug = ${context.tenantSlug} and employee_id = ${body.employeeId}
        and (effective_to is null or effective_to >= ${body.effectiveFrom}::date)
        and effective_from < ${body.effectiveFrom}::date
    `;
    // Remove future-dated assignments that would overlap
    await sql`
      delete from admin_shift_assignments
      where tenant_slug = ${context.tenantSlug} and employee_id = ${body.employeeId}
        and effective_from >= ${body.effectiveFrom}::date
    `;

    const id = randomUUID();
    const [row] = await sql`
      insert into admin_shift_assignments
        (id, tenant_slug, employee_id, shift_id, effective_from, effective_to, created_by)
      values
        (${id}, ${context.tenantSlug}, ${body.employeeId}, ${body.shiftId},
         ${body.effectiveFrom}, ${body.effectiveTo ?? null}, ${context.userId})
      returning *
    ` as any[];

    const [full] = await sql`
      select a.*, e.name as emp_name, s.name as shift_name, s.start_time, s.end_time
      from admin_shift_assignments a
      join admin_shifts s on s.tenant_slug = a.tenant_slug and s.id = a.shift_id
      left join admin_employees e on e.tenant_slug = a.tenant_slug and e.id = a.employee_id
      where a.id = ${id}
    ` as any[];
    return NextResponse.json({ success: true, data: normalize(full) }, { status: 201 });
  } catch (error) {
    console.error("Shift assignment POST error:", error);
    return handleTenantAdminError(error);
  }
}
