import { NextRequest, NextResponse } from "next/server";

import { calculateAttributionSummary, type AttributionModel } from "@/lib/revops-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug")?.trim() || "default";
  const model = (searchParams.get("model") as AttributionModel | null) ?? "linear";
  const summary = calculateAttributionSummary(tenantSlug, model);
  return NextResponse.json({ summary });
}
