import { describe, it, expect, beforeAll, afterAll } from "vitest";
import process from "node:process";

const T = 240000;
const TENANT = `test-approve-${Date.now()}`;
const FREE_TENANT = `test-approve-free-${Date.now()}`;
let db: any;

async function cleanupTenant(t: string) {
  await db.query(`delete from approvals where tenant_slug = $1`, [t]);
  await db.query(`delete from approval_rules where tenant_slug = $1`, [t]);
  await db.query(`delete from finance_returns where tenant_slug = $1`, [t]);
  await db.query(`delete from purchase_order_items where purchase_order_id in (select id from purchase_orders where tenant_slug = $1)`, [t]);
  await db.query(`delete from purchase_orders where tenant_slug = $1`, [t]);
  await db.query(`delete from bill_items where bill_id in (select id from bills where tenant_slug = $1)`, [t]);
  await db.query(`delete from bills where tenant_slug = $1`, [t]);
  await db.query(`delete from vendors where tenant_slug = $1`, [t]);
  await db.query(`delete from finance_payments where tenant_slug = $1`, [t]);
  await db.query(`delete from finance_invoice_lines where invoice_id in (select id from finance_invoices where tenant_slug = $1)`, [t]);
  await db.query(`delete from finance_invoices where tenant_slug = $1`, [t]);
  await db.query(`delete from tax_transactions where tenant_slug = $1`, [t]);
  await db.query(`delete from stock_movements where tenant_slug = $1`, [t]);
  await db.query(`delete from inventory_products where tenant_slug = $1`, [t]);
  await db.query(`delete from journal_entry_lines where journal_entry_id in (select id from journal_entries where tenant_slug = $1)`, [t]);
  await db.query(`delete from journal_entry_lines where entry_id in (select id from journal_entries where tenant_slug = $1)`, [t]);
  await db.query(`delete from journal_entries where tenant_slug = $1`, [t]);
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
  await db.query(
    `insert into tenants (name, slug, settings, seats) values ($1, $2, $3::jsonb, 1)
     on conflict (slug) do nothing`,
    ["Approval Gates", TENANT, JSON.stringify({
      currency: "NGN",
      approvals: { journalEntryMinAmount: 1000, purchaseOrderMinAmount: 5000, returnMinAmount: 500 },
    })]
  );
  await db.query(
    `insert into tenants (name, slug, settings, seats) values ($1, $2, '{}'::jsonb, 1)
     on conflict (slug) do nothing`,
    ["Approval Free", FREE_TENANT]
  );
  const { ensureApprovalTables } = await import("../lib/finance/approvals");
  await ensureApprovalTables();
}, T);

afterAll(async () => { if (db) await cleanup(); }, T);

