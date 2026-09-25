import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { db } from "@/lib/sql-client";
import { ensureAttendanceVerificationTables } from "@/lib/attendance-verification";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = validateTenantContext(request, "write");
    await ensureAttendanceVerificationTables();
    const body = await request.json();

    const fields = [
      { col: "name", val: body.name },
      { col: "latitude", val: body.latitude !== undefined ? Number(body.latitude) : undefined },
      { col: "longitude", val: body.longitude !== undefined ? Number(body.longitude) : undefined },
      { col: "radius_m", val: body.radiusM !== undefined ? Math.max(50, Math.min(5000, Math.trunc(Number(body.radiusM)))) : undefined },
      { col: "branch_id", val: body.branchId },
      { col: "active", val: body.active },
    ].filter((f) => f.val !== undefined);

    if (fields.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });

    const sets = fields.map((f, i) => `${f.col} = $${i + 1}`).join(", ");
    const res = await db.query(
      `UPDATE attendance_locations SET ${sets} WHERE id = $${fields.length + 1} AND tenant_slug = $${fields.length + 2} RETURNING *`,
      [...fields.map((f) => f.val), params.id, context.tenantSlug]
    );
    if (!res.rows[0]) return NextResponse.json({ error: "Location not found" }, { status: 404 });
    return NextResponse.json({ location: res.rows[0] });
  } catch (error) {
    console.error("Location update failed:", error);
    return NextResponse.json({ error: "Failed to update location" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = validateTenantContext(request, "delete");
    await ensureAttendanceVerificationTables();
    const res = await db.query(
      `DELETE FROM attendance_locations WHERE id = $1 AND tenant_slug = $2`,
      [params.id, context.tenantSlug]
    );
    if (res.rowCount === 0) return NextResponse.json({ error: "Location not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Location delete failed:", error);
    return NextResponse.json({ error: "Failed to delete location" }, { status: 500 });
  }
}
