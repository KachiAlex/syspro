import { NextRequest, NextResponse } from "next/server";
import {
  drillDownToJournalDetails,
} from "@/lib/finance/reports-db";
import { ReportFilters } from "@/lib/finance/assets-reports";

export async function GET(
  request: NextRequest,
  context: any
) {
  const { params } = context;
  try {
    const searchParams = request.nextUrl.searchParams;

    const tenantSlug = searchParams.get("tenantSlug");
    if (!tenantSlug) {
      return NextResponse.json(
        { success: false, error: "tenantSlug is required" },
        { status: 400 }
      );
    }

    const accountCode = params.accountId;

    const periodStart = searchParams.get("periodStart")
      ? new Date(searchParams.get("periodStart")!)
      : undefined;

    const periodEnd = searchParams.get("periodEnd")
      ? new Date(searchParams.get("periodEnd")!)
      : undefined;

    if (periodStart && periodEnd && periodStart > periodEnd) {
      return NextResponse.json(
        { success: false, error: "periodStart must be before periodEnd" },
        { status: 400 }
      );
    }

    const filters: ReportFilters = {
      tenantSlug,
      periodStart,
      periodEnd,
    };

    const details = await drillDownToJournalDetails(accountCode, filters);

    return NextResponse.json({
      success: true,
      data: details,
    });
  } catch (error) {
    console.error("Error getting journal details:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
