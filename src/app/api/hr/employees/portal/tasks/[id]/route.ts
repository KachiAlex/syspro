import { NextRequest, NextResponse } from "next/server";
import { decodeEmployeeToken, resolveEmployeeSession } from "@/lib/hr/auth";
import { sql as SQL } from "@/lib/sql-client";
import { ensureHrTables, insertNotification } from "@/lib/hr/db";
import { z } from "zod";

const updateStatusSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "overdue"]),
  completionNote: z.string().max(1000).optional(),
});

/**
 * PATCH /api/hr/employees/portal/tasks/[id]
 * Employee updates the status of their own task.
 * HOD can also update status of tasks in their department.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = resolveEmployeeSession(request); if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const sql = SQL;
    try { await ensureHrTables(sql); } catch (e) { console.error("ensureHrTables failed (non-fatal):", (e as any)?.message); }

    const body = await request.json();
    const parsed = updateStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const taskId = params.id;
    const newStatus = parsed.data.status;
    const completionNote = parsed.data.completionNote;
    const employeeRole = (session.role || "staff").toLowerCase();
    const isHOD = employeeRole === "hod" || employeeRole === "head_of_department";

    if (isHOD) {
      // HOD can update any task in their department
      const empInfo = await sql`
        SELECT department_id FROM admin_employees
        WHERE id = ${session.id} AND tenant_slug = ${session.tenantSlug}
        LIMIT 1
      `;
      const hodDept = empInfo[0]?.department_id;

      const taskInfo = await sql`
        SELECT t.employee_id, e.department_id
        FROM admin_staff_tasks t
        JOIN admin_employees e ON t.employee_id = e.id
        WHERE t.id = ${taskId} AND t.tenant_slug = ${session.tenantSlug}
        LIMIT 1
      `;

      if (taskInfo.length === 0) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      if (taskInfo[0].department_id !== hodDept) {
        return NextResponse.json({ error: "You can only update tasks in your department" }, { status: 403 });
      }
    } else {
      // Staff: verify task belongs to them
      const taskInfo = await sql`
        SELECT employee_id FROM admin_staff_tasks
        WHERE id = ${taskId} AND tenant_slug = ${session.tenantSlug}
        LIMIT 1
      `;

      if (taskInfo.length === 0) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      if (taskInfo[0].employee_id !== session.id) {
        return NextResponse.json({ error: "You can only update your own tasks" }, { status: 403 });
      }
    }

    // Get task info for notification
    let taskEmployeeId: string | null = null;
    let taskTitle: string | null = null;
    try {
      const taskRow = await sql`SELECT employee_id, title FROM admin_staff_tasks WHERE id = ${taskId} AND tenant_slug = ${session.tenantSlug} LIMIT 1`;
      taskEmployeeId = taskRow[0]?.employee_id || null;
      taskTitle = taskRow[0]?.title || null;
    } catch {}

    if (completionNote && newStatus === 'completed') {
      try {
        await sql`
          UPDATE admin_staff_tasks
          SET status = ${newStatus}, completion_note = ${completionNote}, completed_at = now(), updated_at = now()
          WHERE id = ${taskId} AND tenant_slug = ${session.tenantSlug}
        `;
      } catch (e) {
        // Fallback without completion_note column
        await sql`
          UPDATE admin_staff_tasks
          SET status = ${newStatus}, updated_at = now()
          WHERE id = ${taskId} AND tenant_slug = ${session.tenantSlug}
        `;
      }
    } else {
      await sql`
        UPDATE admin_staff_tasks
        SET status = ${newStatus}, updated_at = now()
        WHERE id = ${taskId} AND tenant_slug = ${session.tenantSlug}
      `;
    }

    // Notify HODs when an employee completes a task
    if (newStatus === 'completed' && taskEmployeeId && taskTitle) {
      try {
        const empInfo = await sql`SELECT department_id FROM admin_employees WHERE id = ${taskEmployeeId} AND tenant_slug = ${session.tenantSlug} LIMIT 1`;
        const deptId = empInfo[0]?.department_id;
        if (deptId) {
          const hods = await sql`
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
              type: 'success',
              category: 'hr',
              title: 'Task Completed',
              message: `${session.name} completed: "${taskTitle}"`,
              actionUrl: '/employee/dashboard?tab=tasks',
            });
          }
        }
      } catch (e) { console.error('Task completion notification failed:', (e as any)?.message); }
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error: any) {
    console.error("Portal task update error:", error?.message);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

/**
 * DELETE /api/hr/employees/portal/tasks/[id]
 * HOD or HR can delete a task.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = resolveEmployeeSession(request); if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const employeeRole = (session.role || "staff").toLowerCase();
  const isHOD = employeeRole === "hod" || employeeRole === "head_of_department";
  const isHR = employeeRole === "hr" || employeeRole === "hr_admin" || employeeRole === "hr_manager";

  if (!isHOD && !isHR) {
    return NextResponse.json({ error: "Only HODs and HR can delete tasks" }, { status: 403 });
  }

  try {
    const sql = SQL;
    const taskId = params.id;

    // If HOD (not HR), verify task is in their department
    if (isHOD && !isHR) {
      const empInfo = await sql`
        SELECT department_id FROM admin_employees
        WHERE id = ${session.id} AND tenant_slug = ${session.tenantSlug}
        LIMIT 1
      `;
      const hodDept = empInfo[0]?.department_id;

      const taskInfo = await sql`
        SELECT t.employee_id, e.department_id
        FROM admin_staff_tasks t
        JOIN admin_employees e ON t.employee_id = e.id
        WHERE t.id = ${taskId} AND t.tenant_slug = ${session.tenantSlug}
        LIMIT 1
      `;

      if (taskInfo.length === 0) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      if (taskInfo[0].department_id !== hodDept) {
        return NextResponse.json({ error: "You can only delete tasks in your department" }, { status: 403 });
      }
    }

    await sql`
      DELETE FROM admin_staff_tasks
      WHERE id = ${taskId} AND tenant_slug = ${session.tenantSlug}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Portal task delete error:", error?.message);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
