import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../lib/sql-client";

const TENANT = `__regtest_${Date.now()}__`;
const T = 300000;

async function cleanup() {
  for (const t of [
    "saved_reports", "payment_applications", "finance_payments",
    "finance_invoice_lines", "finance_invoices",
    "vendor_payment_applications", "vendor_payments",
    "bill_items", "bills", "vendors",
  ]) {
    await db.query(`delete from ${t} where tenant_slug = $1`, [TENANT]).catch(() => undefined);
  }
}
beforeAll(cleanup, 120000);
afterAll(cleanup, 120000);

async function seedArAp() {
  const { insertFinanceInvoice } = await import("../lib/finance/db");
  const { createVendor } = await import("../lib/finance/vendors");
  const { createBill } = await import("../lib/finance/bills");
  const { createVendorPayment } = await import("../lib/finance/vendor-payments");

  const inv = await insertFinanceInvoice({
    tenantSlug: TENANT,
    customerName: "Register Co",
    customerCode: "REG-C1",
    invoiceNumber: "REG-INV-1",
    issuedDate: "2026-11-01",
    dueDate: "2026-11-30",
    amount: 215,
    status: "sent",
    lineItems: [
      { description: "Goods", quantity: 2, unitPrice: 100, taxRate: 7.5 },
    ],
  } as any);

  const vendor = await createVendor({ tenantSlug: TENANT, code: "REG-V1", name: "Register Vendor" } as any);
  const bill = await createBill({
    tenantSlug: TENANT, vendorId: vendor.id, billDate: "2026-11-02", dueDate: "2026-12-02",
    items: [{ description: "Stock", quantity: 4, unitPrice: 50, taxRate: 7.5, accountCode: "1500" }],
  } as any);
  const vendorPayment = await createVendorPayment({
    tenantSlug: TENANT, vendorId: vendor.id, method: "bank_transfer",
    amount: 300, paymentDate: "2026-11-03",
  } as any);
  return { inv, vendor, bill, vendorPayment };
}

