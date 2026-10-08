export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { db } from "@/lib/sql-client";
import { datasetToCsv, executeReport } from "@/lib/reporting/execute";

import { requireModuleAccess } from "@/lib/api-auth";
export async function GET(request: NextRequest, context: any) {
    const _scope = await requireModuleAccess(request, "analytics", "read");
    if (!_scope.ok) return _scope.response;

  const { params } = context;
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "read");
    const result = await db.query<any>("select * from reports where id = $1 and tenant_slug = $2", [params.id, tenantSlug]);
    const report = result.rows?.[0];
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    const dataset = await executeReport(tenantSlug, {
      reportType: report.report_type,
      definition: report.definition,
      filters: report.filters,
    });
    const csv = datasetToCsv(dataset);
    const base64 = Buffer.from(csv).toString("base64");
    const fileUrl = `data:text/csv;base64,${base64}`;
    return NextResponse.json({ fileUrl, name: report.name });
  } catch (error) {
    console.error("Report download failed", error);
    const message = error instanceof Error ? error.message : "Unable to download report";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
