import { NextRequest, NextResponse } from "next/server";

import { getRevenueForecast } from "@/lib/revops-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug")?.trim() || "default";
  const forecast = getRevenueForecast(tenantSlug);
  return NextResponse.json({ forecast });
}
