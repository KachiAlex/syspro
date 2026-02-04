import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getBudgetVariances,
  acknowledgeBudgetVariance,
} from "@/lib/finance/budgets-db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      varianceType: varianceType || undefined,
      alertLevel: alertLevel || undefined,
    };

    const variances = await getBudgetVariances(budgetId, tenantId, filters);

    return NextResponse.json(variances);
  } catch (error) {
    console.error("Error in GET /api/finance/budgets/[id]/variances:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
