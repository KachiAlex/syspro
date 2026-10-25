import { describe, it, expect, beforeAll, afterAll } from "vitest";
import process from "node:process";
import { randomUUID } from "node:crypto";

/**
 * Gated actions: the declarative maker-checker registry + delegation-of-
 * authority matrix. Covers block-mode staging/replay, override-mode caps,
 * review-mode post-hoc + reverse, matrix chain building, officer escalation.
 * Skipped without DATABASE_URL — the suite is DB-backed.
 */

const T = 240000;
const HAS_DB = !!process.env.DATABASE_URL;
const TENANT = `__gated_${Date.now()}__`;
const MATRIX_TENANT = `__gated_mx_${Date.now()}__`;
let db: any;

async function cleanupTenant(t: string) {
  await db.query(`delete from pos_cash_movements where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from pos_shifts where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from admin_user_roles where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from admin_role_history where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from admin_roles where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from admin_payroll_adjustments where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from staff_advance_applications where advance_id in (select id from staff_advances where tenant_slug = $1)`, [t]).catch(() => {});
  await db.query(`delete from staff_advances where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from vendors where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from admin_employees where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from gate_test_scratch where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from approvals where tenant_slug = $1`, [t]);
  await db.query(`delete from approval_rules where tenant_slug = $1`, [t]);
  await db.query(`delete from journal_entry_lines where entry_id in (select id from journal_entries where tenant_slug = $1)`, [t]);
  await db.query(`delete from journal_entries where tenant_slug = $1`, [t]);
  await db.query(`delete from tenants where slug = $1`, [t]);
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  db = (await import("../lib/sql-client")).db;
  await cleanupTenant(TENANT);
  await cleanupTenant(MATRIX_TENANT);
  const { ensureApprovalTables } = await import("../lib/finance/approvals");
  await ensureApprovalTables();
  const { ensureHrTables } = await import("../lib/hr/db");
  const { sql } = await import("../lib/sql-client");
  await ensureHrTables(sql);

  // TENANT: no matrix — actions gate via def.always. Officers configured so
  // forceOfficerApproval resolves to a concrete user.
  await db.query(
    `insert into tenants (name, slug, settings, seats) values ($1, $2, $3::jsonb, 1)
     on conflict (slug) do nothing`,
    ["Gated Actions", TENANT, JSON.stringify({
      approvals: { officers: [{ title: "Managing Director", userIds: ["md-user-1"] }] },
      pos: { cashMovementCap: 1000 },
    })]
  );

  // MATRIX_TENANT: DoA matrix — spend band routes to an officer; inventory
  // band auto-approves; master_data band is review-mode.
  await db.query(
    `insert into tenants (name, slug, settings, seats) values ($1, $2, $3::jsonb, 1)
     on conflict (slug) do nothing`,
    ["Gated Matrix", MATRIX_TENANT, JSON.stringify({
      approvals: {
        officers: [{ title: "Managing Director", userIds: ["mx-md-1"] }],
        authorityMatrix: {
          spend: [
            { upTo: 1000, approvers: ["finance_manager"] },
            { upTo: null, approvers: ["finance_manager", "officer:Managing Director"] },
          ],
          inventory: [{ upTo: null, approvers: [] }],
          master_data: [{ upTo: null, approvers: ["finance_manager"], mode: "review" }],
        },
      },
    })]
  );

  await db.query(
    `create table if not exists gate_test_scratch (
       id text primary key, tenant_slug text, note text)`
  ).catch(() => {});
}, T);

afterAll(async () => {
  if (!db) return;
  await cleanupTenant(TENANT);
  await cleanupTenant(MATRIX_TENANT);
}, T);

async function decide(approvalId: string, decision: "approved" | "rejected", userId = "approver-1", userRole = "admin") {
  const { processApprovalDecision } = await import("../lib/finance/approvals");
  return processApprovalDecision({ approvalId, userId, userRole, decision });
}

async function decideToTerminal(approvalId: string, decision: "approved" | "rejected" = "approved", userId = "approver-1", userRole = "admin") {
  let approval = await decide(approvalId, decision, userId, userRole);
  let guard = 0;
  while (approval && approval.status !== "approved" && approval.status !== "rejected" && guard++ < 10) {
    approval = await decide(approvalId, "approved", userId, userRole);
  }
  return approval;
}

