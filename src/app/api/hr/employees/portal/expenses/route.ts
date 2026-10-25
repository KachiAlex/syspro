export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { decodeEmployeeToken, resolveEmployeeSession } from "@/lib/hr/auth";
import { sql as SQL } from "@/lib/sql-client";
import { insertNotification } from "@/lib/hr/db";
import { z } from "zod";
import { isTenantSuspended } from "@/lib/api-auth";
import { createExpense, ensureExpenseTables } from "@/lib/finance/db";

/**
 * Employee portal expenses live in the shared `expenses` table as
 * type='reimbursement' rows (submitter_employee_id links the employee).
 * admin_employee_expenses is retained as a read-only archive; a migration
 * copies its rows into `expenses` preserving ids.
 */

function mapStatus(e: any): string {
  const a = String(e.approval_status || "").toUpperCase();
  const p = String(e.payment_status || "").toUpperCase();
  if (a === "APPROVED") return p === "PAID" || p === "REIMBURSED" ? "paid" : "approved";
  if (a === "REJECTED") return "rejected";
  return "pending";
}

function toPortalShape(e: any) {
  return {
    id: e.id,
    category: e.category,
    description: e.description,
    amount: Number(e.total_amount ?? e.amount),
    currency: e.currency ?? "NGN",
    date: e.date,
    status: mapStatus(e),
    receipt_url: e.receipt_url ?? null,
    approver_comment: e.approver_comment ?? null,
    approver_name: e.approver_name ?? null,
    employee_name: e.employee_name ?? undefined,
    employee_job_title: e.employee_job_title ?? undefined,
    created_at: e.created_at,
  };
}

/**
 * GET /api/hr/employees/portal/expenses
 * Returns the logged-in employee's expense requests.
 * HOD also sees pending expense requests from their department for approval.
 */
export async function GET(request: NextRequest) {
  const session = resolveEmployeeSession(request);
    if (session && (await isTenantSuspended(session.tenantSlug))) return NextResponse.json({ error: "Tenant is suspended" }, { status: 403 }); if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const employeeRole = (session.role || "staff").toLowerCase();
    const isHOD = employeeRole === "hod" || employeeRole === "head_of_department";

    await ensureExpenseTables(SQL);

    // Fetch employee's own expenses (latest decision provides approver info)
    let myExpenses: any[] = [];
    try {
      myExpenses = (await SQL`
        SELECT e.*, e.date::text as date,
               coalesce(e.metadata->>'receiptUrl', e.attachments[1]) as receipt_url,
               d.approver_name, d.reason as approver_comment
        FROM expenses e
        LEFT JOIN LATERAL (
          SELECT approver_name, reason FROM expense_approvals ea
          WHERE ea.expense_id = e.id AND ea.action IN ('APPROVED','REJECTED')
          ORDER BY timestamp DESC LIMIT 1
        ) d ON true
        WHERE e.tenant_slug = ${session.tenantSlug} AND e.submitter_employee_id = ${session.id}
        ORDER BY e.created_at DESC LIMIT 100
      `) as any[];
    } catch (e) {
      console.error("Portal expenses query failed:", (e as any)?.message);
    }

    // If HOD, also fetch pending expenses from department
    let pendingApprovals: any[] = [];
    if (isHOD) {
      try {
        const empInfo = await SQL`
          SELECT department_id FROM admin_employees
          WHERE id = ${session.id} AND tenant_slug = ${session.tenantSlug}
          LIMIT 1
        `;
        const deptId = empInfo[0]?.department_id;
        if (deptId) {
          // Only items awaiting THIS approver's step surface — the workflow
          // current step must name them or the unresolved dept-manager
          // placeholder. Rows without a workflow (edge) stay visible.
          pendingApprovals = (await SQL`
            SELECT e.*, e.date::text as date,
                   coalesce(e.metadata->>'receiptUrl', e.attachments[1]) as receipt_url,
                   emp.name as employee_name, emp.job_title as employee_job_title
            FROM expenses e
            JOIN admin_employees emp ON e.submitter_employee_id = emp.id
            LEFT JOIN approvals a
              ON a.entity_id = e.id AND a.entity_type = 'expense' AND a.status IN ('pending','escalated')
            WHERE e.tenant_slug = ${session.tenantSlug}
              AND e.department_id = ${deptId}
              AND e.approval_status IN ('PENDING','CLARIFY_NEEDED')
              AND e.submitter_employee_id != ${session.id}
              AND (
                a.id IS NULL
                OR EXISTS (
                  SELECT 1 FROM jsonb_array_elements(a.approver_chain) el
                  WHERE (el->>'step')::int = a.current_step
                    AND el->>'userId' IN (${session.id}, 'role:dept_manager')
                )
              )
            ORDER BY e.created_at DESC LIMIT 100
          `) as any[];
        }
      } catch (e) {
        console.error("Portal expenses approvals query failed:", (e as any)?.message);
      }
    }

    return NextResponse.json({
      expenses: myExpenses.map(toPortalShape),
      pendingApprovals: pendingApprovals.map(toPortalShape),
      isHOD,
    });
  } catch (error: any) {
    console.error("Portal expenses error:", error?.message);
    return NextResponse.json({ error: "Failed to load expenses" }, { status: 500 });
  }
}

