import { NextRequest, NextResponse } from "next/server";
import { approveBudget, getBudgetApprovals } from "@/lib/finance/budgets-db";
import { db } from "@/lib/sql-client";
import { budgetApproveSchema } from "@/lib/finance/budgets";

export async function GET(
  request: NextRequest,
  context: any
) {
  const { params } = context;
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
    const budgetId = BigInt(params.id);

    const approvals = await getBudgetApprovals(budgetId, tenantId);

    return NextResponse.json(approvals);
  } catch (error) {
    console.error("Error in GET /api/finance/budgets/[id]/approvals:", error);
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

    // Get tenant ID
    const tenantResult = await db.query(
      "SELECT id FROM tenants WHERE slug = $1",
      [tenantSlug]
    );

    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const tenantId = BigInt(tenantResult.rows[0].id);

    // Validate
    const validated = budgetApproveSchema.parse({
      ...body,
      budgetId: BigInt(params.id),
      tenantId,
    });

    const approval = await approveBudget(validated);

    return NextResponse.json(approval, { status: 201 });
  } catch (error: any) {
    console.error(
      "Error in POST /api/finance/budgets/[id]/approvals:",
      error
    );

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
