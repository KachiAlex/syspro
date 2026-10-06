export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { db } from "@/lib/sql-client";
import { ensureAttendanceVerificationTables } from "@/lib/attendance-verification";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = validateTenantContext(request, "write");
    await ensureAttendanceVerificationTables();
    const body = await request.json();
    const status = body.status;

    if (!["approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "status must be 'approved' or 'rejected'" }, { status: 400 });
    }

    const res = await db.query(
      `UPDATE remote_day_requests SET status=$1, decided_by=$2, decided_at=now() WHERE id=$3 AND tenant_slug=$4 AND status='pending' RETURNING *`,
      [status, context.userId ?? "admin", params.id, context.tenantSlug]
    );
    if (!res.rows[0]) {
      return NextResponse.json({ error: "Request not found or already decided" }, { status: 404 });
    }
    return NextResponse.json({ request: res.rows[0] });
  } catch (error) {
    console.error("Remote day decision failed:", error);
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
  }
}
