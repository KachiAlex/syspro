import { NextRequest, NextResponse } from "next/server";

import { calculateAttributionForTenant } from "@/lib/revops/service";
import type { AttributionModel } from "@/lib/revops/attribution";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get("tenantSlug")?.trim() || "default";
    const model = (searchParams.get("model") as AttributionModel | null) ?? "linear";
    const summary = await calculateAttributionForTenant(tenantSlug, model);
    return NextResponse.json({ summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to calculate attribution";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
