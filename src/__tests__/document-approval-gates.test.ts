import { describe, it, expect, beforeAll, afterAll } from "vitest";
import process from "node:process";
import { randomUUID } from "node:crypto";

/**
 * Document approval gates: bills, vendor payments, payroll runs, salary
 * changes, credit limits, stock adjustments, treasury, and pricing routed
 * through the shared approvals engine.
 * Skipped without DATABASE_URL — the suite is DB-backed.
 */

const T = 240000;
const HAS_DB = !!process.env.DATABASE_URL;
const TENANT = `__gates_${Date.now()}__`;
const FREE_TENANT = `__gates_free_${Date.now()}__`;
let db: any;

async function cleanupTenant(t: string) {
  await db.query(`delete from vendor_payment_applications where payment_id in (select id from vendor_payments where tenant_slug = $1)`, [t]);
  await db.query(`delete from vendor_payments where tenant_slug = $1`, [t]);
  await db.query(`delete from bill_items where bill_id in (select id from bills where tenant_slug = $1)`, [t]);
  await db.query(`delete from bills where tenant_slug = $1`, [t]);
  await db.query(`delete from bank_guarantees where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from invoice_discountings where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from coupon_codes where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from stock_movements where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from inventory_products where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from finance_customers where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from finance_invoices where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from admin_payroll_entries where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from admin_payroll_runs where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from admin_payroll_adjustments where tenant_slug = $1`, [t]).catch(() => {});
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
  // TENANT: bills + payments gated at any amount; always-gated types gate too.
  await db.query(
    `insert into tenants (name, slug, settings, seats) values ($1, $2, $3::jsonb, 1)
     on conflict (slug) do nothing`,
    ["Approval Gates", TENANT, JSON.stringify({ approvals: { billMinAmount: 0, paymentMinAmount: 0 } })]
  );
  await db.query(
    `insert into tenants (name, slug, settings, seats) values ($1, $2, '{}'::jsonb, 1)
     on conflict (slug) do nothing`,
    ["Approval Gates Free", FREE_TENANT]
  );
  const { ensureApprovalTables } = await import("../lib/finance/approvals");
  await ensureApprovalTables();
  const { ensureHrTables } = await import("../lib/hr/db");
  const { sql } = await import("../lib/sql-client");
  await ensureHrTables(sql);
  const { ensureTreasuryTables } = await import("../lib/finance/treasury");
  await ensureTreasuryTables();
}, T);

afterAll(async () => { if (db) await cleanup(); }, T);

async function decide(approvalId: string, decision: "approved" | "rejected", userId = "approver-1", userRole = "admin") {
  const { processApprovalDecision } = await import("../lib/finance/approvals");
  return processApprovalDecision({ approvalId, userId, userRole, decision });
}

/** Multi-step chains need one decision per step — keep approving until the
 *  workflow reaches a terminal status. */
async function decideToTerminal(approvalId: string, userId = "approver-1", userRole = "admin") {
  let approval = await decide(approvalId, "approved", userId, userRole);
  let guard = 0;
  while (approval && approval.status !== "approved" && approval.status !== "rejected" && guard++ < 10) {
    approval = await decide(approvalId, "approved", userId, userRole);
  }
  return approval;
}