const createExpenseSchema = z.object({
  category: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  amount: z.number().positive().max(10000000),
  currency: z.string().max(10).optional().default("NGN"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  receiptUrl: z.string().url().optional().or(z.literal("")),
});

/**
 * POST /api/hr/employees/portal/expenses
 * Submit a new expense request — creates a reimbursement row in `expenses`
 * and initiates the departmental approval workflow.
 */
export async function POST(request: NextRequest) {
  const session = resolveEmployeeSession(request);
    if (session && (await isTenantSuspended(session.tenantSlug))) return NextResponse.json({ error: "Tenant is suspended" }, { status: 403 }); if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = createExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const d = parsed.data;
    await ensureExpenseTables(SQL);

    // Get employee's department
    let deptId: string | null = null;
    try {
      const empInfo = await SQL`
        SELECT department_id FROM admin_employees
        WHERE id = ${session.id} AND tenant_slug = ${session.tenantSlug}
        LIMIT 1
      `;
      deptId = empInfo[0]?.department_id || null;
    } catch {}

    // Resolve the portal category name to an expense_categories row; fall
    // back to the seeded 'cat_other' bucket.
    let categoryId = "cat_other";
    try {
      const cat = await SQL`
        select id from expense_categories where lower(name) = lower(${d.category}) limit 1
      `;
      if (cat.length > 0) categoryId = cat[0].id;
    } catch {}

    const expense = await createExpense({
      tenantSlug: session.tenantSlug,
      type: "reimbursement",
      amount: d.amount,
      taxType: "NONE",
      category: d.category,
      categoryId,
      description: d.description,
      date: d.date,
      approvalStatus: "PENDING",
      paymentStatus: "UNPAID",
      attachments: d.receiptUrl ? [d.receiptUrl] : [],
      metadata: { source: "employee_portal", employeeName: session.name, receiptUrl: d.receiptUrl ?? undefined },
      departmentId: deptId ?? undefined,
      submitterEmployeeId: session.id,
      createdBy: session.id,
    });
    const id = expense.id;

    // Every employee expense requires a departmental authority decision.
    try {
      const { initiateApproval } = await import("@/lib/finance/approvals");
      const approval = await initiateApproval({
        tenantSlug: session.tenantSlug,
        entityType: "expense",
        entityId: id,
        requestedBy: session.id,
        entityData: {
          amount: d.amount,
          departmentId: deptId,
          submitterEmployeeId: session.id,
          reference: id,
          description: d.description,
          category: d.category,
          requestedByName: session.name,
        },
      });
      await SQL`update expenses set approval_id = ${approval.id} where id = ${id}`;
    } catch (e) {
      // Workflow failure must not lose the request — it stays pending and
      // admins can still decide it via the legacy fallback.
      console.error('Expense approval initiation failed:', (e as any)?.message);
    }

    // Notify HODs in the same department about the new expense
    if (deptId) {
      try {
        const hods = await SQL`
          SELECT id FROM admin_employees
          WHERE tenant_slug = ${session.tenantSlug}
            AND department_id = ${deptId}
            AND role IN ('hod', 'head_of_department')
            AND id != ${session.id}
        `;
        for (const hod of hods) {
          await insertNotification({
            tenantSlug: session.tenantSlug,
            employeeId: hod.id,
            type: 'info',
            category: 'finance',
            title: 'New Expense Request',
            message: `${session.name} submitted a ${d.category} expense of ₦${d.amount.toLocaleString()}`,
            actionUrl: '/employee/dashboard?tab=expenses',
          });
        }
      } catch (e) { console.error('Expense notification to HOD failed:', (e as any)?.message); }
    }

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: any) {
    console.error("Portal expense create error:", error?.message);
    return NextResponse.json({ error: "Failed to submit expense" }, { status: 500 });
  }
}

