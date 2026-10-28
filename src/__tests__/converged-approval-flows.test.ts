import { describe, it, expect, beforeAll, afterAll } from "vitest";
import process from "node:process";
import { randomUUID } from "node:crypto";

/**
 * Converged flows: flows that previously had bespoke (or no) approval
 * mechanisms now route through the shared engine via the gated-action
 * registry. Covers requisitions, leave, invoice delete, period close,
 * employee termination/delete, asset disposal, stock transfers, budgets.
 * Skipped without DATABASE_URL — the suite is DB-backed.
 */

const T = 240000;
const HAS_DB = !!process.env.DATABASE_URL;
const TENANT = `__conv_${Date.now()}__`;
const CFG_TENANT = `__conv_cfg_${Date.now()}__`;
let db: any;

async function cleanupTenant(t: string) {
  await db.query(`delete from procurement_requisitions where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from admin_leave where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from admin_leave_balances where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from finance_invoices where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from inventory_stock_transfers where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from inventory_products where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from asset_depreciation_schedule where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from fixed_assets where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from budget_approvals where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from budget_versions where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from budget_lines where budget_id in (select id from budgets where tenant_slug = $1)`, [t]).catch(() => {});
  await db.query(`delete from budgets where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from fiscal_periods where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from purchase_receipt_items where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from purchase_receipts where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from purchase_order_items where purchase_order_id in (select id from purchase_orders where tenant_slug = $1)`, [t]).catch(() => {});
  await db.query(`delete from purchase_orders where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from bill_items where bill_id in (select id from bills where tenant_slug = $1)`, [t]).catch(() => {});
  await db.query(`delete from bills where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from delivery_note_items where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from delivery_notes where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from sales_orders where tenant_slug = $1`, [t]).catch(() => {});
  await db.query(`delete from admin_employees where tenant_slug = $1`, [t]).catch(() => {});
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
  await cleanupTenant(CFG_TENANT);
  const { ensureApprovalTables } = await import("../lib/finance/approvals");
  await ensureApprovalTables();
  const { ensureHrTables } = await import("../lib/hr/db");
  const { sql } = await import("../lib/sql-client");
  await ensureHrTables(sql);

  // TENANT: no matrix and no thresholds — always-gated actions gate,
  // opt-in actions (requisition, stock transfer) stay ungated.
  await db.query(
    `insert into tenants (name, slug, settings, seats) values ($1, $2, $3::jsonb, 1)
     on conflict (slug) do nothing`,
    ["Converged Flows", TENANT, JSON.stringify({ approvals: {} })]
  );

  // CFG_TENANT: opt-in thresholds configured for requisitions + transfers.
  await db.query(
    `insert into tenants (name, slug, settings, seats) values ($1, $2, $3::jsonb, 1)
     on conflict (slug) do nothing`,
    ["Converged Config", CFG_TENANT, JSON.stringify({
      approvals: { requisitionMinAmount: 10000, stockTransferMinAmount: 5000 },
    })]
  );
}, T);

afterAll(async () => {
  if (!db) return;
  await cleanupTenant(TENANT);
  await cleanupTenant(CFG_TENANT);
}, T);

async function decideToTerminal(approvalId: string, decision: "approved" | "rejected" = "approved") {
  const { processApprovalDecision } = await import("../lib/finance/approvals");
  let approval = await processApprovalDecision({
    approvalId, userId: "approver-1", userRole: "admin", decision,
  });
  let guard = 0;
  while (approval && approval.status !== "approved" && approval.status !== "rejected" && guard++ < 10) {
    approval = await processApprovalDecision({
      approvalId, userId: "approver-1", userRole: "admin", decision: "approved",
    });
  }
  return approval;
}

async function insertRequisition(tenantSlug: string, totalAmount: number) {
  const id = `req_${randomUUID().slice(0, 8)}`;
  await db.query(
    `insert into procurement_requisitions
       (id, tenant_slug, requisition_number, items, total_amount, status, source, requested_by)
     values ($1, $2, $3, $4::jsonb, $5, 'pending', 'manual', 'requester-1')`,
    [id, tenantSlug, `PR-T-${id.slice(4)}`, JSON.stringify([{ componentSku: "X", quantity: 1, unitCost: totalAmount }]), totalAmount]
  );
  return id;
}