describe.skipIf(!HAS_DB)("document approval gates", () => {
  it("requiresApproval: always-gated types gate; bill/payment honor tenant thresholds", async () => {
    const { requiresApproval } = await import("../lib/finance/approvals");
    for (const type of ["payroll_run", "employee_salary_change", "credit_limit_change", "stock_adjustment", "bank_guarantee", "invoice_discounting", "pricing_change"] as const) {
      expect(await requiresApproval(TENANT, type, { amount: 1 }), type).toBe(true);
      expect(await requiresApproval(FREE_TENANT, type, { amount: 1 }), `${type} free`).toBe(true);
    }
    // bill/payment are volume docs: threshold unset → ungated; 0 → always gated.
    expect(await requiresApproval(TENANT, "bill", { amount: 1 })).toBe(true);
    expect(await requiresApproval(TENANT, "payment", { amount: 1 })).toBe(true);
    expect(await requiresApproval(FREE_TENANT, "bill", { amount: 999999 })).toBe(false);
    expect(await requiresApproval(FREE_TENANT, "payment", { amount: 999999 })).toBe(false);
  }, T);

  it("stockAdjustmentMinAmount opts small adjustments out of the chain", async () => {
    const tenantMin = `__gates_min_${Date.now()}__`;
    await db.query(
      `insert into tenants (name, slug, settings, seats) values ($1, $2, $3::jsonb, 1)
       on conflict (slug) do nothing`,
      ["Gates Min", tenantMin, JSON.stringify({ approvals: { stockAdjustmentMinAmount: 1000 } })]
    );
    const { requiresApproval } = await import("../lib/finance/approvals");
    expect(await requiresApproval(tenantMin, "stock_adjustment", { amount: 500 })).toBe(false);
    expect(await requiresApproval(tenantMin, "stock_adjustment", { amount: 5000 })).toBe(true);
    await cleanupTenant(tenantMin);
  }, T);

  it("SoD: the requester cannot decide their own document", async () => {
    const { initiateApproval } = await import("../lib/finance/approvals");
    const approval = await initiateApproval({
      tenantSlug: TENANT,
      entityType: "pricing_change",
      entityId: `pc_sod_${randomUUID().slice(0, 6)}`,
      requestedBy: "requester-x",
      entityData: { amount: 10, reference: "sod test", change: { action: "upsert-coupon", input: { tenantSlug: TENANT, code: "SODX", discountType: "percent", discountValue: 1 } } },
    });
    // requester-x holds the matching role but is the requester — blocked.
    await expect(
      decide(approval.id, "approved", "requester-x", "dept_manager")
    ).rejects.toThrow(/own document/i);
    // An admin can still decide (break-glass).
    const updated = await decide(approval.id, "approved");
    expect(updated?.status).toBe("approved");
  }, T);

  it("bill: pending_approval defers GL; approval opens the bill and posts the journal", async () => {
    const { createBill } = await import("../lib/finance/bills");
    const bill = await createBill({
      tenantSlug: TENANT,
      vendorId: randomUUID(),
      billDate: "2026-10-20",
      items: [{ description: "Office chairs", quantity: 2, unitPrice: 50000 }],
    });
    expect(bill.status).toBe("pending_approval");

    const [row] = (await db.query(`select approval_id from bills where id = $1`, [bill.id])).rows as any[];
    expect(row?.approval_id).toBeTruthy();
    // No journal posted while pending.
    const jeBefore = (await db.query(
      `select count(*)::int c from journal_entries where tenant_slug = $1 and reference_id = $2`,
      [TENANT, bill.id]
    )).rows as any[];
    expect(Number(jeBefore[0].c)).toBe(0);

    await decideToTerminal(row.approval_id);

    const [after] = (await db.query(`select status from bills where id = $1`, [bill.id])).rows as any[];
    expect(after.status).toBe("open");
    const jeAfter = (await db.query(
      `select count(*)::int c from journal_entries where tenant_slug = $1 and reference_id = $2`,
      [TENANT, bill.id]
    )).rows as any[];
    expect(Number(jeAfter[0].c)).toBeGreaterThan(0);
  }, T);

  it("vendor payment: pending_approval defers JE + bill balances; approval posts both", async () => {
    const { createBill } = await import("../lib/finance/bills");
    const { createVendorPayment, getVendorPayment } = await import("../lib/finance/vendor-payments");

    // An approved bill to pay against — create ungated bill by hand.
    const bill = await createBill({
      tenantSlug: FREE_TENANT,
      vendorId: randomUUID(),
      billDate: "2026-10-20",
      items: [{ description: "Consulting", quantity: 1, unitPrice: 200000 }],
    });
    expect(bill.status).toBe("open");

    const vendorId = randomUUID();
    // FREE_TENANT has no paymentMinAmount → payment ungated → not the target.
    // Use TENANT (paymentMinAmount=0) but the bill must share the tenant —
    // create a TENANT bill and flip it open directly.
    const gatedBill = await createBill({
      tenantSlug: TENANT,
      vendorId,
      billDate: "2026-10-20",
      items: [{ description: "Equipment", quantity: 1, unitPrice: 200000 }],
    });
    await db.query(`update bills set status = 'open' where id = $1`, [gatedBill.id]);

    const payment = await createVendorPayment({
      tenantSlug: TENANT,
      vendorId,
      method: "bank_transfer",
      amount: 200000,
      paymentDate: "2026-10-21",
      applications: [{ billId: gatedBill.id, appliedAmount: 200000 }],
    });
    expect(payment.status).toBe("pending_approval");

    // Bill balance untouched while payment awaits approval.
    const [billBefore] = (await db.query(`select balance_due from bills where id = $1`, [gatedBill.id])).rows as any[];
    expect(Number(billBefore.balance_due)).toBe(200000);

    const [row] = (await db.query(`select approval_id from vendor_payments where id = $1`, [payment.id])).rows as any[];
    expect(row?.approval_id).toBeTruthy();
    await decideToTerminal(row.approval_id);

    const after = await getVendorPayment(payment.id, TENANT);
    expect(after?.status).toBe("posted");
    const [billAfter] = (await db.query(`select balance_due, status from bills where id = $1`, [gatedBill.id])).rows as any[];
    expect(Number(billAfter.balance_due)).toBe(0);
    expect(billAfter.status).toBe("paid");
    const je = (await db.query(
      `select count(*)::int c from journal_entries where tenant_slug = $1 and reference_id = $2`,
      [TENANT, payment.id]
    )).rows as any[];
    expect(Number(je[0].c)).toBeGreaterThan(0);
    expect(bill).toBeTruthy(); // silence unused — free bill covered elsewhere
  }, T);

  it("payroll run: chain approval posts the accrual JE; creator cannot self-approve", async () => {
    const runId = `run_${randomUUID().slice(0, 8)}`;
    await db.query(
      `insert into admin_payroll_runs (id, tenant_slug, period, status, total_gross, total_deductions, total_net, processed_by)
       values ($1, $2, '2026-10', 'draft', 100000, 10000, 90000, 'hr-creator')`,
      [runId, TENANT]
    );
    const { initiateApproval, getApprovalForEntity } = await import("../lib/finance/approvals");
    const approval = await initiateApproval({
      tenantSlug: TENANT,
      entityType: "payroll_run",
      entityId: runId,
      requestedBy: "hr-creator",
      entityData: { amount: 90000, period: "2026-10", reference: "Payroll 2026-10" },
    });
    await db.query(`update admin_payroll_runs set approval_id = $1 where id = $2`, [approval.id, runId]);

    // Creator matches the step-0 role placeholder — authorized, but SoD blocks them.
    await expect(decide(approval.id, "approved", "hr-creator", "dept_manager")).rejects.toThrow(/own document/i);

    await decideToTerminal(approval.id);
    const [run] = (await db.query(
      `select status, journal_entry_id, approved_by from admin_payroll_runs where id = $1`,
      [runId]
    )).rows as any[];
    expect(run.status).toBe("processing");
    expect(run.journal_entry_id).toBeTruthy();
    const je = (await db.query(
      `select count(*)::int c from journal_entries where tenant_slug = $1 and reference_id = $2`,
      [TENANT, runId]
    )).rows as any[];
    expect(Number(je[0].c)).toBeGreaterThan(0);

    // Rejection voids a second run and frees the period's unique index.
    const runId2 = `run_${randomUUID().slice(0, 8)}`;
    await db.query(
      `insert into admin_payroll_runs (id, tenant_slug, period, status, total_gross, total_deductions, total_net, processed_by)
       values ($1, $2, '2026-11', 'draft', 50000, 5000, 45000, 'hr-creator')`,
      [runId2, TENANT]
    );
    const approval2 = await initiateApproval({
      tenantSlug: TENANT,
      entityType: "payroll_run",
      entityId: runId2,
      requestedBy: "hr-creator",
      entityData: { amount: 45000, period: "2026-11", reference: "Payroll 2026-11" },
    });
    await decide(approval2.id, "rejected");
    const [run2] = (await db.query(`select status from admin_payroll_runs where id = $1`, [runId2])).rows as any[];
    expect(run2.status).toBe("cancelled");
    expect(await getApprovalForEntity(TENANT, "payroll_run", runId2)).toBeTruthy();
  }, T);

  it("salary change: approval applies pending_salary, rejection clears it", async () => {
    const empId = `emp_${randomUUID().slice(0, 8)}`;
    await db.query(
      `insert into admin_employees (id, tenant_slug, name, email, salary, status)
       values ($1, $2, 'Test Employee', $3, 100000, 'active')`,
      [empId, TENANT, `${empId}@test.local`]
    );
    await db.query(`update admin_employees set pending_salary = 150000 where id = $1`, [empId]);

    const { initiateApproval } = await import("../lib/finance/approvals");
    const approval = await initiateApproval({
      tenantSlug: TENANT,
      entityType: "employee_salary_change",
      entityId: empId,
      requestedBy: "hr-admin-1",
      entityData: { amount: 150000, previousAmount: 100000, reference: `Salary change — ${empId}` },
    });
    await decideToTerminal(approval.id);
    const [emp] = (await db.query(
      `select salary::float s, pending_salary from admin_employees where id = $1`,
      [empId]
    )).rows as any[];
    expect(Number(emp.s)).toBe(150000);
    expect(emp.pending_salary).toBeNull();

    // Second change rejected → cleared without touching salary.
    await db.query(`update admin_employees set pending_salary = 200000 where id = $1`, [empId]);
    const approval2 = await initiateApproval({
      tenantSlug: TENANT,
      entityType: "employee_salary_change",
      entityId: empId,
      requestedBy: "hr-admin-1",
      entityData: { amount: 200000, previousAmount: 150000, reference: `Salary change — ${empId}` },
    });
    await decide(approval2.id, "rejected");
    const [emp2] = (await db.query(
      `select salary::float s, pending_salary from admin_employees where id = $1`,
      [empId]
    )).rows as any[];
    expect(Number(emp2.s)).toBe(150000);
    expect(emp2.pending_salary).toBeNull();
  }, T);

  it("credit limit change: approval applies pending_credit_limit", async () => {
    const custId = randomUUID();
    await db.query(
      `insert into finance_customers (id, tenant_slug, customer_code, name, credit_limit, pending_credit_limit)
       values ($1, $2, 'CUST-1', 'Test Customer', 100000, 500000)`,
      [custId, TENANT]
    );
    const { initiateApproval } = await import("../lib/finance/approvals");
    const approval = await initiateApproval({
      tenantSlug: TENANT,
      entityType: "credit_limit_change",
      entityId: custId,
      requestedBy: "finance-staff",
      entityData: { amount: 500000, previousAmount: 100000, reference: "Credit limit — CUST-1" },
    });
    await decideToTerminal(approval.id);
    const [cust] = (await db.query(
      `select credit_limit::float cl, pending_credit_limit from finance_customers where id = $1`,
      [custId]
    )).rows as any[];
    expect(Number(cust.cl)).toBe(500000);
    expect(cust.pending_credit_limit).toBeNull();
  }, T);

  it("stock adjustment: approval replays the stashed movement", async () => {
    await db.query(
      `insert into inventory_products (id, sku, tenant_slug, name, category, current_stock)
       values ($2, 'SKU-ADJ-1', $1, 'Adjustable Product', 'General', 10)
       on conflict do nothing`,
      [TENANT, `prod_${randomUUID().slice(0, 8)}`]
    );
    const { initiateApproval } = await import("../lib/finance/approvals");
    const approval = await initiateApproval({
      tenantSlug: TENANT,
      entityType: "stock_adjustment",
      entityId: `sadj_test_${randomUUID().slice(0, 6)}`,
      requestedBy: "store-keeper",
      entityData: {
        amount: 5 * 1000,
        productSku: "SKU-ADJ-1",
        reference: "Stock adjustment — SKU-ADJ-1 ×5",
        movement: {
          productSku: "SKU-ADJ-1",
          productName: "Adjustable Product",
          movementType: "adjustment",
          quantity: 5,
          unitCost: 1000,
          referenceType: "manual",
          referenceId: "count-2026-10",
        },
      },
    });
    await decideToTerminal(approval.id);

    const [mv] = (await db.query(
      `select * from stock_movements where tenant_slug = $1 and product_sku = 'SKU-ADJ-1'`,
      [TENANT]
    )).rows as any[];
    expect(mv).toBeTruthy();
    expect(mv.movement_type).toBe("adjustment");
    const [prod] = (await db.query(
      `select current_stock::float s from inventory_products where tenant_slug = $1 and sku = 'SKU-ADJ-1'`,
      [TENANT]
    )).rows as any[];
    expect(Number(prod.s)).toBe(15);
  }, T);

  it("bank guarantee: approval opens the facility and posts the margin JE", async () => {
    const { issueBankGuarantee } = await import("../lib/finance/treasury");
    const row = await issueBankGuarantee({
      tenantSlug: TENANT,
      direction: "issued",
      beneficiary: "Project Owner Ltd",
      bank: "Test Bank",
      amount: 5000000,
      startDate: "2026-10-01",
      endDate: "2027-10-01",
      marginAmount: 500000,
      pendingApproval: true,
    });
    expect(row.status).toBe("pending_approval");
    expect(row.journal_entry_id).toBeNull();

    const { initiateApproval } = await import("../lib/finance/approvals");
    const approval = await initiateApproval({
      tenantSlug: TENANT,
      entityType: "bank_guarantee",
      entityId: String(row.id),
      requestedBy: "finance-staff",
      entityData: { amount: 5000000, reference: "BG — Test Bank" },
    });
    await decideToTerminal(approval.id);

    const [bg] = (await db.query(
      `select status, journal_entry_id from bank_guarantees where id = $1`,
      [row.id]
    )).rows as any[];
    expect(bg.status).toBe("open");
    expect(bg.journal_entry_id).toBeTruthy();
  }, T);

  it("invoice discounting: approval sanctions the facility and posts the disbursement JE", async () => {
    const invId = `inv_${randomUUID().slice(0, 8)}`;
    await db.query(
      `insert into finance_invoices (id, tenant_slug, customer_name, invoice_number, issued_date, due_date, amount, balance_due, status)
       values ($1, $2, 'Cust', 'INV-DISC-1', '2026-10-01', '2026-11-01', 1000000, 1000000, 'sent')`,
      [invId, TENANT]
    );
    const { sanctionInvoiceDiscounting } = await import("../lib/finance/treasury");
    const row = await sanctionInvoiceDiscounting({
      tenantSlug: TENANT,
      invoiceId: invId,
      bank: "Test Bank",
      loanAmount: 800000,
      disbursementDate: "2026-10-15",
      pendingApproval: true,
    });
    expect(row.status).toBe("pending_approval");

    const { initiateApproval } = await import("../lib/finance/approvals");
    const approval = await initiateApproval({
      tenantSlug: TENANT,
      entityType: "invoice_discounting",
      entityId: String(row.id),
      requestedBy: "finance-staff",
      entityData: { amount: 800000, reference: "Discounting — Test Bank" },
    });
    await decideToTerminal(approval.id);

    const [d] = (await db.query(
      `select status, journal_entry_id from invoice_discountings where id = $1`,
      [row.id]
    )).rows as any[];
    expect(d.status).toBe("sanctioned");
    expect(d.journal_entry_id).toBeTruthy();
  }, T);

  it("pricing change: approval replays the staged upsert", async () => {
    const { initiateApproval } = await import("../lib/finance/approvals");
    const approval = await initiateApproval({
      tenantSlug: TENANT,
      entityType: "pricing_change",
      entityId: `pc_${randomUUID().slice(0, 6)}`,
      requestedBy: "finance-staff",
      entityData: {
        amount: 15,
        reference: "Pricing change — GATE15",
        change: {
          action: "upsert-coupon",
          input: { tenantSlug: TENANT, code: "GATE15", discountType: "percent", discountValue: 15 },
        },
      },
    });

    // Nothing written while pending.
    const before = (await db.query(
      `select count(*)::int c from coupon_codes where tenant_slug = $1 and code = 'GATE15'`,
      [TENANT]
    )).rows as any[];
    expect(Number(before[0].c)).toBe(0);

    await decideToTerminal(approval.id);

    const [coupon] = (await db.query(
      `select * from coupon_codes where tenant_slug = $1 and code = 'GATE15'`,
      [TENANT]
    )).rows as any[];
    expect(coupon).toBeTruthy();
    expect(Number(coupon.discount_value)).toBe(15);
  }, T);
});
