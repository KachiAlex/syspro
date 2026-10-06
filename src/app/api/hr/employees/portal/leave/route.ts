export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { resolveEmployeeSession } from "@/lib/hr/auth";
import { sql as SQL } from "@/lib/sql-client";
import { ensureHrTables, insertNotification } from "@/lib/hr/db";
import { z } from "zod";

function daysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

/**
 * GET /api/hr/employees/portal/leave
 * Returns the logged-in employee's leave requests (admin_leave — the same
 * table the tenant-admin leave tab reads).
 */
export async function GET(request: NextRequest) {
  const session = resolveEmployeeSession(request); if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    try { await ensureHrTables(SQL); } catch (e) { console.error("ensureHrTables failed (non-fatal):", (e as any)?.message); }

    const employeeRole = (session.role || "staff").toLowerCase();
    const isHOD = employeeRole === "hod" || employeeRole === "head_of_department";

    const rows = await SQL`
      select id, leave_type, start_date, end_date, reason, status,
             created_at, reviewed_at, reviewer_comment, approved_by
      from admin_leave
      where tenant_slug = ${session.tenantSlug}
        and employee_id = ${session.id}
      order by created_at desc
      limit 50
    `;

    // Leave balances for the current year
    const year = new Date().getUTCFullYear();
    const balances = await SQL`
      select leave_type, entitled, used, pending, carried_over
      from admin_leave_balances
      where tenant_slug = ${session.tenantSlug}
        and employee_id = ${session.id} and year = ${year}
    `;

    // If HOD, also fetch pending leave requests from their department
    let pendingApprovals: any[] = [];
    if (isHOD) {
      try {
        const empInfo = await SQL`
          SELECT department_id FROM admin_employees
          WHERE id = ${session.id} AND tenant_slug = ${session.tenantSlug}
          LIMIT 1
        `;
        const deptId = empInfo[0]?.department_id;
        if (deptId) {
          pendingApprovals = await SQL`
            SELECT lr.*, emp.name as employee_name, emp.job_title as employee_job_title
            FROM admin_leave lr
            JOIN admin_employees emp ON lr.employee_id = emp.id
            WHERE lr.tenant_slug = ${session.tenantSlug}
              AND lr.status = 'pending'
              AND lr.employee_id != ${session.id}
              AND emp.department_id = ${deptId}
            ORDER BY lr.created_at DESC
            LIMIT 50
          `;
        }
      } catch (e) {
        console.error("Portal leave approvals query failed:", (e as any)?.message);
      }
    }

    return NextResponse.json({ requests: rows || [], balances: balances || [], pendingApprovals, isHOD });
  } catch (error) {
    console.error("Portal leave error:", error);
    return NextResponse.json({ error: "Failed to load leave requests" }, { status: 500 });
  }
}

