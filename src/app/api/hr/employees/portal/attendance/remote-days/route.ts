export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { resolveEmployeeSession } from "@/lib/hr/auth";
import { db } from "@/lib/sql-client";
import { ensureAttendanceVerificationTables } from "@/lib/attendance-verification";
import { randomUUID } from "crypto";
import { isTenantSuspended } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const session = resolveEmployeeSession(request);
    if (session && (await isTenantSuspended(session.tenantSlug))) return NextResponse.json({ error: "Tenant is suspended" }, { status: 403 });
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    await ensureAttendanceVerificationTables();
    const res = await db.query(
      `SELECT * FROM remote_day_requests WHERE tenant_slug=$1 AND employee_id=$2 ORDER BY work_date DESC LIMIT 60`,
      [session.tenantSlug, session.id]
    );
    return NextResponse.json({ requests: res.rows });
  } catch (error) {
    console.error("Remote days fetch failed:", error);
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = resolveEmployeeSession(request);
    if (session && (await isTenantSuspended(session.tenantSlug))) return NextResponse.json({ error: "Tenant is suspended" }, { status: 403 });
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    await ensureAttendanceVerificationTables();
    const body = await request.json().catch(() => ({}));
    const workDate = String(body.workDate || "");
    const reason = String(body.reason || "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
      return NextResponse.json({ error: "workDate must be YYYY-MM-DD" }, { status: 400 });
    }
    const today = new Date().toISOString().split("T")[0];
    if (workDate < today) {
      return NextResponse.json({ error: "Cannot request remote days in the past" }, { status: 400 });
    }

    const id = randomUUID();
    const res = await db.query(
      `INSERT INTO remote_day_requests (id, tenant_slug, employee_id, employee_name, work_date, reason)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (tenant_slug, employee_id, work_date) DO NOTHING
       RETURNING *`,
      [id, session.tenantSlug, session.id, session.name, workDate, reason]
    );
    if (!res.rows[0]) {
      return NextResponse.json({ error: "A request for that date already exists" }, { status: 409 });
    }
    return NextResponse.json({ request: res.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Remote day request failed:", error);
    return NextResponse.json({ error: "Failed to submit request" }, { status: 500 });
  }
}
