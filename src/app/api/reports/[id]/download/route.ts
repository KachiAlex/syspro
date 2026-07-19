import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { db } from "@/lib/sql-client";

export async function GET(request: NextRequest, context: any) {
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
    const def = report.definition || {};
    const filters = report.filters || {};
    const rows = [
      ["Report", report.name],
      ["Type", report.report_type],
      ["Module", def.module || "unknown"],
      ["Period Start", def.dateRange?.start || ""],
      ["Period End", def.dateRange?.end || ""],
      ["Generated At", report.created_at?.toISOString?.() ?? report.created_at],
    ];
    const headers = ["Field", "Value"];
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => JSON.stringify(String(v))).join(","))].join("\n");
    const base64 = Buffer.from(csv).toString("base64");
    const fileUrl = `data:text/csv;base64,${base64}`;
    return NextResponse.json({ fileUrl, name: report.name });
  } catch (error) {
    console.error("Report download failed", error);
    const message = error instanceof Error ? error.message : "Unable to download report";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
