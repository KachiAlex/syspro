import { NextRequest, NextResponse } from "next/server";
import {
  generateGeneralLedger,
  generateGeneralLedgerCSV,
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
    const accountCode = searchParams.get("accountCode") || undefined;

    const periodStart = searchParams.get("periodStart")
      ? new Date(searchParams.get("periodStart")!)
      : new Date(new Date().getFullYear(), 0, 1);

    const periodEnd = searchParams.get("periodEnd")
      ? new Date(searchParams.get("periodEnd")!)
      : new Date();

    if (periodStart > periodEnd) {
      return NextResponse.json(
        { success: false, error: "periodStart must be before periodEnd" },
        { status: 400 }
      );
    }

    const filters: ReportFilters & { accountCode?: string } = {
      tenantSlug,
      periodStart,
      periodEnd,
      accountCode,
    };

    const report = await generateGeneralLedger(filters);

    if (!report) {
      return NextResponse.json(
        { success: false, error: "Failed to generate general ledger" },
        { status: 500 }
      );
    }

    if (format === "csv") {
      const csv = generateGeneralLedgerCSV(report);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="general-ledger-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Error generating general ledger:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
