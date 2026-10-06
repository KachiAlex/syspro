export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import {
  getBudget,
  updateBudget,
  deleteBudget,
  changeBudgetStatus,
} from "@/lib/finance/budgets-db";
import { budgetUpdateSchema } from "@/lib/finance/budgets";

import { requireModuleAccess } from "@/lib/api-auth";
export async function GET(request: NextRequest, context: any) {
    const _scope = await requireModuleAccess(request, "finance", "read");
    if (!_scope.ok) return _scope.response;

  try {
    const { params } = context;
    const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");

    if (!tenantSlug) {
      return NextResponse.json(
        { error: "tenantSlug is required" },
        { status: 400 }
      );
    }

    const budget = await getBudget(BigInt(params.id), tenantSlug);

    if (!budget) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }

    return NextResponse.json(budget);
  } catch (error) {
    console.error("Error in GET /api/finance/budgets/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: any) {
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
    const validated = budgetUpdateSchema.parse(body);

    const updated = await updateBudget(BigInt(params.id), tenantSlug, validated);

    if (!updated) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Error in PUT /api/finance/budgets/[id]:", error);

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

export async function DELETE(request: NextRequest, context: any) {
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

    const deleted = await deleteBudget(BigInt(params.id), tenantSlug);

    if (!deleted) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/finance/budgets/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
