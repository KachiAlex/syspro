export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import {
  validateTenantContext,
  errorResponse,
  checkRateLimit,
  handleTenantAdminError,
} from "@/lib/tenant-admin/utils";

function normalize(row: any) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name ?? row.emp_name,
    reason: row.reason,
    lastWorkingDay: row.last_working_day instanceof Date
      ? row.last_working_day.toISOString().split("T")[0]
      : row.last_working_day,
    status: row.status,
    checklist: Array.isArray(row.checklist) ? row.checklist : [],
    notes: row.notes,
    initiatedBy: row.initiated_by,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

/**
 * PATCH /api/tenant/offboarding/[id]
 * Actions:
 *  - { checklistKey, done }            — toggle a checklist item
 *  - { action: 'complete' }            — complete offboarding (all items must be
 *                                       done); terminates the employee record
 *  - { action: 'cancel' }              — cancel an active offboarding
 *  - { reason, lastWorkingDay, notes } — update fields while active
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = validateTenantContext(request, "write");
    if (!checkRateLimit(`offb-patch-${context.tenantSlug}`, 30, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }
    await ensureHrTables(sql);

    const [row] = await sql`
      select * from admin_offboarding
      where id = ${params.id} and tenant_slug = ${context.tenantSlug}
    ` as any[];
    if (!row) return errorResponse("Offboarding record not found", 404);
    if (!["initiated", "in_progress"].includes(row.status)) {
      return errorResponse(`Cannot update a ${row.status} offboarding`, 400);
    }

    const body = await request.json().catch(() => ({}));

    if (body?.action === "cancel") {
      const [updated] = await sql`
        update admin_offboarding set status = 'cancelled', updated_at = now()
        where id = ${params.id} and tenant_slug = ${context.tenantSlug}
        returning *
      ` as any[];
      return NextResponse.json({ success: true, data: normalize(updated) });
    }

    if (body?.action === "complete") {
      const checklist = Array.isArray(row.checklist) ? row.checklist : [];
      const openItems = checklist.filter((c: any) => !c.done).map((c: any) => c.label || c.key);
      if (openItems.length && body?.force !== true) {
        return errorResponse(
          `Checklist incomplete: ${openItems.join(", ")}. Pass force: true to complete anyway.`,
          400
        );
      }

      const [updated] = await sql`
        update admin_offboarding
        set status = 'completed', completed_at = now(), updated_at = now()
        where id = ${params.id} and tenant_slug = ${context.tenantSlug}
        returning *
      ` as any[];

      // Terminate the employee — revokes portal login (auth requires active status)
      // and takes them out of payroll eligibility.
      try {
        await sql`
          update admin_employees
          set status = 'terminated',
              termination_date = coalesce(${row.last_working_day}::date, current_date),
              updated_at = now()
          where tenant_slug = ${context.tenantSlug} and id = ${row.employee_id}
        `;
      } catch {
        // termination_date column may not exist on older schemas — retry without it
        await sql`
          update admin_employees set status = 'terminated', updated_at = now()
          where tenant_slug = ${context.tenantSlug} and id = ${row.employee_id}
        `;
      }

      return NextResponse.json({ success: true, data: normalize(updated) });
    }

    // Checklist item toggle and/or field updates
    let checklist = Array.isArray(row.checklist) ? row.checklist : [];
    if (typeof body?.checklistKey === "string") {
      const key = body.checklistKey;
      const item = checklist.find((c: any) => c.key === key);
      if (!item) return errorResponse(`Unknown checklist key '${key}'`, 400);
      item.done = body?.done !== false;
      item.doneAt = item.done ? new Date().toISOString() : null;
    }

    const [updated] = await sql`
      update admin_offboarding
      set checklist = ${JSON.stringify(checklist)}::jsonb,
          reason = coalesce(${body?.reason ?? null}, reason),
          last_working_day = coalesce(${typeof body?.lastWorkingDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.lastWorkingDay) ? body.lastWorkingDay : null}, last_working_day),
          notes = coalesce(${body?.notes ?? null}, notes),
          status = case when status = 'initiated' then 'in_progress' else status end,
          updated_at = now()
      where id = ${params.id} and tenant_slug = ${context.tenantSlug}
      returning *
    ` as any[];

    return NextResponse.json({ success: true, data: normalize(updated) });
  } catch (error) {
    console.error("Offboarding PATCH error:", error);
    return handleTenantAdminError(error);
  }
}
