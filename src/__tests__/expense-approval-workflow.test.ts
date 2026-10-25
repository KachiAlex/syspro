import { describe, it, expect, beforeAll, afterAll } from "vitest";
import process from "node:process";
import { randomUUID } from "node:crypto";

/**
 * Expense approval workflow: finance `expenses` and employee-portal
 * `admin_employee_expenses` routed through the shared approvals engine.
 * Skipped without DATABASE_URL — the suite is DB-backed.
 */

const T = 240000;
const HAS_DB = !!process.env.DATABASE_URL;
const TENANT = `__expwf_${Date.now()}__`;
const FREE_TENANT = `__expwf_free_${Date.now()}__`;
const DEPT = `dept-${randomUUID().slice(0, 8)}`;
const DEPT_MGR = `mgr-${randomUUID().slice(0, 8)}`;
let db: any;

async function cleanupTenant(t: string) {
  await db.query(`delete from expense_audit_logs where expense_id in (select id from expenses where tenant_slug = $1)`, [t]);
  await db.query(`delete from expense_approvals where expense_id in (select id from expenses where tenant_slug = $1)`, [t]);
  await db.query(`delete from expenses where tenant_slug = $1`, [t]);
  await db.query(`delete from admin_employee_expenses where tenant_slug = $1`, [t]);
  await db.query(`delete from approvals where tenant_slug = $1`, [t]);
  await db.query(`delete from approval_rules where tenant_slug = $1`, [t]);
  await db.query(
    `do $$ begin
       delete from approval_delegates where tenant_slug = '${t}';
     exception when undefined_table then null; end $$`
  );
  await db.query(`delete from journal_entry_lines where entry_id in (select id from journal_entries where tenant_slug = $1)`, [t]);
  await db.query(`delete from journal_entries where tenant_slug = $1`, [t]);
  await db.query(`delete from admin_employees where tenant_slug = $1`, [t]);
  await db.query(`delete from admin_departments where tenant_slug = $1`, [t]);
  await db.query(`delete from tenants where slug = $1`, [t]);
}

async function cleanup() {
  await cleanupTenant(TENANT);
  await cleanupTenant(FREE_TENANT);
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  db = (await import("../lib/sql-client")).db;
  await cleanup();
  // TENANT: expenseMinAmount=0 → every expense is workflow-gated.
  await db.query(
    `insert into tenants (name, slug, settings, seats) values ($1, $2, $3::jsonb, 1)
     on conflict (slug) do nothing`,
    ["Expense Workflow", TENANT, JSON.stringify({ approvals: { expenseMinAmount: 0 } })]
  );
  // FREE_TENANT: nothing configured → no gating for finance expenses.
  await db.query(
    `insert into tenants (name, slug, settings, seats) values ($1, $2, '{}'::jsonb, 1)
     on conflict (slug) do nothing`,
    ["Expense Workflow Free", FREE_TENANT]
  );
  const { ensureApprovalTables } = await import("../lib/finance/approvals");
  await ensureApprovalTables();
  const { seedExpenseCategories } = await import("../lib/finance/db");
  await seedExpenseCategories();
  const { ensureAdminTables } = await import("../lib/admin/db");
  await ensureAdminTables();

  // Department with a concrete manager for chain resolution.
  await db.query(
    `insert into admin_departments (id, tenant_slug, name, manager_id)
     values ($1, $2, $3, $4)`,
    [DEPT, TENANT, "Engineering", DEPT_MGR]
  );
}, T);

afterAll(async () => { if (db) await cleanup(); }, T);

