import { NextRequest, NextResponse } from "next/server";

import { expenseApproveSchema } from "@/lib/finance/types";
import { approveExpense, getExpense } from "@/lib/finance/db";
import { notifyExpenseApproved, notifyExpenseRejected } from "@/lib/finance/email";

export async function POST(request: NextRequest, context: any) {
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
          category: (expense as any).category?.name || (expense as any).category || "Unknown",
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
          category: (expense as any).category?.name || (expense as any).category || "Unknown",
          vendor: (expense as any).vendorName || (expense as any).vendor || "Unknown",
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