describe.skipIf(!process.env.DATABASE_URL)("registers + ledger summaries", () => {
  it("sales register lists invoices with tax and totals; item-wise expands lines", async () => {
    const { inv } = await seedArAp();
    const { generateSalesRegister } = await import("../lib/finance/registers");

    const reg = await generateSalesRegister({ tenantSlug: TENANT });
    const row = reg.rows.find((r) => r.documentNumber === "REG-INV-1");
    expect(row).toBeTruthy();
    expect(row.subtotal).toBe(200);
    expect(row.tax).toBeCloseTo(15, 2);
    expect(row.total).toBe(215);
    expect(reg.totals.total).toBeGreaterThanOrEqual(215);

    const iw = await generateSalesRegister({ tenantSlug: TENANT }, true);
    const line = iw.rows.find((r) => r.documentNumber === "REG-INV-1" && r.description === "Goods");
    expect(line.quantity).toBe(2);
    expect(line.tax).toBeCloseTo(15, 2);

    // date window excludes the invoice
    const out = await generateSalesRegister({ tenantSlug: TENANT, periodStart: new Date("2026-12-01"), periodEnd: new Date("2026-12-31") });
    expect(out.rows.find((r) => r.documentNumber === "REG-INV-1")).toBeUndefined();
  }, T);

  it("purchase register lists bills with WHT-separated totals", async () => {
    const { generatePurchaseRegister } = await import("../lib/finance/registers");
    const reg = await generatePurchaseRegister({ tenantSlug: TENANT });
    const row = reg.rows.find((r) => r.documentNumber.startsWith("BILL-"));
    expect(row).toBeTruthy();
    expect(row.party).toBe("Register Vendor");
    expect(row.subtotal).toBe(200);
    expect(row.tax).toBeCloseTo(15, 2);
    expect(row.total).toBe(215);

    const iw = await generatePurchaseRegister({ tenantSlug: TENANT }, true);
    const line = iw.rows.find((r) => r.description === "Stock");
    expect(line.quantity).toBe(4);
    expect(line.tax).toBeCloseTo(15, 2);
  }, T);

  it("customer ledger summary computes opening/invoiced/paid/closing", async () => {
    const { receiveInvoicePayment } = await import("../lib/finance/db");
    const { generateCustomerLedgerSummary } = await import("../lib/finance/registers");
    const { rows: invRows } = await db.query(
      `select id from finance_invoices where tenant_slug = $1 and invoice_number = 'REG-INV-1'`, [TENANT]);
    await receiveInvoicePayment({
      tenantSlug: TENANT, invoiceId: (invRows as any[])[0].id,
      amount: 100, method: "bank_transfer", paymentDate: "2026-11-05",
    });

    const sum = await generateCustomerLedgerSummary({ tenantSlug: TENANT });
    const row = sum.rows.find((r) => r.party === "Register Co");
    expect(row.invoiced).toBe(215);
    expect(row.paid).toBe(100);
    expect(row.closing).toBe(115);

    // period window after all activity → everything lands in opening
    const later = await generateCustomerLedgerSummary({ tenantSlug: TENANT, periodStart: new Date("2027-01-01") });
    const laterRow = later.rows.find((r) => r.party === "Register Co");
    expect(laterRow.invoiced).toBe(0);
    expect(laterRow.paid).toBe(0);
    expect(laterRow.opening).toBe(115);
  }, T);

  it("supplier ledger summary tracks bills vs applied vendor payments", async () => {
    const { applyVendorPaymentToBill, generateSupplierLedgerSummary } = await Promise.all([
      import("../lib/finance/payment-reconciliation"),
      import("../lib/finance/registers"),
    ]).then(([pr, reg]) => ({ ...pr, ...reg }));
    const { rows: vrows } = await db.query(
      `select vp.id, b.id bill_id from vendor_payments vp, bills b
       where vp.tenant_slug = $1 and b.tenant_slug = $1 limit 1`, [TENANT]);
    await applyVendorPaymentToBill({
      tenantSlug: TENANT, paymentId: (vrows as any[])[0].id,
      billId: (vrows as any[])[0].bill_id, amount: 100,
    });

    const sum = await generateSupplierLedgerSummary({ tenantSlug: TENANT });
    const row = sum.rows.find((r) => r.party === "Register Vendor");
    expect(row.invoiced).toBe(215);
    expect(row.paid).toBe(100);
    expect(row.closing).toBe(115);
  }, T);
});

describe.skipIf(!process.env.DATABASE_URL)("saved reports", () => {
  it("creates, lists, updates and deletes; upserts on name+key conflict; tenant-isolated", async () => {
    const { createSavedReport, listSavedReports, updateSavedReport, deleteSavedReport } =
      await import("../lib/finance/registers");

    const a = await createSavedReport({
      tenantSlug: TENANT, name: "Nov Sales", reportKey: "sales-register",
      config: { startDate: "2026-11-01", endDate: "2026-11-30" }, createdBy: "test",
    });
    expect(a.id).toBeTruthy();

    // upsert on name+key conflict updates config
    const b = await createSavedReport({
      tenantSlug: TENANT, name: "Nov Sales", reportKey: "sales-register",
      config: { startDate: "2026-11-01", endDate: "2026-11-15", branchId: "B1" },
    });
    expect(b.id).toBe(a.id);
    expect(b.config.branchId).toBe("B1");

    const list = await listSavedReports(TENANT);
    expect(list.filter((r) => r.name === "Nov Sales")).toHaveLength(1);
    expect(await listSavedReports(TENANT, "sales-register")).toHaveLength(1);
    expect(await listSavedReports(TENANT, "purchase-register")).toHaveLength(0);

    const upd = await updateSavedReport(a.id, TENANT, { name: "Nov Sales v2" });
    expect(upd.name).toBe("Nov Sales v2");

    // tenant isolation: other tenant can't see or delete
    expect(await listSavedReports("__other_tenant__")).toHaveLength(0);
    expect(await updateSavedReport(a.id, "__other_tenant__", { name: "x" })).toBeNull();
    expect(await deleteSavedReport(a.id, "__other_tenant__")).toBe(false);
    expect(await deleteSavedReport(a.id, TENANT)).toBe(true);
    expect(await listSavedReports(TENANT)).toHaveLength(0);
  }, T);
});