/**
 * PATCH /api/hr/employees/portal/expenses
 * HOD approves/rejects an expense request; HR settles approved ones ("pay").
 */
export async function PATCH(request: NextRequest) {
  const session = resolveEmployeeSession(request);
    if (session && (await isTenantSuspended(session.tenantSlug))) return NextResponse.json({ error: "Tenant is suspended" }, { status: 403 }); if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const employeeRole = (session.role || "staff").toLowerCase();
  const isHOD = employeeRole === "hod" || employeeRole === "head_of_department";
  const isHR = employeeRole === "hr" || employeeRole === "hr_admin" || employeeRole === "hr_manager";

  if (!isHOD && !isHR) {
    return NextResponse.json({ error: "Only HODs and HR can approve expenses" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { expenseId, action, comment } = body;

    if (!expenseId || !action || !["approve", "reject", "pay"].includes(action)) {
      return NextResponse.json({ error: "Missing or invalid expenseId/action" }, { status: 400 });
    }
    // Paying is a settlement action — restrict to HR/finance-capable roles.
    if (action === "pay" && !isHR) {
      return NextResponse.json({ error: "Only HR can settle expenses" }, { status: 403 });
    }

    const expenseInfo = await SQL`
      SELECT department_id, submitter_employee_id, amount, total_amount, category,
             approval_status, payment_status, journal_entry_id
      FROM expenses
      WHERE id = ${expenseId} AND tenant_slug = ${session.tenantSlug} AND type = 'reimbursement'
      LIMIT 1
    `;
    if (expenseInfo.length === 0) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }
    const expense = expenseInfo[0];

    // Segregation of duties: nobody approves their own expense
    if (action !== "pay" && expense.submitter_employee_id === session.id) {
      return NextResponse.json({ error: "You cannot approve your own expense" }, { status: 403 });
    }
    if (action === "pay" && String(expense.approval_status).toUpperCase() !== "APPROVED") {
      return NextResponse.json({ error: "Only approved expenses can be paid" }, { status: 400 });
    }

    // If HOD, verify expense is from their department
    if (isHOD && !isHR) {
      const empInfo = await SQL`
        SELECT department_id FROM admin_employees
        WHERE id = ${session.id} AND tenant_slug = ${session.tenantSlug}
        LIMIT 1
      `;
      const hodDept = empInfo[0]?.department_id;

      if (expense.department_id !== hodDept) {
        return NextResponse.json({ error: "You can only approve expenses from your department" }, { status: 403 });
      }
    }

    // ------------------------------------------------------------------
    // Workflow path: an active approvals row drives the decision through
    // the multi-step chain (status sync + GL posting happen in the engine).
    // ------------------------------------------------------------------
    if (action !== "pay") {
      const { getApprovalForEntity, processApprovalDecision, initiateApproval } = await import("@/lib/finance/approvals");
      let workflow = await getApprovalForEntity(session.tenantSlug, "expense", expenseId);
      if (!workflow && String(expense.approval_status).toUpperCase() === "PENDING") {
        // Lazy backfill: rows migrated from admin_employee_expenses predate
        // the workflow engine — create their chain on first decision.
        try {
          workflow = await initiateApproval({
            tenantSlug: session.tenantSlug,
            entityType: "expense",
            entityId: expenseId,
            requestedBy: expense.submitter_employee_id,
            entityData: {
              amount: Number(expense.total_amount ?? expense.amount),
              departmentId: expense.department_id,
              submitterEmployeeId: expense.submitter_employee_id,
              reference: expenseId,
              category: expense.category,
            },
          });
          await SQL`update expenses set approval_id = ${workflow.id} where id = ${expenseId}`;
        } catch (e) {
          console.error("Lazy approval backfill failed:", (e as any)?.message);
        }
      }
      if (workflow && (workflow.status === "pending" || workflow.status === "escalated")) {
        let updated;
        try {
          updated = await processApprovalDecision({
            approvalId: workflow.id,
            userId: session.id,
            userRole: session.role,
            decision: action === "approve" ? "approved" : "rejected",
            comments: comment,
          });
        } catch (err) {
          return NextResponse.json(
            { error: String((err as any)?.message ?? err) },
            { status: 403 }
          );
        }

        // Notify the employee once the chain reaches a terminal decision.
        try {
          if (updated && (updated.status === "approved" || updated.status === "rejected")) {
            await insertNotification({
              tenantSlug: session.tenantSlug,
              employeeId: expense.submitter_employee_id,
              type: updated.status === 'approved' ? 'success' : 'warning',
              category: 'finance',
              title: `Expense ${updated.status === 'approved' ? 'Approved' : 'Rejected'}`,
              message: `Your expense request has been ${updated.status} by ${session.name}${comment ? ': ' + comment : ''}`,
              actionUrl: '/employee/dashboard?tab=expenses',
            });
          }
        } catch (e) { console.error('Expense notification to employee failed:', (e as any)?.message); }

        return NextResponse.json({ success: true, status: updated?.status, approval: updated });
      }
      // No workflow row (pre-workflow expenses) — fall through to legacy.
    }

    // ------------------------------------------------------------------
    // Settlement ("pay"): posts Dr employee payable / Cr cash, marks the
    // expense reimbursed. Idempotent via payment_status.
    // ------------------------------------------------------------------
    if (action === "pay") {
      if (["PAID", "REIMBURSED"].includes(String(expense.payment_status).toUpperCase())) {
        return NextResponse.json({ success: true, status: "paid", already: true });
      }
      try {
        const { postGLEntry, GL_ACCOUNTS } = await import("@/lib/finance/gl");
        const amount = Number(expense.total_amount ?? expense.amount);
        const today = new Date().toISOString().split("T")[0];
        if (amount > 0) {
          await postGLEntry({
            tenantSlug: session.tenantSlug,
            entryDate: today,
            journalType: "SYSTEM",
            referenceType: "employee_expense_payment",
            referenceId: expenseId,
            status: "POSTED",
            description: `Employee expense settlement — ${expenseId}`,
            lines: [
              { accountCode: GL_ACCOUNTS.PAYROLL_PAYABLE, debitAmount: amount, description: `Settle payable ${expenseId}` },
              { accountCode: GL_ACCOUNTS.CASH, creditAmount: amount, description: `Cash paid to employee` },
            ],
          });
        }
      } catch (err) {
        console.error("Expense GL posting failed:", err);
      }

      await SQL`
        UPDATE expenses
        SET payment_status = 'REIMBURSED', updated_at = now()
        WHERE id = ${expenseId} AND tenant_slug = ${session.tenantSlug}
      `;
      await SQL`
        INSERT INTO expense_audit_logs (id, expense_id, action, user_id, details)
        VALUES (gen_random_uuid()::text, ${expenseId}, 'PAID', ${session.id},
                ${JSON.stringify({ via: 'employee_portal', settledBy: session.name })}::jsonb)
      `;

      try {
        await insertNotification({
          tenantSlug: session.tenantSlug,
          employeeId: expense.submitter_employee_id,
          type: 'success',
          category: 'finance',
          title: 'Expense Paid',
          message: `Your expense request has been paid by ${session.name}`,
          actionUrl: '/employee/dashboard?tab=expenses',
        });
      } catch (e) { console.error('Expense notification to employee failed:', (e as any)?.message); }

      return NextResponse.json({ success: true, status: "paid" });
    }

    // ------------------------------------------------------------------
    // Legacy fallback (no workflow row — pre-migration edge): decide
    // directly, book the liability on approval. Idempotent via
    // journal_entry_id.
    // ------------------------------------------------------------------
    let journalEntryId: string | null = expense.journal_entry_id ?? null;
    try {
      const { postGLEntry, GL_ACCOUNTS } = await import("@/lib/finance/gl");
      const amount = Number(expense.total_amount ?? expense.amount);
      const today = new Date().toISOString().split("T")[0];
      if (action === "approve" && amount > 0 && !journalEntryId) {
        const je = await postGLEntry({
          tenantSlug: session.tenantSlug,
          entryDate: today,
          journalType: "SYSTEM",
          referenceType: "employee_expense",
          referenceId: expenseId,
          status: "POSTED",
          description: `Employee expense — ${expense.category ?? "general"}`,
          lines: [
            { accountCode: GL_ACCOUNTS.GENERAL_EXPENSE, debitAmount: amount, description: `Expense ${expenseId}` },
            { accountCode: GL_ACCOUNTS.PAYROLL_PAYABLE, creditAmount: amount, description: `Payable to employee ${expense.submitter_employee_id}` },
          ],
        });
        journalEntryId = (je as any)?.id ?? null;
      }
    } catch (err) {
      console.error("Expense GL posting failed:", err);
    }

    const newStatus = action === "approve" ? "APPROVED" : "REJECTED";
    await SQL`
      UPDATE expenses
      SET approval_status = ${newStatus},
          journal_entry_id = coalesce(${journalEntryId}, journal_entry_id),
          updated_at = now()
      WHERE id = ${expenseId} AND tenant_slug = ${session.tenantSlug}
    `;
    await SQL`
      INSERT INTO expense_audit_logs (id, expense_id, action, user_id, details)
      VALUES (gen_random_uuid()::text, ${expenseId}, ${`APPROVAL_${newStatus}`}, ${session.id},
              ${JSON.stringify({ via: 'employee_portal_legacy', reason: comment ?? null })}::jsonb)
    `;

    try {
      await insertNotification({
        tenantSlug: session.tenantSlug,
        employeeId: expense.submitter_employee_id,
        type: action === 'approve' ? 'success' : 'warning',
        category: 'finance',
        title: `Expense ${action === 'approve' ? 'Approved' : 'Rejected'}`,
        message: `Your expense request has been ${newStatus.toLowerCase()} by ${session.name}${comment ? ': ' + comment : ''}`,
        actionUrl: '/employee/dashboard?tab=expenses',
      });
    } catch (e) { console.error('Expense notification to employee failed:', (e as any)?.message); }

    return NextResponse.json({ success: true, status: newStatus.toLowerCase() });
  } catch (error: any) {
    console.error("Portal expense approve error:", error?.message);
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
  }
}
