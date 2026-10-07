export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { decodeEmployeeToken, resolveEmployeeSession } from "@/lib/hr/auth";
import { sql as SQL } from "@/lib/sql-client";

/**
 * GET /api/hr/employees/portal/attendance
 * Returns the logged-in employee's attendance records.
 */
export async function GET(request: NextRequest) {
  const session = resolveEmployeeSession(request); if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") || "30"), 100);
    const offset = Number(url.searchParams.get("offset") || "0");

    const rows = await SQL`
      select id, work_date as date, attendance_status as status,
             check_in_time as check_in, check_out_time as check_out, notes, created_at
      from attendance_records
      where tenant_id = ${session.tenantSlug}
        and employee_id = ${session.id}
      order by work_date desc
      limit ${limit} offset ${offset}
    `;

    return NextResponse.json({ records: rows || [] });
  } catch (error) {
    console.error("Portal attendance error:", error);
    return NextResponse.json({ error: "Failed to load attendance" }, { status: 500 });
  }
}
