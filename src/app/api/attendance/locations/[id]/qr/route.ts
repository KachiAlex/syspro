import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { db } from "@/lib/sql-client";
import { ensureAttendanceVerificationTables, issueQrToken } from "@/lib/attendance-verification";
import QRCode from "qrcode";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = validateTenantContext(request, "read");
    await ensureAttendanceVerificationTables();

    const loc = await db.query(
      `SELECT * FROM attendance_locations WHERE id = $1 AND tenant_slug = $2`,
      [params.id, context.tenantSlug]
    );
    if (!loc.rows[0]) return NextResponse.json({ error: "Location not found" }, { status: 404 });
    if (!loc.rows[0].active) return NextResponse.json({ error: "Location is inactive" }, { status: 400 });

    const base = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
    const { token, expiresAt } = await issueQrToken(params.id, context.tenantSlug, context.userId);
    const checkinUrl = `${base}/checkin?t=${encodeURIComponent(token)}`;
    const qrDataUrl = await QRCode.toDataURL(checkinUrl, { width: 512, margin: 2 });

    return NextResponse.json({ qrDataUrl, checkinUrl, expiresAt, location: loc.rows[0] });
  } catch (error) {
    console.error("QR generation failed:", error);
    return NextResponse.json({ error: "Failed to generate QR" }, { status: 500 });
  }
}
