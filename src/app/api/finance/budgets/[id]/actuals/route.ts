import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getBudgetActuals,
  recordBudgetActual,
  budgetActualSchema,
} from "@/lib/finance/budgets-db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const filters = {
      actualType: actualType || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    const actuals = await getBudgetActuals(budgetId, tenantId, filters);

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
  { params }: { params: { id: string } }
) {
  try {
    const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");

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
    const body = await request.json();

    // Validate
    const validated = budgetActualSchema.parse(body);

    const actual = await recordBudgetActual(
      BigInt(params.id),
      tenantId,
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
