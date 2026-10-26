export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/api-auth";
import { getCurrentUser } from "@/lib/auth-helpers";

/**
 * POST /api/accounting/periods/[id]/close
 * Close a fiscal period: posts a closing journal entry that moves net
 * income/expense balances to retained earnings, locks the period against
 * further posting, and carries balance-sheet opening balances forward.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const scope = await requireModuleAccess(request, "finance", "write");
  if (!scope.ok) return scope.response;

  const params = await context.params;
  const user = getCurrentUser(request);
  const tenantSlug = scope.user.tenantSlug ?? user?.tenantSlug ?? "";
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  try {
    // Closing a fiscal period posts the closing JE and locks the period —
    // an authority decision, always routed through the approvals engine.
    const { db } = await import("@/lib/sql-client");
    const period = (await db.query(
      `select name from fiscal_periods where id = $1 limit 1`,
      [params.id]
    )).rows[0];
    const { gateOrRun } = await import("@/lib/finance/gated-actions");
    const outcome = await gateOrRun(
      tenantSlug,
      "period_close",
      { periodId: params.id, periodName: period?.name },
      { requestedBy: user?.id ?? scope.user.id ?? "unknown" }
    );
    if (outcome.status === "pending") {
      return NextResponse.json(
        { success: true, pendingApproval: true, approvalId: outcome.approvalId },
        { status: 202 }
      );
    }
    if (outcome.status === "denied") {
      return NextResponse.json({ error: outcome.error }, { status: 403 });
    }
    return NextResponse.json({ success: true, data: outcome.result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("not found")
      ? 404
      : message.includes("already closed")
        ? 409
        : 500;
    console.error("Error closing fiscal period:", message, error);
    return NextResponse.json({ error: message }, { status });
  }
}
