export const dynamic = "force-dynamic";
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

    // Converged flow: budget approval routes through the shared approvals
    // engine (spend domain). approve=true submits the budget to the chain;
    // approval flips it to APPROVED, rejection returns it to DRAFT.
    if (validated.approve) {
      const { getBudget } = await import("@/lib/finance/budgets-db");
      const budget = await getBudget(validated.budgetId, tenantSlug);
      if (!budget) {
        return NextResponse.json({ error: "Budget not found" }, { status: 404 });
      }
      const { gateOrRun } = await import("@/lib/finance/gated-actions");
      const outcome = await gateOrRun(
        tenantSlug,
        "budget_approval",
        {
          budgetId: validated.budgetId.toString(),
          budgetName: (budget as any).name,
          totalBudgetAmount: (budget as any).totalBudgetAmount,
        },
        { requestedBy: validated.approverId }
      );
      if (outcome.status === "pending") {
        return NextResponse.json(
          { status: "PENDING", pendingApproval: true, approvalId: outcome.approvalId },
          { status: 202 }
        );
      }
      if (outcome.status === "denied") {
        return NextResponse.json({ error: outcome.error }, { status: 403 });
      }
      return NextResponse.json(outcome.result, { status: 201 });
    }

    // Rejection: route through the engine when an open approval exists,
    // else fall back to the legacy budget_approvals row update.
    const { db } = await import("@/lib/sql-client");
    const pending = (await db.query(
      `select id from approvals
       where tenant_slug = $1 and entity_type = 'gated_action' and status = 'pending'
         and metadata->'payload'->>'budgetId' = $2
       limit 1`,
      [tenantSlug, validated.budgetId.toString()]
    )).rows[0];
    if (pending) {
      const { processApprovalDecision } = await import("@/lib/finance/approvals");
      const decided = await processApprovalDecision({
        approvalId: pending.id,
        userId: _scope.user.id,
        userRole: (_scope.user as any).role,
        decision: "rejected",
        comments: validated.comment,
      });
      return NextResponse.json({ status: "REJECTED", approval: decided }, { status: 200 });
    }

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