describe("approval gates", () => {
  it("requiresApproval honors tenant thresholds and ignores unconfigured tenants", async () => {
    const { requiresApproval } = await import("../lib/finance/approvals");
    expect(await requiresApproval(TENANT, "journal_entry", { amount: 500 })).toBe(false);
    expect(await requiresApproval(TENANT, "journal_entry", { amount: 1500 })).toBe(true);
    expect(await requiresApproval(TENANT, "purchase_order", { amount: 6000 })).toBe(true);
    expect(await requiresApproval(TENANT, "sales_return", { amount: 600 })).toBe(true);
    // No thresholds configured — nothing is gated
    expect(await requiresApproval(FREE_TENANT, "journal_entry", { amount: 999999 })).toBe(false);
    expect(await requiresApproval(FREE_TENANT, "purchase_order", { amount: 999999 })).toBe(false);
  }, T);

  it("manual JE over threshold posts DRAFT and flips to POSTED on approval", async () => {
    const { createJournalEntry } = await import("../lib/finance/accounting");
    const { requiresApproval, initiateApproval, processApprovalDecision } = await import("../lib/finance/approvals");

    const gated = await requiresApproval(TENANT, "journal_entry", { amount: 5000 });
    expect(gated).toBe(true);

    const entry = await createJournalEntry({
      tenantSlug: TENANT,
      entryDate: "2026-11-15",
      referenceType: "manual",
      description: "Gated manual JE",
      status: "DRAFT",
      lines: [
        { accountCode: "6100", debitAmount: 5000, creditAmount: 0 },
        { accountCode: "1100", debitAmount: 0, creditAmount: 5000 },
      ],
    });

    const approval = await initiateApproval({
      tenantSlug: TENANT, entityType: "journal_entry", entityId: entry.id,
      requestedBy: "test-maker", entityData: { amount: 5000 },
    });
    expect(approval.status).toBe("pending");

    let je = (await db.query(
      `select approval_status, status from journal_entries where id = $1`, [entry.id])).rows[0];
    expect(je.approval_status).toBe("DRAFT");

    const decided = await processApprovalDecision({
      approvalId: approval.id, userId: "checker-1", userRole: "admin", decision: "approved",
    });
    expect(decided?.status).toBe("approved");

    je = (await db.query(
      `select approval_status, status, posted_at from journal_entries where id = $1`, [entry.id])).rows[0];
    expect(je.approval_status).toBe("POSTED");
    expect(je.posted_at).not.toBeNull();
  }, T);

  it("rejected JE is marked REJECTED and never posts", async () => {
    const { createJournalEntry } = await import("../lib/finance/accounting");
    const { initiateApproval, processApprovalDecision } = await import("../lib/finance/approvals");

    const entry = await createJournalEntry({
      tenantSlug: TENANT,
      entryDate: "2026-11-15",
      referenceType: "manual",
      description: "JE to reject",
      status: "DRAFT",
      lines: [
        { accountCode: "6100", debitAmount: 2000, creditAmount: 0 },
        { accountCode: "1100", debitAmount: 0, creditAmount: 2000 },
      ],
    });
    const approval = await initiateApproval({
      tenantSlug: TENANT, entityType: "journal_entry", entityId: entry.id,
      requestedBy: "test-maker", entityData: { amount: 2000 },
    });
    await processApprovalDecision({
      approvalId: approval.id, userId: "checker-1", userRole: "admin", decision: "rejected",
    });
    const je = (await db.query(
      `select approval_status, status, posted_at from journal_entries where id = $1`, [entry.id])).rows[0];
    expect(je.approval_status).toBe("REJECTED");
    expect(je.posted_at).toBeNull();
  }, T);

  it("PO over threshold stays pending_approval and blocks bill conversion until approved", async () => {
    const { createPurchaseOrder } = await import("../lib/finance/purchase-orders");
    const { convertPOToBill } = await import("../lib/finance/bills");
    const { createVendor } = await import("../lib/finance/vendors");
    const { getApprovals, processApprovalDecision } = await import("../lib/finance/approvals");

    const vendor = await createVendor({ tenantSlug: TENANT, code: "V-GATE", name: "Gate Vendor" });

    const po = await createPurchaseOrder({
      tenantSlug: TENANT,
      supplierId: (vendor as any).id,
      orderNumber: "PO-GATE-1",
      issuedDate: "2026-11-15",
      dueDate: "2026-11-30",
      items: [{ description: "Expensive goods", quantity: 10, unitPrice: 1000 }],
    });
    expect((po as any).status).toBe("pending_approval");

    const approvals = await getApprovals({ tenantSlug: TENANT, entityType: "purchase_order", entityId: (po as any).id });
    expect(approvals.length).toBe(1);

    // Blocked while pending
    await expect(convertPOToBill((po as any).id, { billDate: "2026-11-16" }, TENANT))
      .rejects.toThrow(/pending approval/i);

    await processApprovalDecision({
      approvalId: approvals[0].id, userId: "checker-1", userRole: "admin", decision: "approved",
    });
    const poRow = (await db.query(`select status from purchase_orders where id = $1`, [(po as any).id])).rows[0];
    expect(poRow.status).toBe("open");

    const bill = await convertPOToBill((po as any).id, { billDate: "2026-11-16" }, TENANT);
    expect(bill).toBeTruthy();
  }, T);

  it("under-threshold PO stays open with no approval", async () => {
    const { createPurchaseOrder } = await import("../lib/finance/purchase-orders");
    const { getApprovals } = await import("../lib/finance/approvals");
    const po = await createPurchaseOrder({
      tenantSlug: TENANT,
      orderNumber: "PO-SMALL-1",
      issuedDate: "2026-11-15",
      dueDate: "2026-11-30",
      items: [{ description: "Cheap goods", quantity: 1, unitPrice: 100 }],
    });
    expect((po as any).status).toBe("open");
    const approvals = await getApprovals({ tenantSlug: TENANT, entityType: "purchase_order", entityId: (po as any).id });
    expect(approvals.length).toBe(0);
  }, T);

  it("gated sales return defers all effects until approval", async () => {
    const { insertFinanceInvoice } = await import("../lib/finance/db");
    const { createSalesReturn } = await import("../lib/finance/returns");
    const { getApprovals, processApprovalDecision } = await import("../lib/finance/approvals");

    const invoice = await insertFinanceInvoice({
      tenantSlug: TENANT,
      customerName: "Gate Customer",
      invoiceNumber: `INV-G-${Date.now()}`,
      issuedDate: "2026-11-10",
      dueDate: "2026-11-20",
      amount: 2000,
      status: "sent",
      lineItems: [{ description: "Item", quantity: 1, unitPrice: 2000, amount: 2000 }],
    });

    const ret = await createSalesReturn(TENANT, {
      invoiceId: invoice.id,
      items: [{ description: "Item", quantity: 1, unitPrice: 800 }],
      reason: "defect",
    });
    expect(ret.status).toBe("pending_approval");

    // No financial effect yet
    const invRow = (await db.query(`select balance_due::float b from finance_invoices where id=$1`, [invoice.id])).rows[0];
    expect(invRow.b).toBe(2000);

    const approvals = await getApprovals({ tenantSlug: TENANT, entityType: "sales_return", entityId: ret.id });
    expect(approvals.length).toBe(1);

    await processApprovalDecision({
      approvalId: approvals[0].id, userId: "checker-1", userRole: "admin", decision: "approved",
    });

    const retRow = (await db.query(`select status, journal_entry_id from finance_returns where id=$1`, [ret.id])).rows[0];
    expect(retRow.status).toBe("posted");
    expect(retRow.journal_entry_id).toBeTruthy();

    const invAfter = (await db.query(`select balance_due::float b from finance_invoices where id=$1`, [invoice.id])).rows[0];
    expect(invAfter.b).toBe(1200);
  }, T);

  it("rejected sales return cancels with no effects", async () => {
    const { insertFinanceInvoice } = await import("../lib/finance/db");
    const { createSalesReturn } = await import("../lib/finance/returns");
    const { getApprovals, processApprovalDecision } = await import("../lib/finance/approvals");

    const invoice = await insertFinanceInvoice({
      tenantSlug: TENANT,
      customerName: "Gate Customer",
      invoiceNumber: `INV-GR-${Date.now()}`,
      issuedDate: "2026-11-10",
      dueDate: "2026-11-20",
      amount: 1500,
      status: "sent",
      lineItems: [{ description: "Item", quantity: 1, unitPrice: 1500, amount: 1500 }],
    });

    const ret = await createSalesReturn(TENANT, {
      invoiceId: invoice.id,
      items: [{ description: "Item", quantity: 1, unitPrice: 700 }],
      reason: "bad",
    });
    expect(ret.status).toBe("pending_approval");

    const approvals = await getApprovals({ tenantSlug: TENANT, entityType: "sales_return", entityId: ret.id });
    await processApprovalDecision({
      approvalId: approvals[0].id, userId: "checker-1", userRole: "admin", decision: "rejected",
    });

    const retRow = (await db.query(`select status, journal_entry_id from finance_returns where id=$1`, [ret.id])).rows[0];
    expect(retRow.status).toBe("cancelled");
    expect(retRow.journal_entry_id).toBeNull();
    const invRow = (await db.query(`select balance_due::float b from finance_invoices where id=$1`, [invoice.id])).rows[0];
    expect(invRow.b).toBe(1500);
  }, T);

  it("under-threshold return posts immediately (ungated)", async () => {
    const { insertFinanceInvoice } = await import("../lib/finance/db");
    const { createSalesReturn } = await import("../lib/finance/returns");
    const invoice = await insertFinanceInvoice({
      tenantSlug: TENANT,
      customerName: "Gate Customer",
      invoiceNumber: `INV-GU-${Date.now()}`,
      issuedDate: "2026-11-10",
      dueDate: "2026-11-20",
      amount: 400,
      status: "sent",
      lineItems: [{ description: "Item", quantity: 1, unitPrice: 400, amount: 400 }],
    });
    const ret = await createSalesReturn(TENANT, {
      invoiceId: invoice.id,
      items: [{ description: "Item", quantity: 1, unitPrice: 300 }],
    });
    expect(ret.status).toBe("posted");
  }, T);
});