describe.skipIf(!HAS_DB)("gated actions", () => {
  it("vendor_bank_change: stages pending details; approval applies + stamps fraud window", async () => {
    const { createVendor } = await import("../lib/finance/vendors");
    const vendor = await createVendor({
      tenantSlug: TENANT, name: "Gate Vendor", code: `GV-${Date.now()}`,
      accountNumber: "111", bankCode: "AAA", bankName: "Old Bank",
    } as any);

    const { gateOrRun } = await import("../lib/finance/gated-actions");
    const outcome = await gateOrRun(TENANT, "vendor_bank_change", {
      vendorId: vendor.id, vendorName: "Gate Vendor",
      bankChanges: { accountNumber: "999" },
    }, { requestedBy: "finance-staff" });
    expect(outcome.status).toBe("pending");

    const [staged] = (await db.query(
      `select bank_details, pending_bank_details, bank_details_changed_at from vendors where id = $1`,
      [vendor.id]
    )).rows as any[];
    expect((staged.bank_details as any).accountNumber).toBe("111");
    expect((staged.pending_bank_details as any).accountNumber).toBe("999");
    expect(staged.bank_details_changed_at).toBeNull();

    const approvalId = (outcome as any).approvalId;
    await decideToTerminal(approvalId);

    const [applied] = (await db.query(
      `select bank_details, pending_bank_details, bank_details_changed_at is not null as stamped from vendors where id = $1`,
      [vendor.id]
    )).rows as any[];
    expect((applied.bank_details as any).accountNumber).toBe("999");
    // Untouched fields survive the merge
    expect((applied.bank_details as any).bankCode).toBe("AAA");
    expect(applied.pending_bank_details).toBeNull();
    expect(applied.stamped).toBe(true);
  }, T);

  it("vendor_bank_change: rejection clears the staged details without applying", async () => {
    const { createVendor } = await import("../lib/finance/vendors");
    const vendor = await createVendor({
      tenantSlug: TENANT, name: "Reject Vendor", code: `RV-${Date.now()}`,
      accountNumber: "111", bankCode: "AAA",
    } as any);

    const { gateOrRun } = await import("../lib/finance/gated-actions");
    const outcome = await gateOrRun(TENANT, "vendor_bank_change", {
      vendorId: vendor.id, bankChanges: { accountNumber: "555" },
    }, { requestedBy: "finance-staff" });
    expect(outcome.status).toBe("pending");

    await decideToTerminal((outcome as any).approvalId, "rejected");

    const [row] = (await db.query(
      `select bank_details, pending_bank_details from vendors where id = $1`, [vendor.id]
    )).rows as any[];
    expect((row.bank_details as any).accountNumber).toBe("111");
    expect(row.pending_bank_details).toBeNull();
  }, T);

  it("payroll_adjustment: no row until approval; approval creates it pending", async () => {
    const { gateOrRun } = await import("../lib/finance/gated-actions");
    const outcome = await gateOrRun(TENANT, "payroll_adjustment", {
      tenantSlug: TENANT, employeeId: `emp_${randomUUID().slice(0, 6)}`,
      type: "increment", category: "bonus", amount: 25000,
      reason: "Test bonus", effectivePeriod: "2026-10",
    }, { requestedBy: "hr-staff" });
    expect(outcome.status).toBe("pending");

    let rows = (await db.query(
      `select * from admin_payroll_adjustments where tenant_slug = $1`, [TENANT]
    )).rows as any[];
    expect(rows.length).toBe(0);

    await decideToTerminal((outcome as any).approvalId);

    rows = (await db.query(
      `select status, amount::float a, approved_by from admin_payroll_adjustments where tenant_slug = $1`, [TENANT]
    )).rows as any[];
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe("pending");
    expect(Number(rows[0].a)).toBe(25000);
    expect(rows[0].approved_by).toBeTruthy();
  }, T);

  it("imprest_advance: staged; approval issues the advance and posts the JE", async () => {
    const { gateOrRun } = await import("../lib/finance/gated-actions");
    const outcome = await gateOrRun(TENANT, "imprest_advance", {
      employeeName: "Field Staff", amount: 50000,
      purpose: "Site logistics", issueDate: "2026-10-20",
    }, { requestedBy: "finance-staff" });
    expect(outcome.status).toBe("pending");

    let rows = (await db.query(
      `select * from staff_advances where tenant_slug = $1`, [TENANT]
    )).rows as any[];
    expect(rows.length).toBe(0);

    await decideToTerminal((outcome as any).approvalId);

    rows = (await db.query(
      `select status, amount::float a, journal_entry_id from staff_advances where tenant_slug = $1`, [TENANT]
    )).rows as any[];
    expect(rows.length).toBe(1);
    expect(Number(rows[0].a)).toBe(50000);
    expect(rows[0].journal_entry_id).toBeTruthy();
  }, T);

  it("role_assignment: grant applies only after approval", async () => {
    const empId = `emp_${randomUUID().slice(0, 8)}`;
    const roleId = `role_${randomUUID().slice(0, 8)}`;
    await db.query(
      `insert into admin_employees (id, tenant_slug, name, email, status, role)
       values ($1, $2, 'Target User', $3, 'active', 'staff')`,
      [empId, TENANT, `${empId}@test.local`]
    );
    await db.query(
      `insert into admin_roles (id, tenant_slug, name, scope, permissions, is_system)
       values ($1, $2, 'Finance Manager', 'tenant', '{finance:write}', false)`,
      [roleId, TENANT]
    );

    const { gateOrRun } = await import("../lib/finance/gated-actions");
    const outcome = await gateOrRun(TENANT, "role_assignment", {
      userId: empId, newRoleId: roleId, userEmail: `${empId}@test.local`,
      roleName: "Finance Manager", assignedBy: "hr-staff",
    }, { requestedBy: "hr-staff" });
    expect(outcome.status).toBe("pending");

    let roles = (await db.query(
      `select * from admin_user_roles where tenant_slug = $1 and user_id = $2`, [TENANT, empId]
    )).rows as any[];
    expect(roles.length).toBe(0);

    await decideToTerminal((outcome as any).approvalId);

    roles = (await db.query(
      `select role_id from admin_user_roles where tenant_slug = $1 and user_id = $2`, [TENANT, empId]
    )).rows as any[];
    expect(roles.length).toBe(1);
    expect(roles[0].role_id).toBe(roleId);
    const history = (await db.query(
      `select new_role_id from admin_role_history where tenant_slug = $1 and user_id = $2`, [TENANT, empId]
    )).rows as any[];
    expect(history.length).toBe(1);
  }, T);

  it("pos_cash_movement: under cap runs free; over cap needs an authorized overrideBy", async () => {
    // Open a shift so movements have somewhere to land.
    const shiftId = `shift_${randomUUID().slice(0, 8)}`;
    await db.query(
      `insert into pos_shifts (id, tenant_slug, status, opened_by, opening_float, opened_at)
       values ($1, $2, 'open', 'cashier-1', 0, now())`,
      [shiftId, TENANT]
    );

    const { gateOrRun } = await import("../lib/finance/gated-actions");
    const small = await gateOrRun(TENANT, "pos_cash_movement", {
      shiftId, type: "pay_out", amount: 500, reason: "change run",
    }, { requestedBy: "cashier-1" });
    expect(small.status).toBe("ran");

    const big = await gateOrRun(TENANT, "pos_cash_movement", {
      shiftId, type: "pay_out", amount: 5000, reason: "supplier drop",
    }, { requestedBy: "cashier-1" });
    expect(big.status).toBe("denied");

    const overridden = await gateOrRun(TENANT, "pos_cash_movement", {
      shiftId, type: "pay_out", amount: 5000, reason: "supplier drop",
      overrideBy: "md-user-1",
    }, { requestedBy: "cashier-1" });
    expect(overridden.status).toBe("ran");

    const movements = (await db.query(
      `select type, amount::float a from pos_cash_movements where tenant_slug = $1 order by created_at`, [TENANT]
    )).rows as any[];
    expect(movements.filter((m) => m.type === "pay_out").length).toBe(2);
  }, T);

  it("authority matrix: spend bands build the chain; empty approvers auto-approve", async () => {
    const { requiresApproval, initiateApproval } = await import("../lib/finance/approvals");

    // spend band upTo 1000 → single finance_manager step
    expect(await requiresApproval(MATRIX_TENANT, "gated_action", {
      domain: "spend", amount: 500,
    })).toBe(true);
    const low = await initiateApproval({
      tenantSlug: MATRIX_TENANT, entityType: "gated_action",
      entityId: `ga_${randomUUID()}`, requestedBy: "tester",
      entityData: { domain: "spend", amount: 500, action: "x", payload: {}, reference: "low" },
    });
    expect(low.approverChain.length).toBe(1);
    expect(low.approverChain[0].userId).toBe("role:finance_manager");

    // spend over band 1 → adds the officer step (resolved to concrete id)
    const high = await initiateApproval({
      tenantSlug: MATRIX_TENANT, entityType: "gated_action",
      entityId: `ga_${randomUUID()}`, requestedBy: "tester",
      entityData: { domain: "spend", amount: 5000000, action: "x", payload: {}, reference: "high" },
    });
    const steps = [...new Set(high.approverChain.map((s) => s.step))].sort();
    expect(steps.length).toBe(2);
    expect(high.approverChain.some((s) => s.userId === "mx-md-1")).toBe(true);

    // inventory band approvers:[] → auto-approve
    expect(await requiresApproval(MATRIX_TENANT, "gated_action", {
      domain: "inventory", amount: 999999,
    })).toBe(false);
  }, T);

  it("review mode: applies immediately, lands post-hoc, rejection reverses", async () => {
    const { registerGatedAction, gateOrRun } = await import("../lib/finance/gated-actions");
    registerGatedAction("test_review_scratch", {
      domain: "master_data",
      mode: "block", // band overrides to review
      amount: () => 0,
      describe: () => "scratch write",
      run: async (tenantSlug: string, p: any) => {
        await db.query(`insert into gate_test_scratch (id, tenant_slug, note) values ($1, $2, $3)`, [p.id, tenantSlug, "written"]);
        return { ok: true };
      },
      reverse: async (tenantSlug: string, p: any) => {
        await db.query(`delete from gate_test_scratch where id = $1 and tenant_slug = $2`, [p.id, tenantSlug]);
      },
    });

    const scratchId = `scratch_${randomUUID().slice(0, 8)}`;
    const outcome = await gateOrRun(MATRIX_TENANT, "test_review_scratch", { id: scratchId }, { requestedBy: "tester" });
    expect(outcome.status).toBe("ran");
    expect((outcome as any).reviewApprovalId).toBeTruthy();

    // Effect applied immediately even though the review is still pending.
    let rows = (await db.query(`select * from gate_test_scratch where id = $1`, [scratchId])).rows;
    expect(rows.length).toBe(1);
    const approval = (await db.query(`select status from approvals where id = $1`, [(outcome as any).reviewApprovalId])).rows[0];
    expect(approval.status).toBe("pending");

    // Rejection reverses the effect.
    await decideToTerminal((outcome as any).reviewApprovalId, "rejected");
    rows = (await db.query(`select * from gate_test_scratch where id = $1`, [scratchId])).rows;
    expect(rows.length).toBe(0);
  }, T);

  it("forceOfficerApproval appends a company-officer step regardless of amount", async () => {
    const { initiateApproval } = await import("../lib/finance/approvals");
    const approval = await initiateApproval({
      tenantSlug: TENANT, entityType: "gated_action",
      entityId: `ga_${randomUUID()}`, requestedBy: "tester",
      entityData: {
        domain: "spend", amount: 1, action: "x", payload: {},
        reference: "risk-escalated", forceOfficerApproval: true,
      },
    });
    const maxStep = Math.max(...approval.approverChain.map((s) => s.step));
    const officerSteps = approval.approverChain.filter((s) => s.step === maxStep);
    expect(officerSteps.some((s) => s.userId === "md-user-1")).toBe(true);
  }, T);
});
