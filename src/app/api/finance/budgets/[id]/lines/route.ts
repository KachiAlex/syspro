import { NextRequest, NextResponse } from "next/server";
import {
  getBudgetLines,
  getBudgetLineVariances,
  updateBudgetLine,
  deleteBudgetLine,
} from "@/lib/finance/budgets-db";

import { requireModuleAccess } from "@/lib/api-auth";
export async function GET(
  request: NextRequest,
  context: any
) {
    const _scope = await requireModuleAccess(request, "finance", "read");
    if (!_scope.ok) return _scope.response;

  const { params } = context;
  try {
    const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");
    const withVariance = request.nextUrl.searchParams.get("withVariance");

    if (!tenantSlug) {
      return NextResponse.json(
        { error: "tenantSlug is required" },
        { status: 400 }
      );
    }

    const budgetId = BigInt(params.id);

    const lines = await getBudgetLines(budgetId, tenantSlug);

    if (withVariance === "true") {
      const variances = await getBudgetLineVariances(budgetId);
      return NextResponse.json({ lines, variances });
    }

    return NextResponse.json(lines);
  } catch (error) {
    console.error("Error in GET /api/finance/budgets/[id]/lines:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
