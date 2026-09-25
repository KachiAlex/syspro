import { NextRequest, NextResponse } from "next/server";
import {
  getBudgetForecasts,
  createBudgetForecast,
  generateRollingForecast,
} from "@/lib/finance/budgets-db";
import { budgetForecastCreateSchema } from "@/lib/finance/budgets";

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
    const forecastType = request.nextUrl.searchParams.get("forecastType");

    if (!tenantSlug) {
      return NextResponse.json(
        { error: "tenantSlug is required" },
        { status: 400 }
      );
    }

    const budgetId = BigInt(params.id);

    const forecasts = await getBudgetForecasts(
      budgetId,
      tenantSlug,
      forecastType || undefined
    );

    return NextResponse.json(forecasts);
  } catch (error) {
    console.error("Error in GET /api/finance/budgets/[id]/forecasts:", error);
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
    const body = await request.json();

    if (!tenantSlug) {
      return NextResponse.json(
        { error: "tenantSlug is required" },
        { status: 400 }
      );
    }

    // Handle rolling forecast generation request
    if (body.generateRolling) {
      const forecast = await generateRollingForecast(
        BigInt(params.id),
        tenantSlug,
        body.basePeriods || 3
      );
      return NextResponse.json(forecast, { status: 201 });
    }

    // Validate
    const validated = budgetForecastCreateSchema.parse(body);
    const forecast = await createBudgetForecast(validated);

    return NextResponse.json(forecast, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/finance/budgets/[id]/forecasts:", error);

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
