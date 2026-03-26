import { NextRequest, NextResponse } from "next/server";

import { getSalesPerformanceSnapshot } from "@/lib/revops-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug")?.trim() || "default";
  const payload = getSalesPerformanceSnapshot(tenantSlug);
  return NextResponse.json(payload);
}
