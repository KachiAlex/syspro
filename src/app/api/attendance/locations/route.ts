import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { db } from "@/lib/sql-client";
import { ensureAttendanceVerificationTables } from "@/lib/attendance-verification";
import { randomUUID } from "crypto";

export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");
    await ensureAttendanceVerificationTables();
    const res = await db.query(
      `SELECT * FROM attendance_locations WHERE tenant_slug = $1 ORDER BY created_at`,
      [context.tenantSlug]
    );
    return NextResponse.json({ locations: res.rows });
  } catch (error) {
    console.error("Locations fetch failed:", error);
    return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    await ensureAttendanceVerificationTables();
    const body = await request.json();
    const { name, latitude, longitude, radiusM, branchId } = body;

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: "name, latitude and longitude are required" }, { status: 400 });
    }
    const radius = Math.max(50, Math.min(5000, Math.trunc(Number(radiusM) || 500)));

    const id = `loc_${randomUUID()}`;
    const res = await db.query(
      `INSERT INTO attendance_locations (id, tenant_slug, name, latitude, longitude, radius_m, branch_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, context.tenantSlug, name, lat, lng, radius, branchId ?? null]
    );
    return NextResponse.json({ location: res.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Location create failed:", error);
    return NextResponse.json({ error: "Failed to create location" }, { status: 500 });
  }
}
