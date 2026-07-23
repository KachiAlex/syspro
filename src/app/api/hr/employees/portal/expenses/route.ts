import { NextRequest, NextResponse } from "next/server";
import { decodeEmployeeToken, resolveEmployeeSession } from "@/lib/hr/auth";
import { sql as SQL } from "@/lib/sql-client";
import { insertNotification } from "@/lib/hr/db";
import { z } from "zod";

/**
 * GET /api/hr/employees/portal/expenses
 * Returns the logged-in employee's expense requests.
 * HOD also sees pending expense requests from their department for approval.
 */
export async function GET(request: NextRequest) {
  const session = resolveEmployeeSession(request); if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const employeeRole = (session.role || "staff").toLowerCase();
    const isHOD = employeeRole === "hod" || employeeRole === "head_of_department";

    // Ensure table exists
    await SQL`
      create table if not exists admin_employee_expenses (
        id text primary key,
        tenant_slug text not null,
        employee_id text not null,
        employee_name text not null,
        department_id text,
        category text not null,
        description text not null,
        amount numeric not null,
        currency text default 'NGN',
        date text not null,
        receipt_url text,
        status text not null default 'pending' check (status in ('pending','approved','rejected','paid')),
        approver_id text,
        approver_name text,
        approver_comment text,
        approved_at timestamptz,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      )
    `;
    await SQL`create index if not exists idx_emp_expenses_tenant on admin_employee_expenses(tenant_slug)`;
    await SQL`create index if not exists idx_emp_expenses_emp on admin_employee_expenses(tenant_slug, employee_id)`;
    await SQL`create index if not exists idx_emp_expenses_status on admin_employee_expenses(status)`;

    // Fetch employee's own expenses
    let myExpenses: any[] = [];
    try {
      myExpenses = await SQL`
        SELECT * FROM admin_employee_expenses
        WHERE tenant_slug = ${session.tenantSlug} AND employee_id = ${session.id}
        ORDER BY created_at DESC LIMIT 100
      `;
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
          pendingApprovals = await SQL`
            SELECT e.*, emp.name as employee_name, emp.job_title as employee_job_title
            FROM admin_employee_expenses e
            JOIN admin_employees emp ON e.employee_id = emp.id
            WHERE e.tenant_slug = ${session.tenantSlug}
              AND e.department_id = ${deptId}
              AND e.status = 'pending'
              AND e.employee_id != ${session.id}
            ORDER BY e.created_at DESC LIMIT 100
          `;
        }
      } catch (e) {
        console.error("Portal expenses approvals query failed:", (e as any)?.message);
      }
    }

    return NextResponse.json({
      expenses: myExpenses,
      pendingApprovals,
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
 * Submit a new expense request.
 */
export async function POST(request: NextRequest) {
  const session = resolveEmployeeSession(request); if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = createExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { randomUUID } = await import("crypto");
    const id = randomUUID();
    const d = parsed.data;

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

    await SQL`
      INSERT INTO admin_employee_expenses
        (id, tenant_slug, employee_id, employee_name, department_id,
         category, description, amount, currency, date, receipt_url, status)
      VALUES
        (${id}, ${session.tenantSlug}, ${session.id}, ${session.name}, ${deptId},
         ${d.category}, ${d.description}, ${d.amount}, ${d.currency},
         ${d.date}, ${d.receiptUrl || null}, 'pending')
    `;

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
 * HOD approves/rejects an expense request.
 */
export async function PATCH(request: NextRequest) {
  const session = resolveEmployeeSession(request); if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const employeeRole = (session.role || "staff").toLowerCase();
  const isHOD = employeeRole === "hod" || employeeRole === "head_of_department";
  const isHR = employeeRole === "hr" || employeeRole === "hr_admin" || employeeRole === "hr_manager";

  if (!isHOD && !isHR) {
    return NextResponse.json({ error: "Only HODs and HR can approve expenses" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { expenseId, action, comment } = body;

    if (!expenseId || !action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Missing or invalid expenseId/action" }, { status: 400 });
    }

    const newStatus = action === "approve" ? "approved" : "rejected";

    // If HOD, verify expense is from their department
    if (isHOD && !isHR) {
      const empInfo = await SQL`
        SELECT department_id FROM admin_employees
        WHERE id = ${session.id} AND tenant_slug = ${session.tenantSlug}
        LIMIT 1
      `;
      const hodDept = empInfo[0]?.department_id;

      const expenseInfo = await SQL`
        SELECT department_id FROM admin_employee_expenses
        WHERE id = ${expenseId} AND tenant_slug = ${session.tenantSlug}
        LIMIT 1
      `;

      if (expenseInfo.length === 0) {
        return NextResponse.json({ error: "Expense not found" }, { status: 404 });
      }

      if (expenseInfo[0].department_id !== hodDept) {
        return NextResponse.json({ error: "You can only approve expenses from your department" }, { status: 403 });
      }
    }

    // Get employee_id for notification
    const expRow = await SQL`SELECT employee_id FROM admin_employee_expenses WHERE id = ${expenseId} AND tenant_slug = ${session.tenantSlug} LIMIT 1`;

    await SQL`
      UPDATE admin_employee_expenses
      SET status = ${newStatus},
          approver_id = ${session.id},
          approver_name = ${session.name},
          approver_comment = ${comment || null},
          approved_at = now(),
          updated_at = now()
      WHERE id = ${expenseId} AND tenant_slug = ${session.tenantSlug}
    `;

    // Notify the employee about the decision
    try {
      if (expRow.length > 0) {
        await insertNotification({
          tenantSlug: session.tenantSlug,
          employeeId: expRow[0].employee_id,
          type: action === 'approve' ? 'success' : 'warning',
          category: 'finance',
          title: `Expense ${action === 'approve' ? 'Approved' : 'Rejected'}`,
          message: `Your expense request has been ${newStatus} by ${session.name}${comment ? ': ' + comment : ''}`,
          actionUrl: '/employee/dashboard?tab=expenses',
        });
      }
    } catch (e) { console.error('Expense notification to employee failed:', (e as any)?.message); }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error: any) {
    console.error("Portal expense approve error:", error?.message);
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
  }
}
