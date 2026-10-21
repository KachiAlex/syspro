export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { generateBranchPnL } from "@/lib/finance/reports-db";
import { resolveEffectiveBranchIds } from "@/lib/finance/branches";
import { requireModuleAccess } from "@/lib/api-auth";

// GET /api/finance/reports/by-branch?tenantSlug=..&periodStart=..&periodEnd=..&branchId=..
// P&L breakdown per branch (+ unassigned bucket)
export async function GET(request: NextRequest) {
  const scope = await requireModuleAccess(request, "finance", "read");
  if (!scope.ok) return scope.response;

  const searchParams = request.nextUrl.searchParams;
  const tenantSlug = searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
  }

  const periodStart = searchParams.get("periodStart")
    ? new Date(searchParams.get("periodStart")!)
    : new Date(new Date().getFullYear(), 0, 1);
  const periodEnd = searchParams.get("periodEnd")
    ? new Date(searchParams.get("periodEnd")!)
    : new Date();

  try {
    const requested = searchParams.get("branchId") ?? searchParams.get("branch");
    const branchIds = await resolveEffectiveBranchIds(
      tenantSlug, (scope as any).user?.id, requested
    );
    const lines = await generateBranchPnL({
      tenantSlug, periodStart, periodEnd, branchIds: branchIds ?? undefined,
    });
    return NextResponse.json({ success: true, data: { periodStart, periodEnd, branches: lines } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.status ?? 500 }
    );
  }
}
