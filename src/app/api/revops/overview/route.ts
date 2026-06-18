import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

import { getRevenueForecast, getRevOpsOverview, getSalesPerformanceSnapshot } from "@/lib/revops-data";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const tenantSlug = context.tenantSlug;

  const overview = getRevOpsOverview(tenantSlug);
  const forecast = getRevenueForecast(tenantSlug);
  const { snapshot, targets } = getSalesPerformanceSnapshot(tenantSlug);

  return NextResponse.json({ overview, forecast, snapshot, targets });
}
