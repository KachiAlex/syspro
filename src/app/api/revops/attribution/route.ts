export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";

import { calculateAttributionSummary, type AttributionModel } from "@/lib/revops-data";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const _gate1 = await requireModuleGate(request, "revops", "read");
  if (_gate1) return _gate1;
  const { searchParams } = new URL(request.url);
  const tenantSlug = context.tenantSlug;
  const modelParam = searchParams.get("model");
  const model = (modelParam ?? "linear") as AttributionModel;
  if (!["first_touch", "last_touch", "linear"].includes(model)) {
    return NextResponse.json({ error: "model must be first_touch, last_touch, or linear" }, { status: 400 });
  }
  try {
    const summary = await calculateAttributionSummary(tenantSlug, model);
    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Failed to calculate attribution", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to calculate attribution" }, { status: 500 });
  }
}
