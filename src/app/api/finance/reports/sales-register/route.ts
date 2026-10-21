export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { generateSalesRegister, generateRegisterCSV } from "@/lib/finance/registers";
import { ReportFilters } from "@/lib/finance/assets-reports";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantSlug = searchParams.get("tenantSlug");
    if (!tenantSlug) {
      return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
    }

    const filters: ReportFilters = {
      tenantSlug,
      periodStart: (searchParams.get("periodStart") ?? searchParams.get("startDate")) ? new Date((searchParams.get("periodStart") ?? searchParams.get("startDate"))!) : undefined,
      periodEnd: (searchParams.get("periodEnd") ?? searchParams.get("endDate")) ? new Date((searchParams.get("periodEnd") ?? searchParams.get("endDate"))!) : undefined,
    };
    const { applyBranchScope } = await import("@/lib/finance/report-scope");
    await applyBranchScope(filters, tenantSlug, (_scope as any).user?.id,
      searchParams.get("branchId") ?? searchParams.get("branch"));

    const itemWise = searchParams.get("itemWise") === "true";
    const report = await generateSalesRegister(filters, itemWise);

    if (searchParams.get("format") === "csv") {
      return new NextResponse(generateRegisterCSV(report), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="sales-register-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error("Error generating sales register:", error);
    return NextResponse.json(
      { success: false, error: (error as any)?.message ?? "Internal server error" },
      { status: (error as any)?.status ?? 500 },
    );
  }
}
