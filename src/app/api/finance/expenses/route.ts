import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  expenseCreateSchema,
  expenseUpdateSchema,
  expenseApproveSchema,
  EXPENSE_APPROVAL_STATUSES,
  EXPENSE_PAYMENT_STATUSES,
} from "@/lib/finance/types";
import {
  listExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  approveExpense,
  seedExpenseCategories,
} from "@/lib/finance/db";
import { calculateMonthlyUsage, requiresEscalatedApproval } from "@/lib/finance/budget";

const expenseListSchema = z.object({
  tenantSlug: z.string().min(1),
  approvalStatus: z.enum(EXPENSE_APPROVAL_STATUSES).optional(),
  paymentStatus: z.enum(EXPENSE_PAYMENT_STATUSES).optional(),
  categoryId: z.string().optional(),
  createdBy: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = expenseListSchema.safeParse({
    tenantSlug: url.searchParams.get("tenantSlug") ?? undefined,
    approvalStatus: url.searchParams.get("approvalStatus") ?? undefined,
    paymentStatus: url.searchParams.get("paymentStatus") ?? undefined,
    categoryId: url.searchParams.get("categoryId") ?? undefined,
    createdBy: url.searchParams.get("createdBy") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    // Seed categories if needed
    await seedExpenseCategories();
    
    const expenses = await listExpenses(parsed.data);
    return NextResponse.json({ expenses });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Finance expenses list failed:", errorMessage, error);
    return NextResponse.json({ error: "Failed to load expenses", details: errorMessage }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = expenseCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    // Seed categories if needed
    await seedExpenseCategories();
    
    const expense = await createExpense(parsed.data);

    // Check budget for this category
    const budgetUsage = calculateMonthlyUsage(parsed.data.categoryId, parsed.data.amount);
    const requiresEscalation = requiresEscalatedApproval(budgetUsage);

    return NextResponse.json(
      {
        expense,
        budgetCheck: {
          categoryId: parsed.data.categoryId,
          monthlyUsage: budgetUsage.usagePercentage,
          status: budgetUsage.status,
          requiresEscalation,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Create expense failed:", errorMessage, error);
    return NextResponse.json({ error: "Failed to create expense", details: errorMessage }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { id, tenantSlug, ...updates } = body as any;
  if (!id || !tenantSlug) {
    return NextResponse.json(
      { error: "Missing id or tenantSlug" },
      { status: 400 }
    );
  }

  const parsed = expenseUpdateSchema.safeParse(updates);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const expense = await updateExpense(id, tenantSlug, parsed.data);
    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }
    return NextResponse.json({ expense });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Update expense failed:", errorMessage, error);
    return NextResponse.json({ error: "Failed to update expense", details: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const tenantSlug = url.searchParams.get("tenantSlug");

  if (!id || !tenantSlug) {
    return NextResponse.json(
      { error: "Missing id or tenantSlug" },
      { status: 400 }
    );
  }

  try {
    const deleted = await deleteExpense(id, tenantSlug);
    if (!deleted) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Delete expense failed:", errorMessage, error);
    return NextResponse.json({ error: "Failed to delete expense", details: errorMessage }, { status: 500 });
  }
}