describe.skipIf(!HAS_DB)("expense approval workflow", () => {
  it("requiresApproval: employee_expense always gates, expense honors tenant settings", async () => {
    const { requiresApproval } = await import("../lib/finance/approvals");
    expect(await requiresApproval(TENANT, "employee_expense", { amount: 1 })).toBe(true);
    expect(await requiresApproval(FREE_TENANT, "employee_expense", { amount: 1 })).toBe(true);
    // expenseMinAmount: 0 → gate everything for TENANT; FREE_TENANT ungated
    expect(await requiresApproval(TENANT, "expense", { amount: 1 })).toBe(true);
    expect(await requiresApproval(FREE_TENANT, "expense", { amount: 999999 })).toBe(false);
  }, T);

  it("department manager resolves into the chain and decides step 0", async () => {
    const { initiateApproval, processApprovalDecision } = await import("../lib/finance/approvals");
    const { createExpense, getExpense } = await import("../lib/finance/db");

    const expense = await createExpense({
      tenantSlug: TENANT,
      type: "vendor",
      amount: 1000,
      taxType: "NONE",
      category: "Office Supplies",
      categoryId: "cat_supplies",
      description: "Pens and paper",
      date: "2026-10-20",
      approvalStatus: "PENDING",
      paymentStatus: "UNPAID",
      createdBy: "staff-1",
      departmentId: DEPT,
    } as any);

    const approval = await initiateApproval({
      tenantSlug: TENANT,
      entityType: "expense",
      entityId: expense.id,
      requestedBy: "staff-1",
      entityData: { amount: 1000, departmentId: DEPT, categoryId: "cat_supplies" },
    });

    // role:dept_manager resolved to the concrete department manager
    const step0 = approval.approverChain.filter((s) => s.step === 0);
    expect(step0.map((s) => s.userId)).toContain(DEPT_MGR);

    // A random user cannot decide the step
    await expect(
      processApprovalDecision({ approvalId: approval.id, userId: "rando", decision: "approved" })
    ).rejects.toThrow();

    const decided = await processApprovalDecision({
      approvalId: approval.id, userId: DEPT_MGR, decision: "approved",
    });
    expect(decided?.status).toBe("approved");

    const updated = await getExpense(expense.id, TENANT);
    expect(updated?.approvalStatus).toBe("APPROVED");
    // Accrual posted on approval
    const je = (await db.query(`select journal_entry_id from expenses where id = $1`, [expense.id])).rows[0];
    expect(je.journal_entry_id).toBeTruthy();
  }, T);

  it("amount over step-2 threshold adds a finance step before terminal approval", async () => {
    const { initiateApproval, processApprovalDecision } = await import("../lib/finance/approvals");
    const { createExpense, getExpense } = await import("../lib/finance/db");

    const expense = await createExpense({
      tenantSlug: TENANT,
      type: "vendor",
      amount: 60000,
      taxType: "NONE",
      category: "Office Supplies",
      categoryId: "cat_supplies",
      description: "New laptops",
      date: "2026-10-20",
      approvalStatus: "PENDING",
      paymentStatus: "UNPAID",
      createdBy: "staff-2",
      departmentId: DEPT,
    } as any);

    const approval = await initiateApproval({
      tenantSlug: TENANT,
      entityType: "expense",
      entityId: expense.id,
      requestedBy: "staff-2",
      entityData: { amount: 60000, departmentId: DEPT },
    });
    // chain has a step 1 awaiting a finance_manager
    expect(Math.max(...approval.approverChain.map((s) => s.step))).toBeGreaterThanOrEqual(1);

    // Dept manager approves — chain advances, expense stays PENDING
    const step1 = await processApprovalDecision({
      approvalId: approval.id, userId: DEPT_MGR, decision: "approved",
    });
    expect(step1?.status).toBe("pending");
    expect(step1?.currentStep).toBe(1);
    let row = await getExpense(expense.id, TENANT);
    expect(row?.approvalStatus).toBe("PENDING");

    // finance_manager completes the chain
    const step2 = await processApprovalDecision({
      approvalId: approval.id, userId: "fin-1", userRole: "finance_manager", decision: "approved",
    });
    expect(step2?.status).toBe("approved");
    row = await getExpense(expense.id, TENANT);
    expect(row?.approvalStatus).toBe("APPROVED");
  }, T);

  it("clarification flags the expense and resubmission resets the chain", async () => {
    const { initiateApproval, processApprovalDecision, resetApprovalForResubmission } =
      await import("../lib/finance/approvals");
    const { createExpense, getExpense } = await import("../lib/finance/db");

    const expense = await createExpense({
      tenantSlug: TENANT,
      type: "cash",
      amount: 500,
      taxType: "NONE",
      category: "Office Supplies",
      categoryId: "cat_supplies",
      description: "Taxi fare",
      date: "2026-10-20",
      approvalStatus: "PENDING",
      paymentStatus: "UNPAID",
      createdBy: "staff-3",
      departmentId: DEPT,
    } as any);

    const approval = await initiateApproval({
      tenantSlug: TENANT,
      entityType: "expense",
      entityId: expense.id,
      requestedBy: "staff-3",
      entityData: { amount: 500, departmentId: DEPT },
    });

    await processApprovalDecision({
      approvalId: approval.id, userId: DEPT_MGR,
      decision: "clarification_needed", comments: "Attach the receipt",
    });
    let row = await getExpense(expense.id, TENANT);
    expect(row?.approvalStatus).toBe("CLARIFY_NEEDED");
    // chain itself stays pending
    let wf = (await db.query(`select status, current_step from approvals where id = $1`, [approval.id])).rows[0];
    expect(wf.status).toBe("pending");

    const reset = await resetApprovalForResubmission(TENANT, "expense", expense.id);
    expect(reset?.currentStep).toBe(0);
    expect(reset?.status).toBe("pending");
  }, T);

  it("employee_expense approval marks admin_employee_expenses and posts the liability", async () => {
    const { initiateApproval, processApprovalDecision } = await import("../lib/finance/approvals");

    const id = randomUUID();
    await db.query(
      `create table if not exists admin_employee_expenses (
        id text primary key, tenant_slug text not null, employee_id text not null,
        employee_name text not null, department_id text, category text not null,
        description text not null, amount numeric not null, currency text default 'NGN',
        date text not null, receipt_url text, status text not null default 'pending',
        approver_id text, approver_name text, approver_comment text,
        approved_at timestamptz, journal_entry_id text, approval_id text,
        created_at timestamptz default now(), updated_at timestamptz default now()
      )`
    );
    await db.query(`alter table admin_employee_expenses
      add column if not exists journal_entry_id text,
      add column if not exists approval_id text`);
    await db.query(
      `insert into admin_employee_expenses
        (id, tenant_slug, employee_id, employee_name, department_id, category, description, amount, date, status)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')`,
      [id, TENANT, "emp-9", "Emp Nine", DEPT, "Travel", "Bus fare", 250, "2026-10-20"]
    );

    const approval = await initiateApproval({
      tenantSlug: TENANT,
      entityType: "employee_expense",
      entityId: id,
      requestedBy: "emp-9",
      entityData: { amount: 250, departmentId: DEPT },
    });
    await db.query(`update admin_employee_expenses set approval_id = $1 where id = $2`, [approval.id, id]);

    await processApprovalDecision({
      approvalId: approval.id, userId: DEPT_MGR, decision: "approved",
    });

    const row = (await db.query(
      `select status, journal_entry_id, approver_id from admin_employee_expenses where id = $1`, [id])).rows[0];
    expect(row.status).toBe("approved");
    expect(row.approver_id).toBe(DEPT_MGR);
    expect(row.journal_entry_id).toBeTruthy();
  }, T);

  it("category_based rules match on expense categoryId", async () => {
    const { createApprovalRule, requiresApproval } = await import("../lib/finance/approvals");
    await createApprovalRule({
      tenantSlug: FREE_TENANT,
      entityType: "expense",
      ruleType: "category_based",
      conditions: { categoryId: "cat_travel" },
      approvers: [{ step: 0, userId: DEPT_MGR, required: true, order: 0 }],
    });
    expect(await requiresApproval(FREE_TENANT, "expense", { amount: 10, categoryId: "cat_travel" })).toBe(true);
    expect(await requiresApproval(FREE_TENANT, "expense", { amount: 10, categoryId: "cat_supplies" })).toBe(false);
  }, T);

  it("delegation lets a delegate act on the delegator's step", async () => {
    const {
      initiateApproval, processApprovalDecision, createDelegate,
      revokeDelegate, getPendingApprovalsForUser,
    } = await import("../lib/finance/approvals");
    const { createExpense } = await import("../lib/finance/db");
    const DELEGATE = `dlg-${randomUUID().slice(0, 8)}`;

    const expense = await createExpense({
      tenantSlug: TENANT,
      type: "vendor",
      amount: 700,
      taxType: "NONE",
      category: "Office Supplies",
      categoryId: "cat_supplies",
      description: "Delegation test",
      date: "2026-10-21",
      approvalStatus: "PENDING",
      paymentStatus: "UNPAID",
      createdBy: "staff-4",
      departmentId: DEPT,
    } as any);

    const approval = await initiateApproval({
      tenantSlug: TENANT,
      entityType: "expense",
      entityId: expense.id,
      requestedBy: "staff-4",
      entityData: { amount: 700, departmentId: DEPT },
    });

    // Delegate cannot act before a grant exists
    await expect(
      processApprovalDecision({ approvalId: approval.id, userId: DELEGATE, decision: "approved" })
    ).rejects.toThrow();

    await createDelegate({
      tenantSlug: TENANT,
      delegatorId: DEPT_MGR,
      delegateId: DELEGATE,
      entityType: "expense",
      note: "Out of office",
    });

    // Delegated items surface in the delegate's inbox
    const inbox = await getPendingApprovalsForUser(TENANT, DELEGATE);
    expect(inbox.map((a) => a.id)).toContain(approval.id);

    const decided = await processApprovalDecision({
      approvalId: approval.id, userId: DELEGATE, decision: "approved",
    });
    expect(decided?.status).toBe("approved");
    const last = decided?.decisions[decided.decisions.length - 1];
    expect(last?.userId).toBe(DELEGATE);
    expect(last?.delegatedFor).toBe(DEPT_MGR);

    // After revocation the delegate can no longer act
    const expense2 = await createExpense({
      tenantSlug: TENANT,
      type: "vendor",
      amount: 700,
      taxType: "NONE",
      category: "Office Supplies",
      categoryId: "cat_supplies",
      description: "Post-revocation",
      date: "2026-10-21",
      approvalStatus: "PENDING",
      paymentStatus: "UNPAID",
      createdBy: "staff-4",
      departmentId: DEPT,
    } as any);
    const approval2 = await initiateApproval({
      tenantSlug: TENANT,
      entityType: "expense",
      entityId: expense2.id,
      requestedBy: "staff-4",
      entityData: { amount: 700, departmentId: DEPT },
    });
    const grant = (await db.query(
      `select id from approval_delegates where tenant_slug = $1 and delegate_id = $2`,
      [TENANT, DELEGATE])).rows[0];
    await revokeDelegate(TENANT, grant.id);
    await expect(
      processApprovalDecision({ approvalId: approval2.id, userId: DELEGATE, decision: "approved" })
    ).rejects.toThrow();
  }, T);

  it("SLA sweep reminds once per step and can auto-escalate", async () => {
    const {
      createApprovalRule, initiateApproval, escalateStaleApprovals,
      updateApprovalRule, deleteApprovalRule,
    } = await import("../lib/finance/approvals");
    const { createExpense } = await import("../lib/finance/db");

    // Rule with slaAction=remind
    const rule = await createApprovalRule({
      tenantSlug: TENANT,
      entityType: "expense",
      ruleType: "amount_based",
      conditions: { minAmount: 0, slaHours: 24, slaAction: "remind" },
      approvers: [{ step: 0, userId: DEPT_MGR, required: true, order: 0 }],
      priority: 99,
    });

    const expense = await createExpense({
      tenantSlug: TENANT,
      type: "vendor",
      amount: 100,
      taxType: "NONE",
      category: "Office Supplies",
      categoryId: "cat_supplies",
      description: "SLA remind",
      date: "2026-10-21",
      approvalStatus: "PENDING",
      paymentStatus: "UNPAID",
      createdBy: "staff-5",
      departmentId: DEPT,
    } as any);
    const approval = await initiateApproval({
      tenantSlug: TENANT,
      entityType: "expense",
      entityId: expense.id,
      requestedBy: "staff-5",
      entityData: { amount: 100, departmentId: DEPT },
    });

    // Not yet stale — nothing fires
    let out = await escalateStaleApprovals(TENANT);
    expect(out.reminded).toBe(0);
    expect(out.escalated).toBe(0);

    // Backdate past the SLA window
    await db.query(`update approvals set updated_at = now() - interval '25 hours' where id = $1`, [approval.id]);
    out = await escalateStaleApprovals(TENANT);
    expect(out.reminded).toBeGreaterThanOrEqual(1);
    let meta = (await db.query(`select metadata from approvals where id = $1`, [approval.id])).rows[0].metadata;
    expect(meta.slaFiredSteps).toContain(0);

    // Second run: step already fired → no repeat reminder
    out = await escalateStaleApprovals(TENANT);
    expect(out.reminded).toBe(0);

    // Switch the rule to escalate and reset the fired marker
    await updateApprovalRule(TENANT, rule.id, {
      conditions: { minAmount: 0, slaHours: 24, slaAction: "escalate" },
      approvers: [
        { step: 0, userId: DEPT_MGR, required: true, order: 0 },
        { step: 1, userId: "role:finance_manager", required: true, order: 1 },
      ],
    });
    await db.query(
      `update approvals set metadata = metadata - 'slaFiredSteps', approver_chain = $2::jsonb where id = $1`,
      [approval.id, JSON.stringify([
        { step: 0, userId: DEPT_MGR, required: true, order: 0 },
        { step: 1, userId: "role:finance_manager", required: true, order: 1 },
      ])]
    );
    out = await escalateStaleApprovals(TENANT);
    expect(out.escalated).toBeGreaterThanOrEqual(1);
    const wf = (await db.query(`select status, current_step from approvals where id = $1`, [approval.id])).rows[0];
    expect(wf.status).toBe("escalated");
    expect(wf.current_step).toBe(1);

    await deleteApprovalRule(TENANT, rule.id);
    const gone = (await db.query(`select id from approval_rules where id = $1`, [rule.id])).rows;
    expect(gone.length).toBe(0);
  }, T);
});
