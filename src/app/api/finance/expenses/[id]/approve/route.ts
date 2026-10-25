export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { expenseApproveSchema } from "@/lib/finance/types";
import { approveExpense, getExpense } from "@/lib/finance/db";
import { writeFinanceEvent } from "@/lib/finance/events";
import { requireModuleAccess } from "@/lib/api-auth";
import { sql as SQL } from "@/lib/sql-client";
import {
  getApprovalForEntity,
  processApprovalDecision,
} from "@/lib/finance/approvals";

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

/** The caller's approval-role key: their tenant_admins role when they have
 *  one (so role: placeholders in chains match), else the session roleId. */
async function resolveApproverRole(
  user: { id: string; email?: string | null; roleId?: string },
  tenantSlug: string
): Promise<string> {
  if (user.roleId === "superadmin") return "superadmin";
  if (user.email) {
    try {
      const rows = await SQL`
        select role from tenant_admins
        where lower(email) = lower(${user.email}) and tenant_slug = ${tenantSlug}
        limit 1
      `;
      const role = String((rows as any[])[0]?.role ?? "").toLowerCase();
      if (role) return role;
    } catch {
      // fall through to roleId
    }
  }
  return user.roleId || "user";
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
    // Get expense before approval to check existence + segregation of duties
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

    // ------------------------------------------------------------------
    // Workflow path: the expense carries an active approvals row — the
    // decision goes through the multi-step chain, which authorizes the
    // caller against the current step and applies the outcome itself.
    // ------------------------------------------------------------------
    const workflow = await getApprovalForEntity(parsed.data.tenantSlug, "expense", params.id);
    if (workflow && (workflow.status === "pending" || workflow.status === "escalated")) {
      const decision =
        parsed.data.action === "APPROVED" ? "approved"
        : parsed.data.action === "REJECTED" ? "rejected"
        : "clarification_needed";

      let updated;
      try {
        updated = await processApprovalDecision({
          approvalId: workflow.id,
          userId: user.id,
          userRole: await resolveApproverRole(user, parsed.data.tenantSlug),
          decision,
          comments: parsed.data.reason,
        });
      } catch (err) {
        return NextResponse.json(
          { error: String((err as any)?.message ?? err) },
          { status: 403 }
        );
      }

      writeFinanceEvent({
        tenantSlug: parsed.data.tenantSlug,
        eventType: parsed.data.action === "APPROVED" ? "expense_approved" : "expense_rejected",
        sourceModule: "finance",
        sourceRecordId: expenseBefore.id,
        userId: user.id,
        amount: expenseBefore.totalAmount || expenseBefore.amount || 0,
        currency: expenseBefore.currency || "NGN",
        metadata: { via: "approval_workflow", approvalId: workflow.id, approverId: user.id },
      });

      const expense = await getExpense(params.id, parsed.data.tenantSlug);
      return NextResponse.json({ expense, approval: updated });
    }

    // ------------------------------------------------------------------
    // Legacy path: no workflow row (pre-workflow expenses or no rule
    // matched) — only tenant admins decide, as before.
    // ------------------------------------------------------------------
    if (!(await isTenantAdmin(user, parsed.data.tenantSlug))) {
      return NextResponse.json({ error: "Only tenant admins can approve expenses" }, { status: 403 });
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
