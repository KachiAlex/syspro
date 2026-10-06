export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

import { getRevenueForecast } from "@/lib/revops-data";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const tenantSlug = context.tenantSlug;
  try {
    const forecast = await getRevenueForecast(tenantSlug);
    return NextResponse.json({ forecast });
  } catch (error) {
    console.error("Failed to load forecast", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load forecast" }, { status: 500 });
  }
}
