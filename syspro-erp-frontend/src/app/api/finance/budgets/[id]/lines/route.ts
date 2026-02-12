import { NextRequest, NextResponse } from "next/server";
import {
  getBudgetLines,
  getBudgetLineVariances,
  updateBudgetLine,
  deleteBudgetLine,
} from "@/lib/finance/budgets-db";
import { db } from "@/lib/sql-client";

export async function GET(
  request: NextRequest,
  context: any
) {
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

    const lines = await getBudgetLines(budgetId, tenantId);

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
