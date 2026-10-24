export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { expenseApproveSchema } from "@/lib/finance/types";
import { approveExpense, getExpense } from "@/lib/finance/db";
import { writeFinanceEvent } from "@/lib/finance/events";
import { requireModuleAccess } from "@/lib/api-auth";
import { sql as SQL } from "@/lib/sql-client";

/** Approving an expense is an admin action — a finance user may submit and
 *  track expenses, but only a tenant admin (or superadmin) may decide. */
async function isTenantAdmin(user: { id: string; email?: string | null; roleId?: string }, tenantSlug: string) {
  if (user.roleId === "superadmin") return true;
  if (!user.email) return false;
  try {
    const rows = await SQL`
      select role from tenant_admins
      where lower(email) = lower(${user.email}) and tenant_slug = ${tenantSlug}
      limit 1
    `;
    return String((rows as any[])[0]?.role ?? "").toLowerCase() === "admin";
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest, context: any) {
    const _scope = await requireModuleAccess(request, "finance", "write");
    if (!_scope.ok) return _scope.response;
    const user = _scope.user!;

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
    if (!(await isTenantAdmin(user, parsed.data.tenantSlug))) {
      return NextResponse.json({ error: "Only tenant admins can approve expenses" }, { status: 403 });
    }

    // Get expense before approval to send in email
    const expenseBefore = await getExpense(params.id, parsed.data.tenantSlug);
    if (!expenseBefore) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // Segregation of duties: nobody approves their own expense.
    const creator = String(expenseBefore.createdBy ?? "").toLowerCase();
    const me = [user.id, user.email, user.name].filter(Boolean).map((v) => String(v).toLowerCase());
    if (creator && me.includes(creator)) {
      return NextResponse.json({ error: "You cannot approve your own expense" }, { status: 403 });
    }

    // Approver identity always comes from the session — the client cannot
    // claim to be someone else.
    const derivedApproval = {
      ...parsed.data,
      approverRole: (user.roleId === "superadmin" ? "EXECUTIVE" : "MANAGER") as any,
      approverId: user.id,
      approverName: user.name || user.email || "Admin",
    };

    // Update approval status
    const expense = await approveExpense(params.id, parsed.data.tenantSlug, derivedApproval);
    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // Publish finance event
    writeFinanceEvent({
      tenantSlug: parsed.data.tenantSlug,
      eventType: parsed.data.action === "APPROVED" ? "expense_approved" : "expense_rejected",
      sourceModule: "finance",
      sourceRecordId: expense.id,
      userId: derivedApproval.approverId,
      amount: expense.totalAmount || expense.amount || 0,
      currency: expense.currency || "NGN",
      metadata: { category: (expense as any).category?.name || (expense as any).category, approverName: derivedApproval.approverName },
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
        actorId: derivedApproval.approverId,
        explicitSpecs: [{ kind: "user", value: expense.createdBy }],
        payload: {
          status: parsed.data.action === "APPROVED" ? "approved" : "rejected",
          description: expense.description,
          amount: expense.totalAmount || expense.amount,
          reason: parsed.data.reason,
          approverName: derivedApproval.approverName,
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
