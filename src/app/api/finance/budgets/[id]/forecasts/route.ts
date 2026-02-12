import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/sql-client";
import {
  getBudgetForecasts,
  createBudgetForecast,
  generateRollingForecast,
} from "@/lib/finance/budgets-db";
import { budgetForecastCreateSchema } from "@/lib/finance/budgets";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");
    const forecastType = request.nextUrl.searchParams.get("forecastType");

    if (!tenantSlug) {
      return NextResponse.json(
        { error: "tenantSlug is required" },
        { status: 400 }
      );
    }

    // Get tenant ID
    const tenantResult = await db.query(
      "SELECT id FROM tenants WHERE slug = $1",
      [tenantSlug]
    );

    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const tenantId = BigInt(tenantResult.rows[0].id);
    const budgetId = BigInt(params.id);

    const forecasts = await getBudgetForecasts(
      budgetId,
      tenantId,
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
  { params }: { params: { id: string } }
) {
  try {
    const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");
    const body = await request.json();

    if (!tenantSlug) {
      return NextResponse.json(
        { error: "tenantSlug is required" },
        { status: 400 }
      );
    }

    // Get tenant ID
    const tenantResult = await db.query(
      "SELECT id FROM tenants WHERE slug = $1",
      [tenantSlug]
    );

    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const tenantId = BigInt(tenantResult.rows[0].id);

    // Handle rolling forecast generation request
    if (body.generateRolling) {
      const forecast = await generateRollingForecast(
        BigInt(params.id),
        tenantId,
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
