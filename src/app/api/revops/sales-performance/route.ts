import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

import { getSalesPerformanceSnapshot } from "@/lib/revops-data";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const tenantSlug = context.tenantSlug;
  const payload = getSalesPerformanceSnapshot(tenantSlug);
  return NextResponse.json(payload);
}
