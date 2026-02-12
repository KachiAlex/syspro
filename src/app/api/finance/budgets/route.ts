import { NextRequest, NextResponse } from "next/server";
import {
  getBudgets,
  getBudgetSummaries,
  createBudget,
  getBudget,
} from "@/lib/finance/budgets-db";
import { db } from "@/lib/sql-client";
import { budgetCreateSchema } from "@/lib/finance/budgets";

export async function GET(request: NextRequest) {
  try {
    const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");
    const status = request.nextUrl.searchParams.get("status");
    const budgetType = request.nextUrl.searchParams.get("budgetType");
    const fiscalYear = request.nextUrl.searchParams.get("fiscalYear");

    if (!tenantSlug) {
      return NextResponse.json(
        { error: "tenantSlug is required" },
        { status: 400 }
      );
    }

    // Get tenant ID from slug
    const tenantResult = await db.query(
      "SELECT id FROM tenants WHERE slug = $1",
      [tenantSlug]
    );

    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const tenantId = BigInt(tenantResult.rows[0].id);

    const filters = {
      status: status as any,
      budgetType: budgetType || undefined,
      fiscalYear: fiscalYear ? parseInt(fiscalYear) : undefined,
    };

    const budgets = await getBudgets(tenantId, filters);

    // Return with summaries if requested
    const withSummary = request.nextUrl.searchParams.get("withSummary");
    if (withSummary === "true") {
      const summaries = await getBudgetSummaries(tenantId);
      return NextResponse.json({
        budgets,
        summaries,
      });
    }

    return NextResponse.json(budgets);
  } catch (error) {
    console.error("Error in GET /api/finance/budgets:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validated = budgetCreateSchema.parse(body);

    // Create budget
    const budget = await createBudget(validated);

    return NextResponse.json(budget, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/finance/budgets:", error);

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