const createSchema = z.object({
  leaveType: z.enum(["annual", "sick", "personal", "maternity", "paternity", "unpaid"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(1).max(500),
});

/**
 * POST /api/hr/employees/portal/leave
 * Submit a new leave request (admin_leave + balance tracking).
 */
export async function POST(request: NextRequest) {
  const session = resolveEmployeeSession(request); if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    try { await ensureHrTables(SQL); } catch (e) { console.error("ensureHrTables failed (non-fatal):", (e as any)?.message); }
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { leaveType, startDate, endDate, reason } = parsed.data;
    const days = daysBetween(startDate, endDate);
    const year = new Date(startDate).getUTCFullYear();

    // Reject requests that exceed the remaining balance (unpaid is untracked)
    if (leaveType !== "unpaid") {
      const [bal] = await SQL`
        select entitled, used, pending, carried_over from admin_leave_balances
        where tenant_slug = ${session.tenantSlug} and employee_id = ${session.id}
          and leave_type = ${leaveType} and year = ${year}
        limit 1
      `;
      if (bal) {
        const remaining =
          Number(bal.entitled) + Number(bal.carried_over) - Number(bal.used) - Number(bal.pending);
        if (days > remaining) {
          return NextResponse.json(
            { error: `Insufficient ${leaveType} leave balance: ${days} day(s) requested, ${remaining} remaining` },
            { status: 400 }
          );
        }
      }
    }

    const id = randomUUID();
    await SQL`
      insert into admin_leave
        (id, tenant_slug, employee_id, employee_name, leave_type, start_date, end_date, reason, status, created_at, updated_at)
      values
        (${id}, ${session.tenantSlug}, ${session.id}, ${session.name},
         ${leaveType}, ${startDate}, ${endDate}, ${reason}, 'pending', now(), now())
    `;

    // Track pending days against the balance
    await SQL`
      insert into admin_leave_balances (
        id, tenant_slug, employee_id, employee_name, leave_type, year, entitled, pending
      ) values (
        ${randomUUID()}, ${session.tenantSlug}, ${session.id}, ${session.name},
        ${leaveType}, ${year}, 0, ${days}
      )
      on conflict (tenant_slug, employee_id, leave_type, year)
      do update set pending = admin_leave_balances.pending + ${days}, updated_at = now()
    `;

    // Notify HODs in the same department about the new leave request
    try {
      const empInfo = await SQL`SELECT department_id FROM admin_employees WHERE id = ${session.id} AND tenant_slug = ${session.tenantSlug} LIMIT 1`;
      const deptId = empInfo[0]?.department_id;
      if (deptId) {
        const hods = await SQL`
          SELECT id FROM admin_employees
          WHERE tenant_slug = ${session.tenantSlug}
            AND department_id = ${deptId}
            AND role IN ('hod', 'head_of_department')
            AND id != ${session.id}
        `;
        for (const hod of hods) {
          await insertNotification({
            tenantSlug: session.tenantSlug,
            employeeId: hod.id,
            type: 'info',
            category: 'hr',
            title: 'New Leave Request',
            message: `${session.name} requested ${leaveType} leave from ${startDate} to ${endDate}`,
            actionUrl: '/employee/dashboard?tab=leave',
          });
        }
      }
    } catch (e) { console.error('Leave notification to HOD failed:', (e as any)?.message); }

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error) {
    console.error("Portal leave create error:", error);
    return NextResponse.json({ error: "Failed to submit leave request" }, { status: 500 });
  }
}

const approveSchema = z.object({
  leaveId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  comment: z.string().max(500).optional(),
});

/**
 * PATCH /api/hr/employees/portal/leave
 * HOD or HR approves/rejects a leave request (updates balances).
 */
export async function PATCH(request: NextRequest) {
  const session = resolveEmployeeSession(request); if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const employeeRole = (session.role || "staff").toLowerCase();
  const isHOD = employeeRole === "hod" || employeeRole === "head_of_department";
  const isHR = employeeRole === "hr" || employeeRole === "hr_admin" || employeeRole === "hr_manager";

  if (!isHOD && !isHR) {
    return NextResponse.json({ error: "Only HODs and HR can approve leave" }, { status: 403 });
  }

  try {
    try { await ensureHrTables(SQL); } catch (e) { console.error("ensureHrTables failed (non-fatal):", (e as any)?.message); }
    const body = await request.json();
    const parsed = approveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { leaveId, action, comment } = parsed.data;
    const newStatus = action === "approve" ? "approved" : "rejected";

    const leaveRows = await SQL`
      SELECT lr.id, lr.employee_id, lr.employee_name, lr.leave_type, lr.start_date, lr.end_date, lr.status, emp.department_id
      FROM admin_leave lr
      LEFT JOIN admin_employees emp ON emp.id = lr.employee_id AND emp.tenant_slug = lr.tenant_slug
      WHERE lr.id = ${leaveId} AND lr.tenant_slug = ${session.tenantSlug}
      LIMIT 1
    `;
    if (!leaveRows.length) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }
    const leave = leaveRows[0] as any;

    // HODs (not HR) can only approve leave from their own department
    if (isHOD && !isHR) {
      const empInfo = await SQL`
        SELECT department_id FROM admin_employees
        WHERE id = ${session.id} AND tenant_slug = ${session.tenantSlug}
        LIMIT 1
      `;
      if (empInfo[0]?.department_id !== leave.department_id) {
        return NextResponse.json({ error: "You can only approve leave from your department" }, { status: 403 });
      }
    }

    await SQL`
      UPDATE admin_leave
      SET status = ${newStatus},
          approved_by = ${session.name},
          reviewer_id = ${session.id},
          reviewer_comment = ${comment || null},
          reviewed_at = now(),
          updated_at = now()
      WHERE id = ${leaveId} AND tenant_slug = ${session.tenantSlug}
    `;

    // Balance maintenance on decision
    if (leave.status === "pending") {
      const days = daysBetween(
        leave.start_date instanceof Date ? leave.start_date.toISOString().split("T")[0] : String(leave.start_date),
        leave.end_date instanceof Date ? leave.end_date.toISOString().split("T")[0] : String(leave.end_date)
      );
      const year = new Date(leave.start_date).getUTCFullYear();
      if (newStatus === "approved") {
        await SQL`
          update admin_leave_balances
          set pending = greatest(0, pending - ${days}),
              used = used + ${days},
              updated_at = now()
          where tenant_slug = ${session.tenantSlug} and employee_id = ${leave.employee_id}
            and leave_type = ${leave.leave_type} and year = ${year}
        `;
      } else {
        await SQL`
          update admin_leave_balances
          set pending = greatest(0, pending - ${days}), updated_at = now()
          where tenant_slug = ${session.tenantSlug} and employee_id = ${leave.employee_id}
            and leave_type = ${leave.leave_type} and year = ${year}
        `;
      }
    }

    // Notify the employee about the decision
    try {
      await insertNotification({
        tenantSlug: session.tenantSlug,
        employeeId: leave.employee_id,
        type: action === 'approve' ? 'success' : 'warning',
        category: 'hr',
        title: `Leave ${action === 'approve' ? 'Approved' : 'Rejected'}`,
        message: `Your leave request has been ${newStatus} by ${session.name}${comment ? ': ' + comment : ''}`,
        actionUrl: '/employee/dashboard?tab=leave',
      });
    } catch (e) { console.error('Leave notification to employee failed:', (e as any)?.message); }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error: any) {
    console.error("Portal leave approve error:", error?.message);
    return NextResponse.json({ error: "Failed to update leave" }, { status: 500 });
  }
}
