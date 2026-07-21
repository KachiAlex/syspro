import { NextRequest, NextResponse } from "next/server";
import { decodeEmployeeToken } from "@/lib/hr/auth";
import { sql as SQL } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import { z } from "zod";

const updateStatusSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "overdue"]),
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
  const token = request.cookies.get("employee_session")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const session = decodeEmployeeToken(token);
  if (!session) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

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

    await sql`
      UPDATE admin_staff_tasks
      SET status = ${newStatus}, updated_at = now()
      WHERE id = ${taskId} AND tenant_slug = ${session.tenantSlug}
    `;

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
  const token = request.cookies.get("employee_session")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const session = decodeEmployeeToken(token);
  if (!session) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

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
