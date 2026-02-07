import { NextRequest, NextResponse } from "next/server";
import {
  generateAgedPayablesReport,
  generateAgedPayablesCSV,
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

    const report = await generateAgedPayablesReport(filters);

    if (!report) {
      return NextResponse.json(
        { success: false, error: "Failed to generate aged payables report" },
        { status: 500 }
      );
    }

    // Handle CSV export
    if (format === "csv") {
      const csv = generateAgedPayablesCSV(report);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="aged-payables-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Return JSON
    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Error generating aged payables report:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
