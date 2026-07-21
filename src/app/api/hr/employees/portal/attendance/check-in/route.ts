import { NextRequest, NextResponse } from "next/server";
import { decodeEmployeeToken } from "@/lib/hr/auth";
import { sql as SQL } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import { randomUUID } from "crypto";

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
    const sql = SQL;
    await ensureHrTables(sql);

    const body = await request.json().catch(() => ({}));
    const action = body.action as "check_in" | "check_out" | undefined;

    const today = new Date().toISOString().split("T")[0];
    const now = new Date().toLocaleTimeString("en-US", { hour12: false });

    // Check if there's already an attendance record for today
    const existing = await sql`
      SELECT id, check_in, check_out, status FROM admin_attendance
      WHERE tenant_slug = ${session.tenantSlug}
        AND employee_id = ${session.id}
        AND date = ${today}
      LIMIT 1
    `;

    if (action === "check_in") {
      if (existing.length > 0 && existing[0].check_in) {
        return NextResponse.json(
          { error: "Already checked in today", record: existing[0] },
          { status: 400 }
        );
      }

      const hour = new Date().getHours();
      const status = hour >= 9 ? "late" : "present";

      if (existing.length > 0) {
        // Update existing record (maybe was created by admin as absent)
        await sql`
          UPDATE admin_attendance
          SET check_in = ${now}, status = ${status}
          WHERE id = ${existing[0].id}
        `;
        const updated = await sql`SELECT * FROM admin_attendance WHERE id = ${existing[0].id}`;
        return NextResponse.json({ success: true, record: updated[0] });
      }

      const id = randomUUID();
      await sql`
        INSERT INTO admin_attendance (id, tenant_slug, employee_id, employee_name, date, status, check_in)
        VALUES (${id}, ${session.tenantSlug}, ${session.id}, ${session.name}, ${today}, ${status}, ${now})
      `;
      const record = await sql`SELECT * FROM admin_attendance WHERE id = ${id}`;
      return NextResponse.json({ success: true, record: record[0] });
    }

    if (action === "check_out") {
      if (existing.length === 0 || !existing[0].check_in) {
        return NextResponse.json(
          { error: "You must check in first before checking out" },
          { status: 400 }
        );
      }
      if (existing[0].check_out) {
        return NextResponse.json(
          { error: "Already checked out today", record: existing[0] },
          { status: 400 }
        );
      }

      await sql`
        UPDATE admin_attendance
        SET check_out = ${now}
        WHERE id = ${existing[0].id}
      `;
      const updated = await sql`SELECT * FROM admin_attendance WHERE id = ${existing[0].id}`;
      return NextResponse.json({ success: true, record: updated[0] });
    }

    return NextResponse.json({ error: "Invalid action. Use 'check_in' or 'check_out'." }, { status: 400 });
  } catch (error) {
    console.error("Attendance action error:", error);
    return NextResponse.json({ error: "Failed to record attendance" }, { status: 500 });
  }
}

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
    const sql = SQL;
    await ensureHrTables(sql);

    const today = new Date().toISOString().split("T")[0];

    // Get today's record
    const todayRecord = await sql`
      SELECT * FROM admin_attendance
      WHERE tenant_slug = ${session.tenantSlug}
        AND employee_id = ${session.id}
        AND date = ${today}
      LIMIT 1
    `;

    // Get recent records
    const recent = await sql`
      SELECT id, date, status, check_in, check_out, notes, created_at
      FROM admin_attendance
      WHERE tenant_slug = ${session.tenantSlug}
        AND employee_id = ${session.id}
      ORDER BY date DESC
      LIMIT 30
    `;

    return NextResponse.json({
      today: todayRecord[0] || null,
      records: recent,
    });
  } catch (error) {
    console.error("Attendance fetch error:", error);
    return NextResponse.json({ error: "Failed to load attendance" }, { status: 500 });
  }
}
