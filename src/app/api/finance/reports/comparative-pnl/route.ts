import { NextRequest, NextResponse } from "next/server";
import {
  generateComparativePnL,
} from "@/lib/finance/reports-db";

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

    // Parse date parameters (all required for comparative)
    const currentPeriodStartParam = searchParams.get("currentPeriodStart");
    const currentPeriodEndParam = searchParams.get("currentPeriodEnd");
    const previousPeriodStartParam = searchParams.get("previousPeriodStart");
    const previousPeriodEndParam = searchParams.get("previousPeriodEnd");

    if (!currentPeriodStartParam || !currentPeriodEndParam || 
        !previousPeriodStartParam || !previousPeriodEndParam) {
      return NextResponse.json(
        { 
          success: false, 
          error: "currentPeriodStart, currentPeriodEnd, previousPeriodStart, and previousPeriodEnd are required" 
        },
        { status: 400 }
      );
    }

    const currentPeriodStart = new Date(currentPeriodStartParam);
    const currentPeriodEnd = new Date(currentPeriodEndParam);
    const previousPeriodStart = new Date(previousPeriodStartParam);
    const previousPeriodEnd = new Date(previousPeriodEndParam);

    // Validate dates
    if (currentPeriodStart > currentPeriodEnd) {
      return NextResponse.json(
        { success: false, error: "currentPeriodStart must be before currentPeriodEnd" },
        { status: 400 }
      );
    }

    if (previousPeriodStart > previousPeriodEnd) {
      return NextResponse.json(
        { success: false, error: "previousPeriodStart must be before previousPeriodEnd" },
        { status: 400 }
      );
    }

    // Generate report
    const report = await generateComparativePnL(
      tenantId,
      currentPeriodStart,
      currentPeriodEnd,
      previousPeriodStart,
      previousPeriodEnd
    );

    if (!report) {
      return NextResponse.json(
        { success: false, error: "Failed to generate comparative P&L report" },
        { status: 500 }
      );
    }

    // Return JSON
    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Error generating comparative P&L report:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
