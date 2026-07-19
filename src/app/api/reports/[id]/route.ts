import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { UpdateReportSchema, safeParse } from "@/lib/validation";
import { updateReport } from "@/lib/reporting/db";
import { db } from "@/lib/sql-client";

export async function PATCH(request: NextRequest, context: any) {
  const { params } = context;
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "write");
    const body = await request.json().catch(() => ({}));
    const validation = safeParse(UpdateReportSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid report update", details: validation.error.flatten() }, { status: 400 });
    }
    const updated = await updateReport(params.id, tenantSlug, validation.data);
    if (!updated) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    return NextResponse.json({ report: updated });
  } catch (error) {
    console.error("Report update failed", error);
    const message = error instanceof Error ? error.message : "Unable to update report";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}

export async function DELETE(request: NextRequest, context: any) {
  const { params } = context;
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "delete");
    const result = await db.query<any>("delete from reports where id = $1 and tenant_slug = $2 returning id", [params.id, tenantSlug]);
    if ((result.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: "Report deleted" });
  } catch (error) {
    console.error("Report delete failed", error);
    const message = error instanceof Error ? error.message : "Unable to delete report";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
