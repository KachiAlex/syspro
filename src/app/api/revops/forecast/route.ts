import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

import { getRevenueForecast } from "@/lib/revops-data";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const tenantSlug = context.tenantSlug;
  const forecast = getRevenueForecast(tenantSlug);
  return NextResponse.json({ forecast });
}
