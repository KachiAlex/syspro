import { NextRequest, NextResponse } from "next/server";

import { financeFiltersSchema } from "@/lib/finance/types";
import { getFinanceDashboardSnapshot } from "@/lib/finance/service";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());

    const parseResult = financeFiltersSchema.safeParse({
      tenantSlug: params.tenantSlug ?? "kreatix-default",
      regionId: params.regionId,
      branchId: params.branchId,
      timeframe: params.timeframe,
    });

    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.flatten() }, { status: 400 });
    }

    const snapshot = await getFinanceDashboardSnapshot(parseResult.data);

    return NextResponse.json({
      filters: parseResult.data,
      snapshot,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Finance dashboard API error:", error);
    
    // Return empty snapshot on error
    const emptySnapshot = {
      metrics: {
        revenue: 0,
        expenses: 0,
        profit: 0,
        margin: 0,
      },
      trend: [],
      receivables: [],
      payables: [],
      cashAccounts: [],
      expenseBreakdown: [],
    };

    return NextResponse.json({
      filters: {
        tenantSlug: "kreatix-default",
        regionId: undefined,
        branchId: undefined,
        timeframe: "last_7_days",
      },
      snapshot: emptySnapshot,
      generatedAt: new Date().toISOString(),
      _note: "Returned empty data due to error",
    });
  }
}
