import { NextRequest, NextResponse } from "next/server";
import { decodeEmployeeToken, resolveEmployeeSession } from "@/lib/hr/auth";
import { sql as SQL } from "@/lib/sql-client";
import { ensureHrTables, insertNotification } from "@/lib/hr/db";
import { z } from "zod";

/**
 * GET /api/hr/employees/portal/leave
 * Returns the logged-in employee's leave requests.
 */
export async function GET(request: NextRequest) {
  const session = resolveEmployeeSession(request); if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    try { await ensureHrTables(SQL); } catch (e) { console.error("ensureHrTables failed (non-fatal):", (e as any)?.message); }

    const employeeRole = (session.role || "staff").toLowerCase();
    const isHOD = employeeRole === "hod" || employeeRole === "head_of_department";

    let rows: any[] = [];
    try {
      rows = await SQL`
        select id, leave_type, start_date, end_date, reason, status, created_at, reviewed_at, reviewer_comment
        from admin_leave_requests
        where tenant_slug = ${session.tenantSlug}
          and employee_id = ${session.id}
        order by created_at desc
        limit 50
      `;
    } catch (e) {
      console.error("Portal leave query failed:", (e as any)?.message);
    }

    // If HOD, also fetch pending leave requests from department
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
            FROM admin_leave_requests lr
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

    return NextResponse.json({ requests: rows || [], pendingApprovals, isHOD });
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
 * Submit a new leave request.
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

    const { randomUUID } = await import("crypto");
    const id = randomUUID();

    await SQL`
      insert into admin_leave_requests
        (id, tenant_slug, employee_id, employee_name, leave_type, start_date, end_date, reason, status, created_at)
      values
        (${id}, ${session.tenantSlug}, ${session.id}, ${session.name},
         ${parsed.data.leaveType}, ${parsed.data.startDate}, ${parsed.data.endDate},
         ${parsed.data.reason}, 'pending', now())
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
            message: `${session.name} requested ${parsed.data.leaveType} leave from ${parsed.data.startDate} to ${parsed.data.endDate}`,
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
 * HOD or HR approves/rejects a leave request.
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

    // If HOD (not HR), verify leave is from their department
    if (isHOD && !isHR) {
      const empInfo = await SQL`
        SELECT department_id FROM admin_employees
        WHERE id = ${session.id} AND tenant_slug = ${session.tenantSlug}
        LIMIT 1
      `;
      const hodDept = empInfo[0]?.department_id;

      const leaveInfo = await SQL`
        SELECT lr.employee_id, emp.department_id
        FROM admin_leave_requests lr
        JOIN admin_employees emp ON lr.employee_id = emp.id
        WHERE lr.id = ${leaveId} AND lr.tenant_slug = ${session.tenantSlug}
        LIMIT 1
      `;

      if (leaveInfo.length === 0) {
        return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
      }

      if (leaveInfo[0].department_id !== hodDept) {
        return NextResponse.json({ error: "You can only approve leave from your department" }, { status: 403 });
      }
    }

    // Get the employee_id for the leave request
    const leaveRow = await SQL`SELECT employee_id FROM admin_leave_requests WHERE id = ${leaveId} AND tenant_slug = ${session.tenantSlug} LIMIT 1`;

    await SQL`
      UPDATE admin_leave_requests
      SET status = ${newStatus},
          reviewer_id = ${session.id},
          reviewer_name = ${session.name},
          reviewer_comment = ${comment || null},
          reviewed_at = now()
      WHERE id = ${leaveId} AND tenant_slug = ${session.tenantSlug}
    `;

    // Notify the employee about the decision
    try {
      if (leaveRow.length > 0) {
        await insertNotification({
          tenantSlug: session.tenantSlug,
          employeeId: leaveRow[0].employee_id,
          type: action === 'approve' ? 'success' : 'warning',
          category: 'hr',
          title: `Leave ${action === 'approve' ? 'Approved' : 'Rejected'}`,
          message: `Your leave request has been ${newStatus} by ${session.name}${comment ? ': ' + comment : ''}`,
          actionUrl: '/employee/dashboard?tab=leave',
        });
      }
    } catch (e) { console.error('Leave notification to employee failed:', (e as any)?.message); }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error: any) {
    console.error("Portal leave approve error:", error?.message);
    return NextResponse.json({ error: "Failed to update leave" }, { status: 500 });
  }
}
