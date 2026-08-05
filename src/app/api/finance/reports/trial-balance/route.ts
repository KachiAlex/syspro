import { NextRequest, NextResponse } from "next/server";
import {
  generateTrialBalance,
  generateTrialBalanceCSV,
} from "@/lib/finance/reports-db";
import { ReportFilters } from "@/lib/finance/assets-reports";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const tenantSlug = searchParams.get("tenantSlug");
    if (!tenantSlug) {
      return NextResponse.json(
        { success: false, error: "tenantSlug is required" },
        { status: 400 }
      );
    }

    const format = searchParams.get("format") || "json";

    const asOfDate = searchParams.get("asOfDate")
      ? new Date(searchParams.get("asOfDate")!)
      : new Date();

    const filters: ReportFilters = {
      tenantSlug,
      periodEnd: asOfDate,
    };

    const report = await generateTrialBalance(filters);

    if (!report) {
      return NextResponse.json(
        { success: false, error: "Failed to generate trial balance" },
        { status: 500 }
      );
    }

    if (format === "csv") {
      const csv = generateTrialBalanceCSV(report);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="trial-balance-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Error generating trial balance:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
