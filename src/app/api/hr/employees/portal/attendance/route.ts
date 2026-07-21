import { NextRequest, NextResponse } from "next/server";
import { decodeEmployeeToken } from "@/lib/hr/auth";
import { sql as SQL } from "@/lib/sql-client";

/**
 * GET /api/hr/employees/portal/attendance
 * Returns the logged-in employee's attendance records.
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
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") || "30"), 100);
    const offset = Number(url.searchParams.get("offset") || "0");

    const rows = await SQL`
      select id, date, status, check_in, check_out, notes, created_at
      from admin_attendance
      where tenant_slug = ${session.tenantSlug}
        and employee_id = ${session.id}
      order by date desc
      limit ${limit} offset ${offset}
    `;

    return NextResponse.json({ records: rows || [] });
  } catch (error) {
    console.error("Portal attendance error:", error);
    return NextResponse.json({ error: "Failed to load attendance" }, { status: 500 });
  }
}
