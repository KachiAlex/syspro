import { NextRequest, NextResponse } from "next/server";
import {
  drillDownToJournalDetails,
} from "@/lib/finance/reports-db";
import { ReportFilters } from "@/lib/finance/assets-reports";

export async function GET(
  request: NextRequest,
  { params }: { params: { accountId: string } }
) {
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
    const accountId = BigInt(params.accountId);

    // Parse date parameters (optional)
    const periodStart = searchParams.get("periodStart")
      ? new Date(searchParams.get("periodStart")!)
      : undefined;

    const periodEnd = searchParams.get("periodEnd")
      ? new Date(searchParams.get("periodEnd")!)
      : undefined;

    // Validate dates if both provided
    if (periodStart && periodEnd && periodStart > periodEnd) {
      return NextResponse.json(
        { success: false, error: "periodStart must be before periodEnd" },
        { status: 400 }
      );
    }

    // Get journal details
    const filters: ReportFilters = {
      tenantId,
      periodStart,
      periodEnd,
    };

    const details = await drillDownToJournalDetails(accountId, filters);

    // Return JSON
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
