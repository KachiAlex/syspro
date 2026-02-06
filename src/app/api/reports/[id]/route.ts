import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { UpdateReportSchema, safeParse } from "@/lib/validation";
import { updateReport } from "@/lib/reporting/db";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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
