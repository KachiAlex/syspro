export const dynamic = "force-dynamic";
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
import { getGLAccountForCategory } from "@/lib/finance/service";
import { enforceBudget, BudgetViolationError } from "@/lib/finance/budget-control";
import { requireModuleAccess, requireDocAccess } from "@/lib/api-auth";
import { sql as SQL } from "@/lib/sql-client";
import {
  initiateApprovalIfRequired,
  resetApprovalForResubmission,
  getApprovalForEntity,
} from "@/lib/finance/approvals";

/**
 * Resolve the submitter's department + employee id so the approval workflow
 * can route to the right departmental authority. createdBy may be an
 * employee id, email, or display name.
 */
async function resolveSubmitterDept(tenantSlug: string, createdBy: string) {
  try {
    const rows = await SQL`
      select id, department_id from admin_employees
      where tenant_slug = ${tenantSlug}
        and (id = ${createdBy} or lower(email) = lower(${createdBy}) or lower(name) = lower(${createdBy}))
      limit 1
    `;
    return { employeeId: (rows as any[])[0]?.id ?? null, departmentId: (rows as any[])[0]?.department_id ?? null };
  } catch {
    return { employeeId: null, departmentId: null };
  }
}

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
    const _scope = await requireModuleAccess(request, "finance", "read");
    if (!_scope.ok) return _scope.response;

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
    const _scope = await requireDocAccess(request, "expense_claim", "create", "finance", "write");
    if (!_scope.ok) return _scope.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = expenseCreateSchema.safeParse(body);
  if (!parsed.success) {
    console.log("Validation errors:", parsed.error.flatten());
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    // Seed categories if needed
    await seedExpenseCategories();
    
    console.log("Creating expense with validated data:", parsed.data);
    // Server-owned statuses: a submitted expense always enters the approval
    // workflow as PENDING (or DRAFT when explicitly saved as a draft) — never
    // APPROVED/PAID at creation. Client-sent status values are ignored.
    // Stamp the submitter's department — drives department-based approval
    // routing — before the row is created.
    const submitter = await resolveSubmitterDept(parsed.data.tenantSlug, parsed.data.createdBy);
    const expense = await createExpense({
      ...parsed.data,
      departmentId: parsed.data.departmentId ?? submitter.departmentId ?? undefined,
      submitterEmployeeId: parsed.data.submitterEmployeeId ?? submitter.employeeId ?? undefined,
      approvalStatus: parsed.data.approvalStatus === "DRAFT" ? "DRAFT" : "PENDING",
      paymentStatus: "UNPAID",
    });
    console.log("Expense created successfully:", expense);

    // Route into the approval workflow when a rule, tenant threshold, or the
    // opt-in default ladder requires it. Skipped for drafts.
    let approval: Awaited<ReturnType<typeof initiateApprovalIfRequired>> = null;
    if (expense.approvalStatus !== "DRAFT") {
      try {
        approval = await initiateApprovalIfRequired({
          tenantSlug: parsed.data.tenantSlug,
          entityType: "expense",
          entityId: expense.id,
          requestedBy: parsed.data.createdBy,
          entityData: {
            amount: expense.totalAmount ?? parsed.data.amount,
            departmentId: expense.departmentId,
            submitterEmployeeId: expense.submitterEmployeeId,
            categoryId: parsed.data.categoryId,
            reference: expense.id,
            description: parsed.data.description,
            requestedByName: parsed.data.createdBy,
          },
        });
        if (approval) {
          await SQL`update expenses set approval_id = ${approval.id} where id = ${expense.id}`;
        }
      } catch (err) {
        // Workflow failure must not lose the expense — it stays PENDING and
        // can still be decided through the legacy admin path.
        console.error("Expense approval initiation failed:", err);
      }
    }

    // Check budget for this category
    const budgetUsage = calculateMonthlyUsage(parsed.data.categoryId, parsed.data.amount);
    const requiresEscalation = requiresEscalatedApproval(budgetUsage);

    // GL-budget enforcement against ACTIVE budgets covering the expense account
    let glBudget: Awaited<ReturnType<typeof enforceBudget>> | null = null;
    if (parsed.data.categoryId) {
      try {
        glBudget = await enforceBudget({
          tenantSlug: parsed.data.tenantSlug,
          lines: [{
            accountCode: getGLAccountForCategory(parsed.data.categoryId),
            amount: parsed.data.amount,
          }],
          record: {
            actualType: "EXPENSE",
            transactionCode: (expense as any).id ?? undefined,
            transactionDate: (expense as any).date ?? undefined,
          },
        });
      } catch (err) {
        if (err instanceof BudgetViolationError) {
          return NextResponse.json(
            { error: err.message, violations: err.violations, expense },
            { status: 409 }
          );
        }
        console.error("GL budget check failed:", err);
      }
    }

    return NextResponse.json(
      {
        expense,
        budgetCheck: {
          categoryId: parsed.data.categoryId,
          monthlyUsage: budgetUsage.usagePercentage,
          status: budgetUsage.status,
          requiresEscalation,
        },
        glBudgetWarnings: glBudget?.warnings ?? [],
        approval,
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
    const _scope = await requireModuleAccess(request, "finance", "write");
    if (!_scope.ok) return _scope.response;

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
    // Approval status is server-owned — it only moves via /approve or the
    // resubmit transition below. Recording payment stays possible here, but
    // only once the expense is APPROVED.
    const { approvalStatus, paymentStatus, ...fields } = parsed.data as any;
    const sanitized: any = { ...fields };
    let resubmit = false;
    if (paymentStatus || approvalStatus) {
      const current = await getExpense(id, tenantSlug);
      if (!current) {
        return NextResponse.json({ error: "Expense not found" }, { status: 404 });
      }
      if (paymentStatus) {
        if (current.approvalStatus !== "APPROVED") {
          return NextResponse.json(
            { error: "Expense must be approved before payment can be recorded" },
            { status: 409 }
          );
        }
        sanitized.paymentStatus = paymentStatus;
      }
      // Submitting a draft or resubmitting after a clarification request is
      // the only client-driven status move; every other value is ignored.
      if (
        approvalStatus === "PENDING" &&
        (current.approvalStatus === "DRAFT" || current.approvalStatus === "CLARIFY_NEEDED")
      ) {
        sanitized.approvalStatus = "PENDING";
        resubmit = true;
      }
    }

    const expense = await updateExpense(id, tenantSlug, sanitized);
    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // (Re)enter the approval workflow: reset an existing chain to step 0, or
    // initiate one if the expense was a draft that never entered.
    if (resubmit) {
      try {
        const existing = await getApprovalForEntity(tenantSlug, "expense", expense.id);
        let approval = existing ? await resetApprovalForResubmission(tenantSlug, "expense", expense.id) : null;
        if (!approval) {
          approval = await initiateApprovalIfRequired({
            tenantSlug,
            entityType: "expense",
            entityId: expense.id,
            requestedBy: expense.createdBy,
            entityData: {
              amount: expense.totalAmount ?? expense.amount,
              departmentId: expense.departmentId,
              submitterEmployeeId: expense.submitterEmployeeId,
              categoryId: expense.categoryId,
              reference: expense.id,
              description: expense.description,
              requestedByName: expense.createdBy,
            },
          });
          if (approval) {
            await SQL`update expenses set approval_id = ${approval.id} where id = ${expense.id}`;
          }
        }
      } catch (err) {
        console.error("Expense resubmission workflow failed:", err);
      }
    }

    return NextResponse.json({ expense });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Update expense failed:", errorMessage, error);
    return NextResponse.json({ error: "Failed to update expense", details: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "finance", "write");
    if (!_scope.ok) return _scope.response;

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
