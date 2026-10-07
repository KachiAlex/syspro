export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { financeFiltersSchema } from "@/lib/finance/types";
import { getFinanceDashboardSnapshot } from "@/lib/finance/service";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import { sql as SQL } from "@/lib/sql-client";

export async function GET(request: NextRequest) {
  let context: { tenantSlug: string } | undefined;
  try {
    context = validateTenantContext(request, "read");
    const _gate = await requireModuleAccess(request, "finance", "read");
    if (!_gate.ok) return _gate.response;

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

    // Event-bus aggregates: finance_events → finance_cached_summary via the
    // trg_finance_events_process trigger + cron refresh; surfaced through the
    // finance_dashboard_metrics view. Additive field — missing view never
    // breaks the snapshot.
    let eventMetrics: Record<string, unknown> | null = null;
    try {
      const rows = (await SQL`
        select * from finance_dashboard_metrics where tenant_slug = ${context.tenantSlug}
      `) as any[];
      eventMetrics = rows[0] ?? null;
    } catch (metricsError) {
      console.warn("finance_dashboard_metrics unavailable:", metricsError);
    }

    return NextResponse.json({
      filters: parseResult.data,
      snapshot,
      eventMetrics,
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