describe.skipIf(!HAS_DB)("converged approval flows", () => {
  it("purchase_requisition: ungated stays pending for manual decision; gated decides via the engine", async () => {
    const { gateOrRun } = await import("../lib/finance/gated-actions");

    // Ungated tenant: no rule/matrix/minAmount → legacy manual flow.
    const freeId = await insertRequisition(TENANT, 100);
    const free = await gateOrRun(TENANT, "purchase_requisition", {
      requisitionId: freeId, totalAmount: 100,
    }, { requestedBy: "requester-1" });
    expect(free.status).toBe("ran");
    let row = (await db.query(
      `select status, approval_id from procurement_requisitions where id = $1`, [freeId]
    )).rows[0];
    expect(row.status).toBe("pending"); // runUngated: false — stays pending
    expect(row.approval_id).toBeNull();

    // Gated tenant: requisitionMinAmount 10000 → 50000 gates.
    const gatedId = await insertRequisition(CFG_TENANT, 50000);
    const gated = await gateOrRun(CFG_TENANT, "purchase_requisition", {
      requisitionId: gatedId, requisitionNumber: "PR-T-gated", totalAmount: 50000,
    }, { requestedBy: "requester-1" });
    expect(gated.status).toBe("pending");
    await db.query(
      `update procurement_requisitions set approval_id = $1 where id = $2`,
      [(gated as any).approvalId, gatedId]
    );

    await decideToTerminal((gated as any).approvalId);
    row = (await db.query(
      `select status from procurement_requisitions where id = $1`, [gatedId]
    )).rows[0];
    expect(row.status).toBe("approved");

    // Rejection path flips to rejected.
    const rejId = await insertRequisition(CFG_TENANT, 60000);
    const rej = await gateOrRun(CFG_TENANT, "purchase_requisition", {
      requisitionId: rejId, totalAmount: 60000,
    }, { requestedBy: "requester-1" });
    expect(rej.status).toBe("pending");
    await decideToTerminal((rej as any).approvalId, "rejected");
    row = (await db.query(
      `select status from procurement_requisitions where id = $1`, [rejId]
    )).rows[0];
    expect(row.status).toBe("rejected");
  }, T);

  it("leave_request: approval flips status + balance; rejection releases the pending days", async () => {
    const { gateOrRun } = await import("../lib/finance/gated-actions");
    const { insertLeave } = await import("../lib/hr/db");

    const empId = `emp_${randomUUID().slice(0, 8)}`;
    await db.query(
      `insert into admin_employees (id, tenant_slug, name, email, status, role)
       values ($1, $2, 'Leave Tester', $3, 'active', 'staff')`,
      [empId, TENANT, `${empId}@test.local`]
    );

    const req = await insertLeave({
      tenantSlug: TENANT, employeeId: empId, employeeName: "Leave Tester",
      leaveType: "annual", startDate: "2026-11-02", endDate: "2026-11-04",
      reason: "Family",
    });

    const outcome = await gateOrRun(TENANT, "leave_request", {
      leaveId: req.id, employeeId: empId, employeeName: "Leave Tester",
      leaveType: "annual", startDate: "2026-11-02", endDate: "2026-11-04", days: 3,
    }, { requestedBy: empId });
    expect(outcome.status).toBe("pending"); // always-gated

    let row = (await db.query(`select status from admin_leave where id = $1`, [req.id])).rows[0];
    expect(row.status).toBe("pending");

    await decideToTerminal((outcome as any).approvalId);
    row = (await db.query(`select status, approved_by from admin_leave where id = $1`, [req.id])).rows[0];
    expect(row.status).toBe("approved");
    expect(row.approved_by).toBeTruthy();

    // Rejection path on a second request.
    const req2 = await insertLeave({
      tenantSlug: TENANT, employeeId: empId, employeeName: "Leave Tester",
      leaveType: "annual", startDate: "2026-12-07", endDate: "2026-12-08",
      reason: "Second",
    });
    const outcome2 = await gateOrRun(TENANT, "leave_request", {
      leaveId: req2.id, employeeId: empId, employeeName: "Leave Tester",
      leaveType: "annual", startDate: "2026-12-07", endDate: "2026-12-08", days: 2,
    }, { requestedBy: empId });
    await decideToTerminal((outcome2 as any).approvalId, "rejected");
    row = (await db.query(`select status from admin_leave where id = $1`, [req2.id])).rows[0];
    expect(row.status).toBe("rejected");
  }, T);

  it("invoice_delete: draft survives until approval, then the row is gone", async () => {
    const { ensureFinanceTables } = await import("../lib/finance/db");
    const { sql } = await import("../lib/sql-client");
    await ensureFinanceTables(sql);

    const invId = `inv_${randomUUID().slice(0, 8)}`;
    await db.query(
      `insert into finance_invoices
         (id, tenant_slug, customer_name, invoice_number, issued_date, due_date, amount, balance_due, status)
       values ($1, $2, 'Del Customer', $3, '2026-10-01', '2026-10-31', 45000, 45000, 'draft')`,
      [invId, TENANT, `INV-DEL-${invId.slice(4)}`]
    );

    const { gateOrRun } = await import("../lib/finance/gated-actions");
    const outcome = await gateOrRun(TENANT, "invoice_delete", {
      invoiceId: invId, invoiceNumber: `INV-DEL-${invId.slice(4)}`, total: 45000,
    }, { requestedBy: "finance-staff" });
    expect(outcome.status).toBe("pending");

    let rows = (await db.query(`select id from finance_invoices where id = $1`, [invId])).rows;
    expect(rows.length).toBe(1); // still there while pending

    await decideToTerminal((outcome as any).approvalId);
    rows = (await db.query(`select id from finance_invoices where id = $1`, [invId])).rows;
    expect(rows.length).toBe(0);
  }, T);

  it("employee_termination + employee_delete: gated until the chain decides", async () => {
    const { gateOrRun } = await import("../lib/finance/gated-actions");

    const empId = `emp_${randomUUID().slice(0, 8)}`;
    await db.query(
      `insert into admin_employees (id, tenant_slug, name, email, status, role)
       values ($1, $2, 'Term Tester', $3, 'active', 'staff')`,
      [empId, TENANT, `${empId}@test.local`]
    );

    const term = await gateOrRun(TENANT, "employee_termination", {
      employeeId: empId, employeeName: "Term Tester",
    }, { requestedBy: "hr-staff" });
    expect(term.status).toBe("pending");

    let row = (await db.query(`select status from admin_employees where id = $1`, [empId])).rows[0];
    expect(row.status).toBe("active"); // not yet terminated

    await decideToTerminal((term as any).approvalId);
    row = (await db.query(`select status from admin_employees where id = $1`, [empId])).rows[0];
    expect(row.status).toBe("terminated");

    // Deletion gates too — approval erases the row.
    const empId2 = `emp_${randomUUID().slice(0, 8)}`;
    await db.query(
      `insert into admin_employees (id, tenant_slug, name, email, status, role)
       values ($1, $2, 'Del Tester', $3, 'terminated', 'staff')`,
      [empId2, TENANT, `${empId2}@test.local`]
    );
    const del = await gateOrRun(TENANT, "employee_delete", {
      employeeId: empId2, employeeName: "Del Tester",
    }, { requestedBy: "hr-staff" });
    expect(del.status).toBe("pending");
    await decideToTerminal((del as any).approvalId);
    const rows = (await db.query(`select id from admin_employees where id = $1`, [empId2])).rows;
    expect(rows.length).toBe(0);
  }, T);

  it("stock_transfer_completion: under threshold completes; over gates until approval", async () => {
    const { gateOrRun } = await import("../lib/finance/gated-actions");

    const prodId = `prod_${randomUUID().slice(0, 8)}`;
    await db.query(
      `insert into inventory_products (id, tenant_slug, sku, name, category, unit_cost, current_stock, location)
       values ($1, $2, 'SKU-C', 'Conv Product', 'general', 1000, 50, 'Main')`,
      [prodId, CFG_TENANT]
    );
    const mkTransfer = async () => {
      const id = `tr_${randomUUID().slice(0, 8)}`;
      await db.query(
        `insert into inventory_stock_transfers
           (id, tenant_slug, product_id, quantity, from_location, to_location, status)
         values ($1, $2, $3, 2, 'Main', 'Branch', 'pending')`,
        [id, CFG_TENANT, prodId]
      );
      return id;
    };

    // 2 × 1000 = 2000 < 5000 threshold → completes immediately.
    const small = await mkTransfer();
    const free = await gateOrRun(CFG_TENANT, "stock_transfer_completion", {
      transferId: small, productSku: "SKU-C", quantity: 2, value: 2000,
      from: "Main", to: "Branch",
    }, { requestedBy: "inv-staff" });
    expect(free.status).toBe("ran");
    let row = (await db.query(
      `select status from inventory_stock_transfers where id = $1`, [small]
    )).rows[0];
    expect(row.status).toBe("completed");

    // 2 × 4000 = 8000 ≥ 5000 → gates; goods don't move until approval.
    await db.query(`update inventory_products set unit_cost = 4000 where id = $1`, [prodId]);
    const big = await mkTransfer();
    const gated = await gateOrRun(CFG_TENANT, "stock_transfer_completion", {
      transferId: big, productSku: "SKU-C", quantity: 2, value: 8000,
      from: "Main", to: "Branch",
    }, { requestedBy: "inv-staff" });
    expect(gated.status).toBe("pending");
    row = (await db.query(
      `select status from inventory_stock_transfers where id = $1`, [big]
    )).rows[0];
    expect(row.status).toBe("pending");

    await decideToTerminal((gated as any).approvalId);
    row = (await db.query(
      `select status from inventory_stock_transfers where id = $1`, [big]
    )).rows[0];
    expect(row.status).toBe("completed");
    const prod = (await db.query(
      `select location from inventory_products where id = $1`, [prodId]
    )).rows[0];
    expect(prod.location).toBe("Branch");
  }, T);

  it("budget_approval: submission gates; approval flips DRAFT → APPROVED + audit row", async () => {
    const { createBudget } = await import("../lib/finance/budgets-db");
    const budget = await createBudget({
      tenantSlug: TENANT, code: `B-${Date.now()}`, name: "Conv Budget",
      budgetType: "DEPARTMENT", periodType: "ANNUAL", fiscalYear: 2026,
      totalBudgetAmount: 1000000, enforcementMode: "SOFT_WARNING",
      budgetLines: [],
    } as any);
    expect(budget).toBeTruthy();

    const { gateOrRun } = await import("../lib/finance/gated-actions");
    const outcome = await gateOrRun(TENANT, "budget_approval", {
      budgetId: String((budget as any).id), budgetName: "Conv Budget",
      totalBudgetAmount: 1000000,
    }, { requestedBy: "finance-staff" });
    expect(outcome.status).toBe("pending");

    let row = (await db.query(
      `select status from budgets where id = $1`, [String((budget as any).id)]
    )).rows[0];
    expect(row.status).toBe("DRAFT");

    await decideToTerminal((outcome as any).approvalId);
    row = (await db.query(
      `select status from budgets where id = $1`, [String((budget as any).id)]
    )).rows[0];
    expect(row.status).toBe("APPROVED");
    const audit = (await db.query(
      `select status, approver_id from budget_approvals where budget_id = $1`,
      [String((budget as any).id)]
    )).rows;
    expect(audit.length).toBe(1);
    expect(audit[0].status).toBe("APPROVED");
  }, T);

  it("asset_disposal: asset stays active until approval, then disposed + JE posted", async () => {
    const { createAsset } = await import("../lib/finance/fixed-assets");
    const asset = await createAsset({
      tenantSlug: TENANT, name: "Conv Asset", category: "equipment",
      acquisitionDate: "2026-01-01", cost: 120000,
      usefulLifeMonths: 48,
    });

    const { gateOrRun } = await import("../lib/finance/gated-actions");
    const outcome = await gateOrRun(TENANT, "asset_disposal", {
      assetId: asset.id, assetName: "Conv Asset", method: "write_off",
      disposalDate: "2026-10-26", netBookValue: 120000,
    }, { requestedBy: "finance-staff" });
    expect(outcome.status).toBe("pending");

    let row = (await db.query(`select status from fixed_assets where id = $1`, [asset.id])).rows[0];
    expect(row.status).toBe("active");

    await decideToTerminal((outcome as any).approvalId);
    row = (await db.query(`select status from fixed_assets where id = $1`, [asset.id])).rows[0];
    expect(row.status).toBe("disposed");
  }, T);

  it("employee_bank_change: stages pending details; approval applies + stamps fraud window", async () => {
    const empId = `emp_${randomUUID().slice(0, 8)}`;
    await db.query(
      `insert into admin_employees (id, tenant_slug, name, email, status, role, bank_name, bank_account_number)
       values ($1, $2, 'Bank Tester', $3, 'active', 'staff', 'Old Bank', '111')`,
      [empId, TENANT, `${empId}@test.local`]
    );

    const { gateOrRun } = await import("../lib/finance/gated-actions");
    const outcome = await gateOrRun(TENANT, "employee_bank_change", {
      employeeId: empId, employeeName: "Bank Tester",
      bankChanges: { bankAccountNumber: "999" },
    }, { requestedBy: "hr-staff" });
    expect(outcome.status).toBe("pending");

    const [staged] = (await db.query(
      `select bank_account_number, pending_bank_details, bank_details_changed_at
       from admin_employees where id = $1`, [empId]
    )).rows as any[];
    expect(staged.bank_account_number).toBe("111");
    expect((staged.pending_bank_details as any).bankAccountNumber).toBe("999");
    expect(staged.bank_details_changed_at).toBeNull();

    await decideToTerminal((outcome as any).approvalId);
    const [applied] = (await db.query(
      `select bank_name, bank_account_number, pending_bank_details,
              bank_details_changed_at is not null as stamped
       from admin_employees where id = $1`, [empId]
    )).rows as any[];
    expect(applied.bank_account_number).toBe("999");
    expect(applied.bank_name).toBe("Old Bank"); // untouched field survives
    expect(applied.pending_bank_details).toBeNull();
    expect(applied.stamped).toBe(true);
  }, T);

  it("coa_change: ungated without master_data band; band routes to chain", async () => {
    const { gateOrRun } = await import("../lib/finance/gated-actions");
    // TENANT has no master_data band → opt-in action runs free.
    const free = await gateOrRun(TENANT, "coa_change", {
      op: "create",
      fields: {
        accountCode: `9${String(Date.now()).slice(-4)}`,
        accountName: "Test Account", accountType: "EXPENSE",
      },
      code: "9999", name: "Test Account",
    }, { requestedBy: "finance-staff" });
    expect(free.status).toBe("ran");

    // CFG_TENANT gets a master_data band via save-settings → gates.
    const { setApprovalSettings } = await import("../lib/finance/approvals");
    await setApprovalSettings(CFG_TENANT, {
      authorityMatrix: { master_data: [{ upTo: null, approvers: ["finance_manager"] }] },
    });
    const gated = await gateOrRun(CFG_TENANT, "coa_change", {
      op: "create",
      fields: {
        accountCode: `8${String(Date.now()).slice(-4)}`,
        accountName: "Gated Account", accountType: "EXPENSE",
      },
      code: "8888", name: "Gated Account",
    }, { requestedBy: "finance-staff" });
    expect(gated.status).toBe("pending");
  }, T);

  it("period_close: period stays open until approval, then closes", async () => {
    const { ensureGLTables } = await import("../lib/finance/gl");
    await ensureGLTables();

    const periodId = randomUUID();
    // `name`/`period_type` are NOT NULL in one schema variant; `period_name`
    // doesn't exist in the other — insert only the columns both share.
    await db.query(
      `insert into fiscal_periods
         (id, tenant_slug, fiscal_year, period_number, name, period_type, start_date, end_date, status)
       values ($1, $2, 2026, 10, 'Oct 2026', 'month', '2026-10-01', '2026-10-31', 'open')`,
      [periodId, TENANT]
    );

    const { gateOrRun } = await import("../lib/finance/gated-actions");
    const outcome = await gateOrRun(TENANT, "period_close", {
      periodId, periodName: "Oct 2026",
    }, { requestedBy: "finance-staff" });
    expect(outcome.status).toBe("pending");

    let row = (await db.query(`select status from fiscal_periods where id = $1`, [periodId])).rows[0];
    expect(row.status).toBe("open");

    await decideToTerminal((outcome as any).approvalId);
    row = (await db.query(`select status from fiscal_periods where id = $1`, [periodId])).rows[0];
    expect((row.status as string).toLowerCase()).toBe("closed");
  }, T);

  it("purchase receipt: over-receipt rejected, received applies PO qty, 3-way match caps billing", async () => {
    const { ensurePurchaseOrderTables } = await import("../lib/finance/purchase-orders");
    const { sql } = await import("../lib/sql-client");
    await ensurePurchaseOrderTables(sql);
    const poId = randomUUID();
    const poItemId = randomUUID();
    try {
      await db.query(
        `insert into purchase_orders (id, tenant_slug, order_number, po_number, supplier_id, supplier_name, status, issued_date, total_amount, created_at)
         values ($1, $2, $3, $4, '00000000-0000-0000-0000-0000000000aa', 'Test Supplier', 'approved', '2026-10-01', 100000, now())`,
        [poId, TENANT, `PO-${poId.slice(0,8)}`, `PO-${poId.slice(0,8)}`]
      );
    } catch {
      await db.query(
        `insert into purchase_orders (id, tenant_slug, po_number, supplier_id, supplier_name, status, issued_date, total_amount, created_at)
         values ($1, $2, $3, '00000000-0000-0000-0000-0000000000aa', 'Test Supplier', 'approved', '2026-10-01', 100000, now())`,
        [poId, TENANT, `PO-${poId.slice(0,8)}`]
      );
    }
    await db.query(
      `insert into purchase_order_items (id, purchase_order_id, sku, description, quantity, unit_price, amount, received_quantity)
       values ($1, $2, 'SKU-1', 'Flour 50kg', 10, 10000, 100000, 0)`,
      [poItemId, poId]
    );

    const { createPurchaseReceipt, receivePurchaseReceipt } = await import("../lib/finance/purchase-receipts");

    await expect(createPurchaseReceipt({
      tenantSlug: TENANT, purchaseOrderId: poId, receivedDate: "2026-10-20",
      items: [{ poItemId, sku: "SKU-1", receivedQty: 11, unitPrice: 10000 }],
    })).rejects.toThrow(/Over-receipt/);

    const r = await createPurchaseReceipt({
      tenantSlug: TENANT, purchaseOrderId: poId, receivedDate: "2026-10-20",
      items: [{ poItemId, sku: "SKU-1", description: "Flour 50kg", receivedQty: 6, unitPrice: 10000 }],
    });
    expect(r.status).toBe("pending");
    const applied = await receivePurchaseReceipt(TENANT, r.id, "tester");
    expect(applied.status).toBe("received");
    const item = (await db.query(`select received_quantity from purchase_order_items where id = $1`, [poItemId])).rows[0];
    expect(Number(item.received_quantity)).toBe(6);
    const po = (await db.query(`select status from purchase_orders where id = $1`, [poId])).rows[0];
    expect(po.status).toBe("partially_received");

    const { convertPOToBill } = await import("../lib/finance/bills");
    const bill = await convertPOToBill(poId, { billDate: "2026-10-21" }, TENANT);
    expect(bill).toBeTruthy();
    const billItems = (await db.query(`select quantity from bill_items where bill_id = $1`, [(bill as any).id])).rows;
    expect(billItems.length).toBe(1);
    expect(Number(billItems[0].quantity)).toBe(6);

    await expect(convertPOToBill(poId, { billDate: "2026-10-22" }, TENANT)).rejects.toThrow(/Nothing to bill/);
  }, T);

  it("delivery note: over-delivery rejected, apply posts stock-out + flips SO status", async () => {
    const soId = `so_${randomUUID().slice(0, 8)}`;
    const items = [{ sku: "CAKE-VAN", description: "Vanilla Cake", qty: 10, quantity: 10, unitPrice: 5000 }];
    try {
      await db.query(
        `insert into sales_orders (id, tenant_slug, order_number, customer_id, customer_name, order_date, items, quantity, total, status, created_at)
         values ($1, $2, $3, 'cust1', 'Test Customer', '2026-10-01', $4::jsonb, 10, 50000, 'confirmed', now())`,
        [soId, TENANT, `SO-${soId.slice(3)}`, JSON.stringify(items)]
      );
    } catch {
      await db.query(
        `insert into sales_orders (id, tenant_slug, order_number, customer_name, order_date, items, quantity, total, status, created_at)
         values ($1, $2, $3, 'Test Customer', '2026-10-01', $4::jsonb, 10, 50000, 'confirmed', now())`,
        [soId, TENANT, `SO-${soId.slice(3)}`, JSON.stringify(items)]
      );
    }

    const { createDeliveryNote, deliverDeliveryNote } = await import("../lib/sales/delivery-notes");

    await expect(createDeliveryNote({
      tenantSlug: TENANT, salesOrderId: soId, deliveryDate: "2026-10-20",
      items: [{ soLineKey: "CAKE-VAN", sku: "CAKE-VAN", deliveredQty: 11, unitPrice: 5000 }],
    })).rejects.toThrow(/Over-delivery/);

    const n = await createDeliveryNote({
      tenantSlug: TENANT, salesOrderId: soId, deliveryDate: "2026-10-20",
      items: [{ soLineKey: "CAKE-VAN", sku: "CAKE-VAN", description: "Vanilla Cake", deliveredQty: 6, unitPrice: 5000 }],
    });
    expect(n.status).toBe("pending");
    await deliverDeliveryNote(TENANT, n.id);
    let so = (await db.query(`select status from sales_orders where id = $1`, [soId])).rows[0];
    expect(so.status).toBe("partially_delivered");

    // Remaining capacity shrinks: 4 open after delivering 6 of 10
    await expect(createDeliveryNote({
      tenantSlug: TENANT, salesOrderId: soId, deliveryDate: "2026-10-21",
      items: [{ soLineKey: "CAKE-VAN", sku: "CAKE-VAN", deliveredQty: 5, unitPrice: 5000 }],
    })).rejects.toThrow(/Over-delivery/);

    const n2 = await createDeliveryNote({
      tenantSlug: TENANT, salesOrderId: soId, deliveryDate: "2026-10-21",
      items: [{ soLineKey: "CAKE-VAN", sku: "CAKE-VAN", deliveredQty: 4, unitPrice: 5000 }],
    });
    await deliverDeliveryNote(TENANT, n2.id);
    so = (await db.query(`select status from sales_orders where id = $1`, [soId])).rows[0];
    expect(so.status).toBe("delivered");
  }, T);

  it("bill payment schedule: term template splits due amounts; payments walk the schedule", async () => {
    const { createPaymentTerm, buildBillSchedule, getBillSchedule, markBillSchedulePaid } =
      await import("../lib/finance/credit-control");

    await expect(createPaymentTerm({
      tenantSlug: TENANT, name: "Bad Term",
      terms: [{ days: 0, portion: 50 }, { days: 30, portion: 40 }],
    })).rejects.toThrow(/100/);

    const term = await createPaymentTerm({
      tenantSlug: TENANT, name: "30/70 Net",
      terms: [{ days: 0, portion: 30 }, { days: 30, portion: 70 }],
    });

    const billId = `bill_${randomUUID().slice(0, 8)}`;
    const schedule = await buildBillSchedule({
      tenantSlug: TENANT, billId, billDate: "2026-10-01",
      amount: 100001, paymentTermId: term.id,
    });
    expect(schedule.length).toBe(2);
    expect(schedule[0].amount).toBeCloseTo(30000.3, 2);
    expect(schedule[1].dueDate).toBe("2026-10-31");
    expect(schedule[0].amount + schedule[1].amount).toBeCloseTo(100001, 2);

    // A payment against the bill consumes the earliest installment first
    await markBillSchedulePaid(TENANT, billId, 40000);
    const rows = await getBillSchedule(TENANT, billId);
    expect(Number(rows[0].paid_amount)).toBeCloseTo(30000.3, 2);
    expect(Number(rows[1].paid_amount)).toBeCloseTo(9999.7, 2);
  }, T);

  it("landed_cost: ungated posts + folds unit cost; gated defers voucher to the chain", async () => {
    // Ungated path — TENANT has no spend-domain config
    const { createLandedCostVoucher } = await import("../lib/inventory/landed-cost");
    const sku = `LCV-${randomUUID().slice(0, 6)}`;
    try {
      await db.query(
        `insert into inventory_products (id, tenant_slug, sku, name, current_stock, unit_cost, location, category)
         values ($1,$2,$3,'LC Item',10,5000,'Main','General')`,
        [`ip_${randomUUID().slice(0, 8)}`, TENANT, sku]
      );
    } catch {
      await db.query(
        `insert into inventory_products (id, tenant_slug, sku, name, current_stock, unit_cost, location)
         values ($1,$2,$3,'LC Item',10,5000,'Main')`,
        [`ip_${randomUUID().slice(0, 8)}`, TENANT, sku]
      );
    }

    const { gateOrRun } = await import("../lib/finance/gated-actions");
    const ran = await gateOrRun(TENANT, "landed_cost", {
      referenceId: "GRN-X", chargeType: "freight", totalAmount: 5000,
      items: [{ sku, quantity: 10, unitCost: 5000 }],
    }, { requestedBy: "tester" });
    expect(ran.status).toBe("ran");

    // ₦5,000 over 10 units → +₦500/unit moving average
    const prod = (await db.query(
      `select unit_cost from inventory_products where tenant_slug = $1 and sku = $2`, [TENANT, sku]
    )).rows[0];
    expect(Number(prod.unit_cost)).toBeCloseTo(5500, 2);

    // Gated path — give TENANT a spend-domain matrix band (last test in
    // the file, so mutating its settings can't affect the others).
    await db.query(
      `update tenants set settings = $1::jsonb where slug = $2`,
      [JSON.stringify({ approvals: { authorityMatrix: {
        spend: [{ upTo: null, approvers: ["role:finance_manager"] }],
      }}}), TENANT]
    );
    const sku2 = `LCV-${randomUUID().slice(0, 6)}`;
    const pend = await gateOrRun(TENANT, "landed_cost", {
      referenceId: "GRN-Y", chargeType: "insurance", totalAmount: 2000,
      items: [{ sku: sku2, quantity: 5, unitCost: 1000 }],
    }, { requestedBy: "requester" });
    expect(pend.status).toBe("pending");
    // Voucher must NOT exist until approval
    let v = (await db.query(
      `select count(*)::int as c from landed_cost_vouchers where tenant_slug = $1 and reference_id = 'GRN-Y'`, [TENANT]
    )).rows[0];
    expect(v.c).toBe(0);
    await decideToTerminal((pend as any).approvalId);
    v = (await db.query(
      `select count(*)::int as c from landed_cost_vouchers where tenant_slug = $1 and reference_id = 'GRN-Y'`, [TENANT]
    )).rows[0];
    expect(v.c).toBe(1);

    // Restore ungated settings so a suite re-run stays deterministic
    // (beforeAll inserts on conflict-do-nothing, it doesn't reset).
    await db.query(
      `update tenants set settings = $1::jsonb where slug = $2`,
      [JSON.stringify({ approvals: {} }), TENANT]
    );
  }, T);

  it("uom: receipt posts stock in the product stock_uom + updates moving-average cost", async () => {
    // Conversion chain: Case → Unit ×12
    const { upsertUomConversion, ensureItemMasterTables } = await import("../lib/inventory/item-master");
    await ensureItemMasterTables();
    const { db: dbx } = await import("../lib/sql-client");
    await dbx.query(
      `insert into inventory_uoms (tenant_slug, name) values ($1,'Case'),($1,'Unit') on conflict do nothing`,
      [TENANT]
    ).catch(() => {});
    try { await upsertUomConversion(TENANT, "Case", "Unit", 12); } catch { /* exists */ }

    const sku = `UOM-${randomUUID().slice(0, 6)}`;
    try {
      await db.query(
        `insert into inventory_products (id, tenant_slug, sku, name, current_stock, unit_cost, location, category, stock_uom)
         values ($1,$2,$3,'Oil',10,100,'Main','General','Unit')`,
        [`ip_${randomUUID().slice(0, 8)}`, TENANT, sku]
      );
    } catch {
      await db.query(
        `insert into inventory_products (id, tenant_slug, sku, name, current_stock, unit_cost, location, stock_uom)
         values ($1,$2,$3,'Oil',10,100,'Main','Unit')`,
        [`ip_${randomUUID().slice(0, 8)}`, TENANT, sku]
      );
    }

    // Receive 2 Cases (= 24 Units) at ₦120/case → stock-in 24 units;
    // unit cost: (10×100 + 24×10)/(10+24)... unitPrice is per RECEIPT uom —
    // cost per stock unit = 120/12 = 10 → MA = (10×100 + 24×10)/34 = 36.47
    const { createPurchaseReceipt, receivePurchaseReceipt } = await import("../lib/finance/purchase-receipts");
    const r = await createPurchaseReceipt({
      tenantSlug: TENANT, receivedDate: "2026-10-22",
      items: [{ sku, description: "Oil", receivedQty: 2, unitPrice: 10, uom: "Case" }],
    });
    await receivePurchaseReceipt(TENANT, r.id);

    const mv = (await db.query(
      `select quantity, product_sku from stock_movements
       where tenant_slug = $1 and reference_id = $2`, [TENANT, r.id]
    )).rows[0];
    expect(Number(mv.quantity)).toBe(24);

    const prod = (await db.query(
      `select unit_cost from inventory_products where tenant_slug = $1 and sku = $2`, [TENANT, sku]
    )).rows[0];
    // MA over stock qty: (10×100 + 24×10) / 34 = 36.47
    expect(Number(prod.unit_cost)).toBeCloseTo(36.47, 2);
  }, T);

  it("fifo: layers consume oldest-first and stamp real COGS on the issue movement", async () => {
    // Opt TENANT into fifo (restore at end — beforeAll doesn't reset settings)
    await db.query(`update tenants set settings = $1::jsonb where slug = $2`,
      [JSON.stringify({ inventory: { valuationMethod: "fifo" }, approvals: {} }), TENANT]);

    const sku = `FIFO-${randomUUID().slice(0, 6)}`;
    try {
      await db.query(
        `insert into inventory_products (id, tenant_slug, sku, name, current_stock, unit_cost, location, category, allow_negative_stock)
         values ($1,$2,$3,'Widget',0,0,'Main','General',true)`,
        [`ip_${randomUUID().slice(0, 8)}`, TENANT, sku]
      );
    } catch {
      await db.query(
        `insert into inventory_products (id, tenant_slug, sku, name, current_stock, unit_cost, location)
         values ($1,$2,$3,'Widget',0,0,'Main')`,
        [`ip_${randomUUID().slice(0, 8)}`, TENANT, sku]
      );
    }

    const { fifoLayerIn, fifoLayerOut, fifoValuation } = await import("../lib/inventory/valuation");
    // Two layers: 10 @ ₦100, then 10 @ ₦120
    await fifoLayerIn({ tenantSlug: TENANT, productSku: sku, quantity: 10, unitCost: 100 });
    await fifoLayerIn({ tenantSlug: TENANT, productSku: sku, quantity: 10, unitCost: 120 });

    // Issue 15 → should consume all 10×100 + 5×120 = ₦1600
    const mvId = `mv_fifo_${randomUUID().slice(0, 6)}`;
    await db.query(
      `insert into stock_movements (id, tenant_slug, product_sku, product_name, movement_type, quantity, unit_cost, reference_type, reference_id, created_at)
       values ($1,$2,$3,'Widget','sale',15,110,'test','x',now())`,
      [mvId, TENANT, sku]
    );
    const cogs = await fifoLayerOut({ tenantSlug: TENANT, productSku: sku, quantity: 15, movementId: mvId });
    expect(cogs).toBeCloseTo(1600, 2);

    const mv = (await db.query(`select cogs_amount from stock_movements where id = $1`, [mvId])).rows[0];
    expect(Number(mv.cogs_amount)).toBeCloseTo(1600, 2);

    // Remaining: 5 @ ₦120 = ₦600
    const val = await fifoValuation(TENANT);
    const row = val.find((r: any) => r.product_sku === sku);
    expect(Number(row.on_hand)).toBe(5);
    expect(Number(row.value)).toBeCloseTo(600, 2);

    await db.query(`update tenants set settings = $1::jsonb where slug = $2`,
      [JSON.stringify({ approvals: {} }), TENANT]);
  }, T);

  it("customer_merge: gated action rewrites every reference and marks the source merged", async () => {
    const { ensureMergeTables, mergeCustomer } = await import("../lib/finance/merge");
    const { sql } = await import("../lib/sql-client");
    await ensureMergeTables(sql);

    const srcId = randomUUID(), tgtId = randomUUID();
    for (const [id, name] of [[srcId, "Dup Customer"], [tgtId, "Real Customer"]] as const) {
      try {
        await db.query(
          `insert into finance_customers (id, tenant_slug, customer_code, name)
           values ($1,$2,$3,$4)`,
          [id, TENANT, `C-${id.slice(0,4)}`, name]
        );
      } catch {
        await db.query(
          `insert into finance_customers (id, tenant_slug, name)
           values ($1,$2,$3)`, [id, TENANT, name]
        );
      }
    }
    // References on the source: an invoice + a sales order
    const invId = `inv_${randomUUID().slice(0, 6)}`;
    await db.query(
      `insert into finance_invoices (id, tenant_slug, invoice_number, customer_id, customer_name, amount, balance_due, status, issued_date, due_date)
       values ($1,$2,$3,$4,'Dup Customer',5000,5000,'sent','2026-10-01','2026-10-31')`,
      [invId, TENANT, `INV-${invId.slice(4)}`, srcId]
    );
    const soId = `so_${randomUUID().slice(0, 6)}`;
    try {
      await db.query(
        `insert into sales_orders (id, tenant_slug, order_number, customer_id, customer_name, order_date, items, quantity, total, status, created_at)
         values ($1,$2,$3,$4,'Dup Customer','2026-10-02','[]',1,5000,'open',now())`,
        [soId, TENANT, `SO-${soId.slice(3)}`, srcId]
      );
    } catch {
      await db.query(
        `insert into sales_orders (id, tenant_slug, customer_id, order_date, items, status, created_at)
         values ($1,$2,$3,'2026-10-02','[]','open',now())`,
        [soId, TENANT, srcId]
      );
    }

    // Always-gated — the action can't run unapproved
    const { gateOrRun } = await import("../lib/finance/gated-actions");
    const pend = await gateOrRun(TENANT, "customer_merge",
      { sourceId: srcId, targetId: tgtId }, { requestedBy: "admin" });
    expect(pend.status).toBe("pending");
    let src = (await db.query(`select merged_into from finance_customers where id = $1`, [srcId])).rows[0];
    expect(src.merged_into).toBeNull();

    await decideToTerminal((pend as any).approvalId);

    const inv = (await db.query(`select customer_id from finance_invoices where id = $1`, [invId])).rows[0];
    expect(inv.customer_id).toBe(tgtId);
    const so = (await db.query(`select customer_id from sales_orders where id = $1`, [soId])).rows[0];
    expect(so.customer_id).toBe(tgtId);
    src = (await db.query(`select merged_into from finance_customers where id = $1`, [srcId])).rows[0];
    expect(src.merged_into).toBe(tgtId);
    const merge = (await db.query(`select rewrote from document_merges where tenant_slug = $1`, [TENANT])).rows[0];
    expect(Object.keys(merge.rewrote).length).toBeGreaterThan(0);
  }, T);
});
