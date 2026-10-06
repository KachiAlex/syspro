export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import {
  getBudgetActuals,
  recordBudgetActual,
} from "@/lib/finance/budgets-db";
import { budgetActualSchema } from "@/lib/finance/budgets";

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
    const actualType = request.nextUrl.searchParams.get("actualType");
    const startDate = request.nextUrl.searchParams.get("startDate");
    const endDate = request.nextUrl.searchParams.get("endDate");

    if (!tenantSlug) {
      return NextResponse.json(
        { error: "tenantSlug is required" },
        { status: 400 }
      );
    }

    const budgetId = BigInt(params.id);

    const filters = {
      actualType: actualType || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    const actuals = await getBudgetActuals(budgetId, tenantSlug, filters);

    return NextResponse.json(actuals);
  } catch (error) {
    console.error("Error in GET /api/finance/budgets/[id]/actuals:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: any
) {
    const _scope = await requireModuleAccess(request, "finance", "write");
    if (!_scope.ok) return _scope.response;

  const { params } = context;
  try {
    const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");

    if (!tenantSlug) {
      return NextResponse.json(
        { error: "tenantSlug is required" },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate
    const validated = budgetActualSchema.parse(body);

    const actual = await recordBudgetActual(
      BigInt(params.id),
      tenantSlug,
      validated
    );

    return NextResponse.json(actual, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/finance/budgets/[id]/actuals:", error);

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
