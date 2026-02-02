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
    
    // Return baseline snapshot on error for now
    return NextResponse.json({
      filters: {
        tenantSlug: "kreatix-default",
        regionId: undefined,
        branchId: undefined,
        timeframe: "last_7_days",
      },
      snapshot: FINANCE_BASELINE_SNAPSHOT,
      generatedAt: new Date().toISOString(),
      _note: "Returned baseline data due to database error",
    });
  }
}
