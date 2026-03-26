import { NextRequest, NextResponse } from "next/server";
import {
  generateBalanceSheet,
  generateBalanceSheetCSV,
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

    // Parse date parameter
    const asOfDate = searchParams.get("asOfDate")
      ? new Date(searchParams.get("asOfDate")!)
      : new Date();

    // Generate report
    const filters: ReportFilters = {
      tenantId,
      periodEnd: asOfDate,
    };

    const report = await generateBalanceSheet(filters);

    if (!report) {
      return NextResponse.json(
        { success: false, error: "Failed to generate balance sheet" },
        { status: 500 }
      );
    }

    // Handle CSV export
    if (format === "csv") {
      const csv = generateBalanceSheetCSV(report);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="balance-sheet-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Return JSON
    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Error generating balance sheet:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
