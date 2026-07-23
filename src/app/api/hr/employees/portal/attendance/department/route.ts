import { NextRequest, NextResponse } from "next/server";
import { resolveEmployeeSession } from "@/lib/hr/auth";
import { sql as SQL } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";

/**
 * GET /api/hr/employees/portal/attendance/department
 * HOD: returns today's attendance for all department members
 * HR: returns today's attendance for all employees
 */
export async function GET(request: NextRequest) {
  const session = resolveEmployeeSession(request);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const employeeRole = (session.role || "staff").toLowerCase();
  const isHOD = employeeRole === "hod" || employeeRole === "head_of_department";
  const isHR = employeeRole === "hr" || employeeRole === "hr_admin" || employeeRole === "hr_manager";

  if (!isHOD && !isHR) {
    return NextResponse.json({ error: "Only HODs and HR can view department attendance" }, { status: 403 });
  }

  try {
    const sql = SQL;
    try { await ensureHrTables(sql); } catch (e) { console.error("ensureHrTables failed (non-fatal):", (e as any)?.message); }

    const today = new Date().toISOString().split("T")[0];

    let rows: any[] = [];

    if (isHOD && !isHR) {
      // HOD: get own department ID, then fetch department members' attendance
      const empInfo = await sql`
        SELECT department_id FROM admin_employees
        WHERE id = ${session.id} AND tenant_slug = ${session.tenantSlug}
        LIMIT 1
      `;
      const deptId = empInfo[0]?.department_id;

      if (!deptId) {
        return NextResponse.json({ teamAttendance: [], isHOD: true, isHR: false });
      }

      try {
        rows = await sql`
          SELECT e.id, e.name, e.job_title, e.role,
                 a.status, a.check_in, a.check_out, a.date
          FROM admin_employees e
          LEFT JOIN admin_attendance a
            ON a.employee_id = e.id AND a.tenant_slug = e.tenant_slug AND a.date = ${today}
          WHERE e.tenant_slug = ${session.tenantSlug}
            AND e.department_id = ${deptId}
            AND e.status = 'active'
          ORDER BY
            CASE WHEN a.check_in IS NULL THEN 0 ELSE 1 END,
            e.name ASC
          LIMIT 100
        `;
      } catch (e) {
        rows = await sql`
          SELECT e.id, e.name, e.job_title, e.role
          FROM admin_employees e
          WHERE e.tenant_slug = ${session.tenantSlug}
            AND e.department_id = ${deptId}
            AND e.status = 'active'
          ORDER BY e.name ASC
          LIMIT 100
        `;
      }
    } else {
      // HR: fetch all employees' attendance
      try {
        rows = await sql`
          SELECT e.id, e.name, e.job_title, e.role,
                 a.status, a.check_in, a.check_out, a.date
          FROM admin_employees e
          LEFT JOIN admin_attendance a
            ON a.employee_id = e.id AND a.tenant_slug = e.tenant_slug AND a.date = ${today}
          WHERE e.tenant_slug = ${session.tenantSlug}
            AND e.status = 'active'
          ORDER BY
            CASE WHEN a.check_in IS NULL THEN 0 ELSE 1 END,
            e.name ASC
          LIMIT 200
        `;
      } catch (e) {
        rows = await sql`
          SELECT e.id, e.name, e.job_title, e.role
          FROM admin_employees e
          WHERE e.tenant_slug = ${session.tenantSlug}
            AND e.status = 'active'
          ORDER BY e.name ASC
          LIMIT 200
        `;
      }
    }

    return NextResponse.json({ teamAttendance: rows, isHOD, isHR: isHR && !isHOD });
  } catch (error: any) {
    console.error("Department attendance error:", error?.message);
    return NextResponse.json({ error: "Failed to load department attendance" }, { status: 500 });
  }
}
