export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import {
  getBudgetVariances,
  acknowledgeBudgetVariance,
} from "@/lib/finance/budgets-db";

import { requireModuleAccess } from "@/lib/api-auth";
export async function GET(request: NextRequest, context: any) {
    const _scope = await requireModuleAccess(request, "finance", "read");
    if (!_scope.ok) return _scope.response;

  const { params } = context;
  try {
    const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");
    const varianceType = request.nextUrl.searchParams.get("varianceType");
    const alertLevel = request.nextUrl.searchParams.get("alertLevel");

    if (!tenantSlug) {
      return NextResponse.json(
        { error: "tenantSlug is required" },
        { status: 400 }
      );
    }

    const budgetId = BigInt(params.id);

    const filters = {
      varianceType: varianceType || undefined,
      alertLevel: alertLevel || undefined,
    };

    const variances = await getBudgetVariances(budgetId, tenantSlug, filters);

    return NextResponse.json(variances);
  } catch (error) {
    console.error("Error in GET /api/finance/budgets/[id]/variances:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: any) {
    const _scope = await requireModuleAccess(request, "finance", "write");
    if (!_scope.ok) return _scope.response;

  const { params } = context;
  try {
    const body = await request.json();
    const { varianceId, acknowledgedBy } = body;

    if (!varianceId || !acknowledgedBy) {
      return NextResponse.json(
        { error: "varianceId and acknowledgedBy are required" },
        { status: 400 }
      );
    }

    const variance = await acknowledgeBudgetVariance(
      BigInt(varianceId),
      acknowledgedBy
    );

    return NextResponse.json(variance);
  } catch (error) {
    console.error(
      "Error in PATCH /api/finance/budgets/[id]/variances:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
