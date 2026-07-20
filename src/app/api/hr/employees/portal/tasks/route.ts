import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeEmployeeToken } from "@/lib/hr/auth";
import { sql as SQL } from "@/lib/sql-client";

/**
 * GET /api/hr/employees/portal/tasks
 * Returns the logged-in employee's assigned staff tasks.
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("employee_session")?.value;

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const session = decodeEmployeeToken(token);
  if (!session) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  try {
    const rows = await SQL`
      select id, title, description, due_date, status, priority, assigned_by, created_at
      from admin_staff_tasks
      where tenant_slug = ${session.tenantSlug}
        and employee_id = ${session.id}
      order by
        case status
          when 'pending' then 0
          when 'in_progress' then 1
          when 'overdue' then 2
          when 'completed' then 3
          else 4
        end,
        due_date asc nulls last
      limit 50
    `;

    return NextResponse.json({ tasks: rows || [] });
  } catch (error) {
    console.error("Portal tasks error:", error);
    return NextResponse.json({ error: "Failed to load tasks" }, { status: 500 });
  }
}
