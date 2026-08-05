import { NextRequest, NextResponse } from "next/server";
import {
  generatePnLReport,
  generateBalanceSheet,
  generateCashFlowReport,
  generateAgedReceivablesReport,
} from "@/lib/finance/reports-db";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenantSlug");
    const type = url.searchParams.get("type") || "pl";
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    if (!tenantSlug) {
      return NextResponse.json(
        { error: "tenantSlug is required" },
        { status: 400 }
      );
    }

    const filters = {
      tenantSlug,
      periodStart: startDate ? new Date(startDate) : undefined,
      periodEnd: endDate ? new Date(endDate) : undefined,
    };

    let report: any = null;
    switch (type) {
      case "pl":
        report = await generatePnLReport(filters);
        break;
      case "balance":
        report = await generateBalanceSheet(filters);
        break;
      case "cashflow":
        report = await generateCashFlowReport(filters);
        break;
      case "aged":
        report = await generateAgedReceivablesReport(filters);
        break;
      default:
        report = await generatePnLReport(filters);
    }

    return NextResponse.json({ report });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Reports generation failed:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to generate report", details: errorMessage },
      { status: 500 }
    );
  }
}
