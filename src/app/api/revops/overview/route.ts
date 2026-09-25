import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

import { getRevenueForecast, getRevOpsOverview, getSalesPerformanceSnapshot } from "@/lib/revops-data";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const tenantSlug = context.tenantSlug;

  try {
    const overview = await getRevOpsOverview(tenantSlug);
    const forecast = await getRevenueForecast(tenantSlug);
    const { snapshot, targets } = await getSalesPerformanceSnapshot(tenantSlug);

    return NextResponse.json({ overview, forecast, snapshot, targets });
  } catch (error) {
    console.error("Failed to load RevOps overview", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load overview" }, { status: 500 });
  }
}
