import { NextRequest, NextResponse } from "next/server";

import { getDashboardMetrics } from "@/lib/support-db";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const { searchParams } = new URL(request.url);
  const tenantSlug = context.tenantSlug;
  const metrics = await getDashboardMetrics(tenantSlug);
  return NextResponse.json({ metrics });
}
