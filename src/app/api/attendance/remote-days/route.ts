export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import { db } from "@/lib/sql-client";
import { ensureAttendanceVerificationTables } from "@/lib/attendance-verification";

export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");
    const _gate = await requireModuleAccess(request, "people", "read");
    if (!_gate.ok) return _gate.response;
    await ensureAttendanceVerificationTables();
    const status = new URL(request.url).searchParams.get("status");

    let query = `SELECT * FROM remote_day_requests WHERE tenant_slug = $1`;
    const values: any[] = [context.tenantSlug];
    if (status) {
      values.push(status);
      query += ` AND status = $2`;
    }
    query += ` ORDER BY work_date DESC, created_at DESC LIMIT 200`;

    const res = await db.query(query, values);
    return NextResponse.json({ requests: res.rows });
  } catch (error) {
    console.error("Remote days fetch failed:", error);
    return NextResponse.json({ error: "Failed to fetch remote day requests" }, { status: 500 });
  }
}
