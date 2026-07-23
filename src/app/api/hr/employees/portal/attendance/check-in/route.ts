import { NextRequest, NextResponse } from "next/server";
import { decodeEmployeeToken, resolveEmployeeSession } from "@/lib/hr/auth";
import { sql as SQL } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  const session = resolveEmployeeSession(request); if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const sql = SQL;
    await ensureHrTables(sql);

    const body = await request.json().catch(() => ({}));
    const action = body.action as "check_in" | "check_out" | undefined;
    const latitude = typeof body.latitude === 'number' ? body.latitude : null;
    const longitude = typeof body.longitude === 'number' ? body.longitude : null;

    // Add location columns if they don't exist
    try {
      await sql`alter table admin_attendance add column if not exists check_in_lat numeric(10,7)`;
      await sql`alter table admin_attendance add column if not exists check_in_lng numeric(10,7)`;
      await sql`alter table admin_attendance add column if not exists check_out_lat numeric(10,7)`;
      await sql`alter table admin_attendance add column if not exists check_out_lng numeric(10,7)`;
    } catch (e) { /* ignore migration errors */ }

    const today = new Date().toISOString().split("T")[0];
    const now = new Date().toLocaleTimeString("en-US", { hour12: false });

    // Check if there's already an attendance record for today
    const existing = await sql`
      SELECT * FROM admin_attendance
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
          SET check_in = ${now}, status = ${status}, check_in_lat = ${latitude}, check_in_lng = ${longitude}
          WHERE id = ${existing[0].id}
        `;
        const updated = await sql`SELECT * FROM admin_attendance WHERE id = ${existing[0].id}`;
        return NextResponse.json({ success: true, record: updated[0] });
      }

      const id = randomUUID();
      await sql`
        INSERT INTO admin_attendance (id, tenant_slug, employee_id, employee_name, date, status, check_in, check_in_lat, check_in_lng)
        VALUES (${id}, ${session.tenantSlug}, ${session.id}, ${session.name}, ${today}, ${status}, ${now}, ${latitude}, ${longitude})
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
        SET check_out = ${now}, check_out_lat = ${latitude}, check_out_lng = ${longitude}
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
  const session = resolveEmployeeSession(request); if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

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