describe.skipIf(!process.env.DATABASE_URL)("payment reconciliation", () => {
  it("lists unallocated payments, applies partial + full, rejects over-allocation", async () => {
    const { getUnallocatedCustomerPayments, applyCustomerPaymentToInvoice, getOpenCustomerInvoices } =
      await import("../lib/finance/payment-reconciliation");

    // an unallocated payment (no applications — e.g. an advance receipt)
    const payId = `PAY-ADV-${Date.now()}`;
    await db.query(
      `insert into finance_payments (id, tenant_slug, reference, gross_amount, fees, net_amount, method, payment_date, status)
       values ($1, $2, 'ADV-1', 250, 0, 250, 'bank_transfer', '2026-11-10', 'successful')`,
      [payId, TENANT],
    );

    const un = await getUnallocatedCustomerPayments(TENANT);
    const mine = un.find((p) => p.id === payId);
    expect(mine.unallocated).toBe(250);

    const { rows: invRows } = await db.query(
      `select id, balance_due from finance_invoices where tenant_slug = $1 and invoice_number = 'REG-INV-1'`, [TENANT]);
    const inv = (invRows as any[])[0];

    // partial allocation
    const r1 = await applyCustomerPaymentToInvoice({ tenantSlug: TENANT, paymentId: payId, invoiceId: inv.id, amount: 60 });
    expect(r1.balanceDue).toBeCloseTo(Number(inv.balance_due) - 60, 2);
    expect(r1.status).toBe("partially_paid");

    const un2 = (await getUnallocatedCustomerPayments(TENANT)).find((p) => p.id === payId);
    expect(un2.unallocated).toBeCloseTo(190, 2);

    // over-allocation rejected
    await expect(applyCustomerPaymentToInvoice({
      tenantSlug: TENANT, paymentId: payId, invoiceId: inv.id, amount: 9999,
    })).rejects.toThrow(/exceeds/);

    // full allocation closes both sides
    const bal = (await db.query(`select balance_due from finance_invoices where id = $1`, [inv.id])).rows[0].balance_due;
    const r2 = await applyCustomerPaymentToInvoice({ tenantSlug: TENANT, paymentId: payId, invoiceId: inv.id, amount: Number(bal) });
    expect(r2.status).toBe("paid");
    const un3 = (await getUnallocatedCustomerPayments(TENANT)).find((p) => p.id === payId);
    expect(un3.unallocated).toBeCloseTo(190 - Number(bal), 2);

    // paid invoice rejects further allocation
    await expect(applyCustomerPaymentToInvoice({
      tenantSlug: TENANT, paymentId: payId, invoiceId: inv.id, amount: 1,
    })).rejects.toThrow(/status/);
  }, T);

  it("vendor side lists unapplied payments and applies via applyPaymentToBill", async () => {
    const { getUnappliedVendorPayments, applyVendorPaymentToBill } =
      await import("../lib/finance/payment-reconciliation");

    const un = await getUnappliedVendorPayments(TENANT);
    const mine = un.find((p) => p.unallocated > 0);
    expect(mine).toBeTruthy();
    // 300 created, 100 applied in the earlier test → 200 remaining
    expect(mine.unallocated).toBe(200);

    const { rows: billRows } = await db.query(
      `select id, balance_due from bills where tenant_slug = $1 limit 1`, [TENANT]);
    const bill = (billRows as any[])[0];
    await applyVendorPaymentToBill({ tenantSlug: TENANT, paymentId: mine.id, billId: bill.id, amount: 50 });
    const after = (await getUnappliedVendorPayments(TENANT)).find((p) => p.id === mine.id);
    expect(after.unallocated).toBe(150);
    const bal = (await db.query(`select balance_due from bills where id = $1`, [bill.id])).rows[0];
    expect(Number(bal.balance_due)).toBeCloseTo(Number(bill.balance_due) - 50, 2);
  }, T);
});
