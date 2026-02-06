import { NextRequest, NextResponse } from "next/server";

import { getRevenueForecast, getRevOpsOverview, getSalesPerformanceSnapshot } from "@/lib/revops-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug")?.trim() || "default";

  const overview = getRevOpsOverview(tenantSlug);
  const forecast = getRevenueForecast(tenantSlug);
  const { snapshot, targets } = getSalesPerformanceSnapshot(tenantSlug);

  return NextResponse.json({ overview, forecast, snapshot, targets });
}
