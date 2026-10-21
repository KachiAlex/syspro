export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { expenseApproveSchema } from "@/lib/finance/types";
import { approveExpense, getExpense } from "@/lib/finance/db";
import { writeFinanceEvent } from "@/lib/finance/events";
import { requireModuleAccess } from "@/lib/api-auth";

export async function POST(request: NextRequest, context: any) {
    const _scope = await requireModuleAccess(request, "finance", "write");
    if (!_scope.ok) return _scope.response;

  const { params } = context;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = expenseApproveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    // Get expense before approval to send in email
    const expenseBefore = await getExpense(params.id, parsed.data.tenantSlug);
    if (!expenseBefore) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // Update approval status
    const expense = await approveExpense(params.id, parsed.data.tenantSlug, parsed.data);
    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // Publish finance event
    writeFinanceEvent({
      tenantSlug: parsed.data.tenantSlug,
      eventType: parsed.data.action === "APPROVED" ? "expense_approved" : "expense_rejected",
      sourceModule: "finance",
      sourceRecordId: expense.id,
      userId: parsed.data.approverId,
      amount: expense.totalAmount || expense.amount || 0,
      currency: expense.currency || "NGN",
      metadata: { category: (expense as any).category?.name || (expense as any).category, approverName: parsed.data.approverName },
    });

    // Notify the submitter through the durable pipeline — resolves their real
    // email via admin_employees/tenant_admins instead of fabricating one.
    try {
      const { emitEvent } = await import("@/lib/notify");
      void emitEvent({
        tenantSlug: parsed.data.tenantSlug,
        eventType: "expense.decided",
        sourceModule: "finance",
        sourceRecordId: expense.id,
        dedupeKey: `expense:${expense.id}:${parsed.data.action}`,
        actorId: parsed.data.approverId,
        explicitSpecs: [{ kind: "user", value: expense.createdBy }],
        payload: {
          status: parsed.data.action === "APPROVED" ? "approved" : "rejected",
          description: expense.description,
          amount: expense.totalAmount || expense.amount,
          reason: parsed.data.reason,
          approverName: parsed.data.approverName,
        },
      });
    } catch (err) {
      console.error("Failed to emit expense.decided:", err);
    }

    return NextResponse.json({ expense });
  } catch (error) {
    console.error("Approve expense failed", error);
    return NextResponse.json({ error: "Failed to approve expense" }, { status: 500 });
  }
}
