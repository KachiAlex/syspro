import { NextRequest, NextResponse } from "next/server";

import { financeFiltersSchema } from "@/lib/finance/types";
import { getFinanceDashboardSnapshot } from "@/lib/finance/service";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

export async function GET(request: NextRequest) {
  let context: { tenantSlug: string } | undefined;
  try {
    context = validateTenantContext(request, "read");

    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());

    const parseResult = financeFiltersSchema.safeParse({
      tenantSlug: context.tenantSlug,
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
      metrics: [],
      trend: [],
      receivables: [],
      payables: [],
      cashAccounts: [],
      expenseBreakdown: [],
    };

    return NextResponse.json({
      filters: {
        tenantSlug: context?.tenantSlug || "unknown",
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
