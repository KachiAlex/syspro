import { NextRequest, NextResponse } from "next/server";
import { decodeEmployeeToken } from "@/lib/hr/auth";
import { sql as SQL } from "@/lib/sql-client";
import { z } from "zod";

/**
 * GET /api/hr/employees/portal/leave
 * Returns the logged-in employee's leave requests.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get("employee_session")?.value;

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const session = decodeEmployeeToken(token);
  if (!session) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  try {
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
      // Table may not exist yet — return empty
    }

    return NextResponse.json({ requests: rows || [] });
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
  const token = request.cookies.get("employee_session")?.value;

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const session = decodeEmployeeToken(token);
  if (!session) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  try {
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

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error) {
    console.error("Portal leave create error:", error);
    return NextResponse.json({ error: "Failed to submit leave request" }, { status: 500 });
  }
}
