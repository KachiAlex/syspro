export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { getDashboardMetrics } from "@/lib/support-db";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const _gate1 = await requireModuleGate(request, "itsupport", "read");
  if (_gate1) return _gate1;
  const { searchParams } = new URL(request.url);
  const tenantSlug = context.tenantSlug;
  const metrics = await getDashboardMetrics(tenantSlug);
  return NextResponse.json({ metrics });
}
