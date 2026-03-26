import { NextRequest, NextResponse } from "next/server";

import { getDashboardMetrics } from "@/lib/support-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug") || "default";
  const metrics = getDashboardMetrics(tenantSlug);
  return NextResponse.json({ metrics });
}
