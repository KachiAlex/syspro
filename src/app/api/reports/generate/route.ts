import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { createReport } from "@/lib/reporting/db";

export async function POST(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "write");
    const body = await request.json().catch(() => ({}));

    const { module, reportType, dateRange, format, filters, includeCharts, name } = body;
    if (!module || !reportType) {
      return NextResponse.json({ error: "module and reportType are required" }, { status: 400 });
    }

    const reportName = name || `${module.charAt(0).toUpperCase() + module.slice(1)} ${reportType} Report`;
    const created = await createReport({
      tenantSlug,
      name: reportName,
      reportType,
      definition: { module, dateRange, includeCharts: includeCharts ?? false, format: format || "pdf" },
      filters: filters || {},
      schedule: null,
      enabled: true,
    });

    const report = {
      id: created.id,
      title: created.name,
      type: created.reportType,
      module,
      dateRange: dateRange || { start: "", end: "" },
      generatedBy: created.tenantSlug,
      generatedAt: created.createdAt,
      status: "ready" as const,
      fileUrl: "",
      format: format || "pdf",
      size: "0 KB",
    };

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error("Report generate failed", error);
    const message = error instanceof Error ? error.message : "Unable to generate report";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
