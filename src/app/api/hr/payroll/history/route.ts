export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { listPayrollRuns } from "@/lib/hr/db";

import { requireModuleAccess } from "@/lib/api-auth";
export async function GET(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "people", "read");
    if (!_scope.ok) return _scope.response;

  const tenantSlug = new URL(request.url).searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug required" }, { status: 400 });
  }

  try {
    const runs = await listPayrollRuns(tenantSlug);
    return NextResponse.json({ payrollHistory: runs });
  } catch (error) {
    console.error("Failed to list payroll history:", error);
    return NextResponse.json({ error: "Failed to list payroll history" }, { status: 500 });
  }
}
