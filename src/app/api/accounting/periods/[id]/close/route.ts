export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { closeFiscalPeriod } from "@/lib/finance/gl";
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

  try {
    const result = await closeFiscalPeriod(params.id, user?.id ?? undefined);
    return NextResponse.json({ success: true, data: result });
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
