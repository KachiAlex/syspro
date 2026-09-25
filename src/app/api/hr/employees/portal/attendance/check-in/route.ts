import { NextRequest, NextResponse } from "next/server";
import { decodeEmployeeToken, resolveEmployeeSession } from "@/lib/hr/auth";
import { sql as SQL } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import {
  ensureAttendanceVerificationTables,
  verifyCheckIn,
} from "@/lib/attendance-verification";
import { db } from "@/lib/sql-client";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  const session = resolveEmployeeSession(request); if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const sql = SQL;
    await ensureHrTables(sql);
    await ensureAttendanceVerificationTables();

    const body = await request.json().catch(() => ({}));
    const action = body.action as "check_in" | "check_out" | undefined;
    const latitude = typeof body.latitude === 'number' ? body.latitude : null;
    const longitude = typeof body.longitude === 'number' ? body.longitude : null;
    const accuracy = typeof body.accuracy === 'number' ? body.accuracy : null;
    const qrToken = typeof body.qrToken === 'string' ? body.qrToken : null;

    // Add location columns if they don't exist
    try {
      await sql`alter table if exists attendance_records add column if not exists check_in_lat numeric(10,7)`;
      await sql`alter table if exists attendance_records add column if not exists check_in_lng numeric(10,7)`;
      await sql`alter table if exists attendance_records add column if not exists check_out_lat numeric(10,7)`;
      await sql`alter table if exists attendance_records add column if not exists check_out_lng numeric(10,7)`;
    } catch (e) { /* ignore migration errors */ }

    const today = new Date().toISOString().split("T")[0];
    const nowFull = new Date().toISOString();

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
        console.log('[check-in] Already checked in. Record:', { id: existing[0].id, check_in: existing[0].check_in, status: existing[0].status, employee_id: existing[0].employee_id, date: existing[0].date });
        return NextResponse.json(
          { error: "Already checked in today", record: existing[0] },
          { status: 400 }
        );
      }

      // Resolve employee's configured work mode
      const empRows = await db.query(
        `SELECT work_mode FROM admin_employees WHERE id = $1 AND tenant_slug = $2 LIMIT 1`,
        [session.id, session.tenantSlug]
      );
      const workMode = (empRows.rows[0]?.work_mode || "ONSITE").toUpperCase();

      const verdict = await verifyCheckIn({
        tenantSlug: session.tenantSlug,
        employeeId: session.id,
        workMode,
        workDate: today,
        latitude,
        longitude,
        accuracyM: accuracy,
        qrToken,
      });

      if (!verdict.allowed) {
        return NextResponse.json({ error: verdict.error, requiresQr: verdict.method === "qr_geo" }, { status: 403 });
      }

      const hour = new Date().getHours();
      const status = hour >= 9 ? "late" : "present";

      const verificationCols = {
        method: verdict.method,
        distance: verdict.distanceM ?? null,
        accuracy,
        flagged: verdict.flagged,
        flagReason: verdict.flagReason ?? null,
        locationId: verdict.locationId ?? null,
      };

      if (existing.length > 0) {
        // Update existing record (maybe was created by admin as absent)
        const updated = await sql`
          UPDATE attendance_records
          SET check_in_time = ${nowFull}, attendance_status = ${status}, check_in_lat = ${latitude}, check_in_lng = ${longitude},
              work_mode = ${workMode}, check_in_method = ${verificationCols.method}, check_in_distance_m = ${verificationCols.distance},
              check_in_accuracy_m = ${verificationCols.accuracy}, check_in_flagged = ${verificationCols.flagged},
              flag_reason = ${verificationCols.flagReason}, location_id = ${verificationCols.locationId}, updated_at = now()
          WHERE id = ${existing[0].id}
          RETURNING *
        `;
        const viewRow = await sql`select * from admin_attendance where id = ${existing[0].id} limit 1`;
        return NextResponse.json({ success: true, record: (viewRow as any[])[0] || updated[0], flagged: verdict.flagged, flagReason: verdict.flagReason });
      }

      const id = randomUUID();
      await sql`
        INSERT INTO attendance_records (id, tenant_id, employee_id, employee_name, work_date, attendance_status, work_mode, check_in_time, check_in_lat, check_in_lng, check_in_method, check_in_distance_m, check_in_accuracy_m, check_in_flagged, flag_reason, location_id, created_at, updated_at)
        VALUES (${id}, ${session.tenantSlug}, ${session.id}, ${session.name}, ${today}, ${status}, ${workMode}, ${nowFull}, ${latitude}, ${longitude}, ${verificationCols.method}, ${verificationCols.distance}, ${verificationCols.accuracy}, ${verificationCols.flagged}, ${verificationCols.flagReason}, ${verificationCols.locationId}, now(), now())
        ON CONFLICT (tenant_id, employee_id, work_date) DO UPDATE SET
          check_in_time = excluded.check_in_time,
          attendance_status = excluded.attendance_status,
          check_in_lat = excluded.check_in_lat,
          check_in_lng = excluded.check_in_lng,
          work_mode = excluded.work_mode,
          check_in_method = excluded.check_in_method,
          check_in_distance_m = excluded.check_in_distance_m,
          check_in_accuracy_m = excluded.check_in_accuracy_m,
          check_in_flagged = excluded.check_in_flagged,
          flag_reason = excluded.flag_reason,
          location_id = excluded.location_id,
          updated_at = now()
      `;
      const inserted = await sql`select * from admin_attendance where id = ${id} limit 1`;
      return NextResponse.json({ success: true, record: (inserted as any[])[0], flagged: verdict.flagged, flagReason: verdict.flagReason });
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

      const updated = await sql`
        UPDATE attendance_records
        SET check_out_time = ${nowFull}, check_out_lat = ${latitude}, check_out_lng = ${longitude}, updated_at = now()
        WHERE id = ${existing[0].id}
        RETURNING *
      `;
      const viewRow = await sql`select * from admin_attendance where id = ${existing[0].id} limit 1`;
      return NextResponse.json({ success: true, record: (viewRow as any[])[0] || updated[0] });
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

    await ensureAttendanceVerificationTables();
    const empRows = await db.query(
      `SELECT work_mode FROM admin_employees WHERE id = $1 AND tenant_slug = $2 LIMIT 1`,
      [session.id, session.tenantSlug]
    );
    const remoteReq = await db.query(
      `SELECT work_date, status FROM remote_day_requests WHERE tenant_slug=$1 AND employee_id=$2 AND work_date >= $3 ORDER BY work_date LIMIT 10`,
      [session.tenantSlug, session.id, today]
    );

    return NextResponse.json({
      today: todayRecord[0] || null,
      records: recent,
      workMode: (empRows.rows[0]?.work_mode || "ONSITE").toUpperCase(),
      remoteRequests: remoteReq.rows,
    });
  } catch (error) {
    console.error("Attendance fetch error:", error);
    return NextResponse.json({ error: "Failed to load attendance" }, { status: 500 });
  }
}
