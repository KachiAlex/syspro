import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

import { getSalesPerformanceSnapshot } from "@/lib/revops-data";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const tenantSlug = context.tenantSlug;
  try {
    const payload = await getSalesPerformanceSnapshot(tenantSlug);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Failed to load sales performance", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load sales performance" }, { status: 500 });
  }
}
