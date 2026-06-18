import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

import { calculateAttributionSummary, type AttributionModel } from "@/lib/revops-data";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const { searchParams } = new URL(request.url);
  const tenantSlug = context.tenantSlug;
  const model = (searchParams.get("model") as AttributionModel | null) ?? "linear";
  const summary = calculateAttributionSummary(tenantSlug, model);
  return NextResponse.json({ summary });
}
