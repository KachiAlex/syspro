import { NextRequest, NextResponse } from "next/server";
import { decodeEmployeeToken } from "@/lib/hr/auth";
import { sql as SQL } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import { z } from "zod";

/**
 * GET /api/hr/employees/portal/tasks
 * - Staff: returns their own assigned tasks
 * - HOD: returns tasks for all members in their department (with employee name)
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get("employee_session")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const session = decodeEmployeeToken(token);
  if (!session) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  try {
    const sql = SQL;
    try { await ensureHrTables(sql); } catch (e) { console.error("ensureHrTables failed (non-fatal):", (e as any)?.message); }

    const employeeRole = (session.role || "staff").toLowerCase();
    const isHOD = employeeRole === "hod" || employeeRole === "head_of_department";

    if (isHOD) {
      // HOD: get tasks for all department members
      const empInfo = await sql`
        SELECT department_id FROM admin_employees
        WHERE id = ${session.id} AND tenant_slug = ${session.tenantSlug}
        LIMIT 1
      `;
      const deptId = empInfo[0]?.department_id;

      if (deptId) {
        let rows: any[] = [];
        try {
          rows = await sql`
            SELECT t.id, t.employee_id, t.title, t.description, t.expected_outcome,
                   t.weight, t.is_kpi, t.frequency, t.due_date, t.status,
                   t.assigned_by, t.created_at, t.updated_at,
                   e.name as employee_name, e.job_title as employee_job_title
            FROM admin_staff_tasks t
            JOIN admin_employees e ON t.employee_id = e.id
            WHERE t.tenant_slug = ${session.tenantSlug}
              AND e.department_id = ${deptId}
            ORDER BY
              CASE t.status
                WHEN 'pending' THEN 0
                WHEN 'in_progress' THEN 1
                WHEN 'overdue' THEN 2
                WHEN 'completed' THEN 3
                ELSE 4
              END,
              t.due_date ASC NULLS LAST
            LIMIT 200
          `;
        } catch (e) {
          rows = await sql`
            SELECT t.id, t.employee_id, t.title, t.description, t.frequency,
                   t.due_date, t.status, t.assigned_by, t.created_at, t.updated_at,
                   e.name as employee_name, e.job_title as employee_job_title
            FROM admin_staff_tasks t
            JOIN admin_employees e ON t.employee_id = e.id
            WHERE t.tenant_slug = ${session.tenantSlug}
              AND e.department_id = ${deptId}
            ORDER BY t.due_date ASC NULLS LAST
            LIMIT 200
          `;
        }
        return NextResponse.json({ tasks: rows, isHOD: true });
      }
      return NextResponse.json({ tasks: [], isHOD: true });
    }

    // Staff: get own tasks
    let rows: any[] = [];
    try {
      rows = await sql`
        SELECT id, title, description, expected_outcome, weight, is_kpi,
               frequency, due_date, status, assigned_by, created_at, updated_at
        FROM admin_staff_tasks
        WHERE tenant_slug = ${session.tenantSlug}
          AND employee_id = ${session.id}
        ORDER BY
          CASE status
            WHEN 'pending' THEN 0
            WHEN 'in_progress' THEN 1
            WHEN 'overdue' THEN 2
            WHEN 'completed' THEN 3
            ELSE 4
          END,
          due_date ASC NULLS LAST
        LIMIT 100
      `;
    } catch (e) {
      rows = await sql`
        SELECT id, title, description, frequency, due_date, status, assigned_by, created_at
        FROM admin_staff_tasks
        WHERE tenant_slug = ${session.tenantSlug}
          AND employee_id = ${session.id}
        ORDER BY due_date ASC NULLS LAST
        LIMIT 100
      `;
    }

    return NextResponse.json({ tasks: rows, isHOD: false });
  } catch (error: any) {
    console.error("Portal tasks error:", error?.message);
    return NextResponse.json({ error: "Failed to load tasks" }, { status: 500 });
  }
}

const assignTaskSchema = z.object({
  employeeId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(""),
  expectedOutcome: z.string().max(1000).optional().default(""),
  weight: z.number().int().min(1).max(10).optional().default(1),
  isKpi: z.boolean().optional().default(false),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "annual", "one-time"]),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * POST /api/hr/employees/portal/tasks
 * HOD or HR assigns a task/KPI to a department member.
 */
export async function POST(request: NextRequest) {
  const token = request.cookies.get("employee_session")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const session = decodeEmployeeToken(token);
  if (!session) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const employeeRole = (session.role || "staff").toLowerCase();
  const isHOD = employeeRole === "hod" || employeeRole === "head_of_department";
  const isHR = employeeRole === "hr" || employeeRole === "hr_admin" || employeeRole === "hr_manager";

  if (!isHOD && !isHR) {
    return NextResponse.json({ error: "Only HODs and HR can assign tasks" }, { status: 403 });
  }

  try {
    const sql = SQL;
    try { await ensureHrTables(sql); } catch (e) { console.error("ensureHrTables failed (non-fatal):", (e as any)?.message); }

    const body = await request.json();
    const parsed = assignTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { randomUUID } = await import("crypto");
    const id = randomUUID();
    const d = parsed.data;

    // If HOD (not HR), verify the target employee is in their department
    if (isHOD && !isHR) {
      const empInfo = await sql`
        SELECT department_id FROM admin_employees
        WHERE id = ${session.id} AND tenant_slug = ${session.tenantSlug}
        LIMIT 1
      `;
      const hodDept = empInfo[0]?.department_id;

      const targetInfo = await sql`
        SELECT department_id FROM admin_employees
        WHERE id = ${d.employeeId} AND tenant_slug = ${session.tenantSlug}
        LIMIT 1
      `;
      const targetDept = targetInfo[0]?.department_id;

      if (hodDept !== targetDept) {
        return NextResponse.json({ error: "You can only assign tasks to members of your department" }, { status: 403 });
      }
    }

    try {
      await sql`
        INSERT INTO admin_staff_tasks
          (id, tenant_slug, employee_id, title, description, expected_outcome, weight, is_kpi, frequency, due_date, status, assigned_by)
        VALUES
          (${id}, ${session.tenantSlug}, ${d.employeeId}, ${d.title}, ${d.description || null},
           ${d.expectedOutcome || null}, ${d.weight}, ${d.isKpi}, ${d.frequency}, ${d.dueDate}, 'pending', ${session.name})
      `;
    } catch (e) {
      await sql`
        INSERT INTO admin_staff_tasks
          (id, tenant_slug, employee_id, title, description, frequency, due_date, status, assigned_by)
        VALUES
          (${id}, ${session.tenantSlug}, ${d.employeeId}, ${d.title}, ${d.description || null},
           ${d.frequency}, ${d.dueDate}, 'pending', ${session.name})
      `;
    }

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: any) {
    console.error("Portal task assign error:", error?.message);
    return NextResponse.json({ error: "Failed to assign task" }, { status: 500 });
  }
}
