import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkPermission } from "@/lib/api-permission-enforcer";
import { approveExpense as serviceApproveExpense } from "@/lib/finance/service";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tenant = new URL(request.url).searchParams.get("tenantSlug") || undefined;
    if (!tenant) {
      return NextResponse.json({ error: "tenantSlug required" }, { status: 400 });
    }

    // Enforce permissions (requires at least write access to finance)
    await checkPermission(request, "finance", "write", tenant);

    const body = await request.json();
    const result = await serviceApproveExpense(tenant, params.id, body);
    if (!result) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }
    return NextResponse.json({ expense: result });
  } catch (err: any) {
    const status = err?.status || 400;
    return NextResponse.json({ error: err?.message || String(err) }, { status });
  }
}
import { NextRequest, NextResponse } from "next/server";

import { expenseApproveSchema } from "@/lib/finance/types";
import { approveExpense, getExpense } from "@/lib/finance/db";
import { notifyExpenseApproved, notifyExpenseRejected } from "@/lib/finance/email";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Send notification email based on action
    // Note: In production, get actual submitter email from user database
    const submitterEmail = expenseBefore.createdBy + "@company.com";
    
    if (parsed.data.action === "APPROVED") {
      // Send approval email
      await notifyExpenseApproved(
        {
          expenseId: expense.id,
          description: expense.description,
          amount: expense.amount,
          totalAmount: expense.totalAmount,
          taxAmount: expense.taxAmount || 0,
          createdBy: expense.createdBy,
          createdAt: expense.createdAt,
          approvalStatus: expense.approvalStatus,
          category: typeof expense.category === 'string' ? expense.category : ((expense.category as any)?.name ?? "Unknown"),
          vendor: (expense.vendor as string) || undefined,
        },
        submitterEmail,
        parsed.data.approverName,
        parsed.data.reason
      );
    } else if (parsed.data.action === "REJECTED") {
      // Send rejection email
      await notifyExpenseRejected(
        {
          expenseId: expense.id,
          description: expense.description,
          amount: expense.amount,
          totalAmount: expense.totalAmount,
          taxAmount: expense.taxAmount || 0,
          createdBy: expense.createdBy,
          createdAt: expense.createdAt,
          approvalStatus: expense.approvalStatus,
          category: typeof expense.category === 'string' ? expense.category : ((expense.category as any)?.name ?? "Unknown"),
          vendor: (expense.vendor as string) || undefined,
        },
        submitterEmail,
        parsed.data.approverName,
        parsed.data.reason || "No reason provided"
      );
    }

    return NextResponse.json({ expense });
  } catch (error) {
    console.error("Approve expense failed", error);
    return NextResponse.json({ error: "Failed to approve expense" }, { status: 500 });
  }
}
