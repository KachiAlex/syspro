import { NextRequest, NextResponse } from "next/server";
import {
  generatePnLReport,
  generatePnLCSV,
} from "@/lib/finance/reports-db";
import { ReportFilters } from "@/lib/finance/assets-reports";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Get tenant ID (required)
    const tenantIdParam = searchParams.get("tenantId");
    if (!tenantIdParam) {
      return NextResponse.json(
        { success: false, error: "tenantId is required" },
        { status: 400 }
      );
    }

    const tenantId = BigInt(tenantIdParam);
    const format = searchParams.get("format") || "json";

    // Parse date parameters
    const periodStart = searchParams.get("periodStart")
      ? new Date(searchParams.get("periodStart")!)
      : new Date(new Date().getFullYear(), 0, 1); // Jan 1 of current year

    const periodEnd = searchParams.get("periodEnd")
      ? new Date(searchParams.get("periodEnd")!)
      : new Date();

    // Validate dates
    if (periodStart > periodEnd) {
      return NextResponse.json(
        { success: false, error: "periodStart must be before periodEnd" },
        { status: 400 }
      );
    }

    // Generate report
    const filters: ReportFilters = {
      tenantId,
      periodStart,
      periodEnd,
    };

    const report = await generatePnLReport(filters);

    if (!report) {
      return NextResponse.json(
        { success: false, error: "Failed to generate P&L report" },
        { status: 500 }
      );
    }

    // Handle CSV export
    if (format === "csv") {
      const csv = generatePnLCSV(report);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="pnl-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Return JSON
    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Error generating P&L report:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
