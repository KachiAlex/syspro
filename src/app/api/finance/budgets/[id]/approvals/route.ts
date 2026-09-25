import { NextRequest, NextResponse } from "next/server";
import { approveBudget, getBudgetApprovals } from "@/lib/finance/budgets-db";
import { budgetApproveSchema } from "@/lib/finance/budgets";

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

    if (!tenantSlug) {
      return NextResponse.json(
        { error: "tenantSlug is required" },
        { status: 400 }
      );
    }

    const budgetId = BigInt(params.id);

    const approvals = await getBudgetApprovals(budgetId, tenantSlug);

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

    // Validate
    const validated = budgetApproveSchema.parse({
      ...body,
      budgetId: BigInt(params.id),
      tenantSlug,
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
