import { NextRequest, NextResponse } from "next/server";
import {
  getBudgets,
  getBudgetSummaries,
  createBudget,
  getBudget,
} from "@/lib/finance/budgets-db";
import { budgetCreateSchema } from "@/lib/finance/budgets";
import { db } from "@/lib/sql-client";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");
    const tenantSlug = context.tenantSlug;
    const status = request.nextUrl.searchParams.get("status");
    const budgetType = request.nextUrl.searchParams.get("budgetType");
    const fiscalYear = request.nextUrl.searchParams.get("fiscalYear");

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
      budgetType: budgetType ?? undefined,
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
    const context = validateTenantContext(request, "write");
    const body = await request.json();

    // Get tenant ID from slug
    const tenantResult = await db.query(
      "SELECT id FROM tenants WHERE slug = $1",
      [context.tenantSlug]
    );

    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const tenantId = BigInt(tenantResult.rows[0].id);

    // Validate input
    const validated = budgetCreateSchema.parse(body);

    // Create budget with tenant context
    const budget = await createBudget({ ...validated, tenantId });

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
