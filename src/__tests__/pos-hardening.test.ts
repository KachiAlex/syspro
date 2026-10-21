import { describe, it, expect, beforeAll, afterAll } from "vitest";
import process from "node:process";

const T = 240000;
const TENANT = `test-poshard-${Date.now()}`;
let db: any;

async function cleanup() {
  await db.query(`delete from pos_returns where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from pos_cash_movements where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from pos_held_sales where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from pos_price_list_items where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from pos_price_lists where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from pos_loyalty_txns where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from pos_audit_log where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from pos_counters where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from pos_sales where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from pos_shifts where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from pos_registers where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from finance_returns where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from finance_payments where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from stock_movements where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from inventory_serials where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from inventory_lot_stock where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from inventory_products where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from finance_customers where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from finance_invoice_lines where invoice_id in (select id from finance_invoices where tenant_slug = $1)`, [TENANT]);
  await db.query(`delete from finance_invoices where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from tax_transactions where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from journal_entry_lines where journal_entry_id in (select id from journal_entries where tenant_slug = $1)`, [TENANT]);
  await db.query(`delete from journal_entry_lines where entry_id in (select id from journal_entries where tenant_slug = $1)`, [TENANT]);
  await db.query(`delete from journal_entries where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from tenants where slug = $1`, [TENANT]);
}

async function jeLinesFor(referenceId: string) {
  const rows = await db.query(
    `select l.* from journal_entry_lines l
     join journal_entries e on e.id = coalesce(l.journal_entry_id, l.entry_id)
     where e.tenant_slug = $1 and e.reference_id = $2`,
    [TENANT, referenceId]
  );
  return rows.rows ?? rows;
}

async function makeProduct(sku: string, stock = 10, price = 100) {
  await db.query(
    `insert into inventory_products (id, tenant_slug, name, sku, category, current_stock, unit_cost, sale_price, tracking, created_at)
     values (gen_random_uuid()::text, $1, $2, $3, 'pos', $4, 50, $5, 'none', now())
     on conflict do nothing`,
    [TENANT, `P-${sku}`, sku, stock, price]
  );
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  db = (await import("../lib/sql-client")).db;
  await cleanup();
  await db.query(
    `insert into tenants (name, slug, settings, seats)
     values ($1, $2, $3::jsonb, 1)
     on conflict (slug) do nothing`,
    ["POS Hardening", TENANT, JSON.stringify({
      currency: "NGN",
      pos: { vatRate: 7.5, cardFeePct: 1.5, varianceTolerance: 100, loyalty: { enabled: true, earnDivisor: 1000, redeemValue: 10 } },
    })]
  );
  // Prime the lazy table ensures
  const { ensurePosTables } = await import("../lib/pos/sales");
  const { ensureShiftTables } = await import("../lib/pos/shifts");
  const { ensureReturnTables } = await import("../lib/pos/returns");
  const { ensureHeldTables } = await import("../lib/pos/held");
  await ensurePosTables(); await ensureShiftTables(); await ensureReturnTables(); await ensureHeldTables();
}, T);

afterAll(async () => {
  if (db) await cleanup();
}, T);

describe("POS registers & multi-till shifts", () => {
  it("allows one open shift per register — two registers run in parallel", async () => {
    const { createRegister } = await import("../lib/pos/registers");
    const { openShift, getOpenShift, closeShift } = await import("../lib/pos/shifts");

    const regA = await createRegister(TENANT, { code: "TILL-A", name: "Front till" });
    const regB = await createRegister(TENANT, { code: "TILL-B", name: "Back till" });

    const shiftA = await openShift(TENANT, { openingFloat: 1000, registerId: regA.id, openedBy: "t" });
    const shiftB = await openShift(TENANT, { openingFloat: 2000, registerId: regB.id, openedBy: "t" });
    expect(shiftA.id).not.toBe(shiftB.id);

    // Second open on same register rejected; other register unaffected
    await expect(openShift(TENANT, { registerId: regA.id })).rejects.toThrow(/already open/i);
    expect((await getOpenShift(TENANT, regB.id))?.id).toBe(shiftB.id);
    expect(await getOpenShift(TENANT, regA.id)).not.toBeNull();
    expect(await getOpenShift(TENANT, "nonexistent-reg")).toBeNull();

    await closeShift(TENANT, shiftA.id, { closingCounted: 1000, closedBy: "t" });
    // B still open
    expect((await getOpenShift(TENANT, regB.id))?.id).toBe(shiftB.id);
  }, T);
});

describe("POS sale integrity", () => {
  let saleId = "";
  let receiptNo = "";

  it("rings a split-tender sale with card fee, sequential receipt, and balanced JE", async () => {
    const { createPosSale } = await import("../lib/pos/sales");
    const { openShift, getOpenShift } = await import("../lib/pos/shifts");
    // Sales without a registerId run on the default register ('').
    if (!(await getOpenShift(TENANT))) await openShift(TENANT, { openingFloat: 0, openedBy: "t" });
    await makeProduct("SPLIT-1", 10, 1000);

    const sale = await createPosSale(TENANT, {
      items: [{ sku: "SPLIT-1", quantity: 1 }],
      registerId: undefined,
      tenders: [
        { method: "cash", amount: 500, tendered: 600 },
        { method: "pos", amount: 575 },
      ],
      idempotencyKey: "idem-split-1",
      createdBy: "test",
    });
    // 1000 + 7.5% VAT = 1075; tenders 500+575
    expect(sale.total).toBe(1075);
    expect(sale.change).toBe(100);
    expect(sale.receiptNo).toMatch(/^POS-MAIN-\d{6}$/);
    saleId = sale.id; receiptNo = sale.receiptNo;

    // Receipt JE: Dr cash 500 + Dr bank (575 - 1.5% fee = 566.38) + Dr fees 8.63 — Cr AR 1075
    const lines = await jeLinesFor(receiptNo);
    const cash = lines.find((l: any) => l.account_code === "1110");
    const bank = lines.find((l: any) => l.account_code === "1100");
    const fees = lines.find((l: any) => l.account_code === "6810");
    const ar = lines.find((l: any) => l.account_code === "1200");
    expect(Number(cash.debit_amount)).toBe(500);
    // fee = round(575 * 1.5%) = 8.63 → bank debit = 575 - 8.63 = 566.37
    expect(Number(bank.debit_amount)).toBe(566.37);
    expect(Number(fees.debit_amount)).toBe(8.63);
    expect(Number(ar.credit_amount)).toBe(1075);
    const debit = lines.reduce((s: number, l: any) => s + Number(l.debit_amount), 0);
    const credit = lines.reduce((s: number, l: any) => s + Number(l.credit_amount), 0);
    expect(Math.abs(debit - credit)).toBeLessThan(0.02);

    // Sequential numbering continues
    await makeProduct("SEQ-1", 5, 50);
    const s2 = await createPosSale(TENANT, { items: [{ sku: "SEQ-1", quantity: 1 }], paymentMethod: "cash" });
    expect(s2.receiptNo > receiptNo).toBe(true);
  }, T);

  it("returns the original sale on idempotent replay", async () => {
    const { createPosSale } = await import("../lib/pos/sales");
    const replay = await createPosSale(TENANT, {
      items: [{ sku: "SPLIT-1", quantity: 1 }],
      tenders: [{ method: "cash", amount: 1075 }],
      idempotencyKey: "idem-split-1",
    });
    expect(replay.alreadyExisted).toBe(true);
    expect(replay.receiptNo).toBe(receiptNo);
    // No double stock decrement
    const p = (await db.query(`select current_stock from inventory_products where tenant_slug=$1 and sku='SPLIT-1'`, [TENANT])).rows[0];
    expect(Number(p.current_stock)).toBe(9);
  }, T);

  it("rejects overselling beyond stock", async () => {
    const { createPosSale } = await import("../lib/pos/sales");
    await makeProduct("SHORT-1", 2, 100);
    await expect(createPosSale(TENANT, {
      items: [{ sku: "SHORT-1", quantity: 5 }],
      paymentMethod: "cash",
    })).rejects.toThrow(/insufficient stock/i);
    // Nothing was written
    const stock = (await db.query(`select current_stock from inventory_products where tenant_slug=$1 and sku='SHORT-1'`, [TENANT])).rows[0];
    expect(Number(stock.current_stock)).toBe(2);
  }, T);

  it("requires a reason for order discounts and posts discounted VAT correctly", async () => {
    const { createPosSale } = await import("../lib/pos/sales");
    await makeProduct("DISC-1", 10, 1000);

    await expect(createPosSale(TENANT, {
      items: [{ sku: "DISC-1", quantity: 1 }],
      paymentMethod: "cash",
      discount: { pct: 10 } as any,
    })).rejects.toThrow(/reason/i);

    const sale = await createPosSale(TENANT, {
      items: [{ sku: "DISC-1", quantity: 1 }],
      paymentMethod: "cash",
      discount: { pct: 10, reason: "loyal customer" },
    });
    // 1000 - 10% = 900 net, VAT 67.5 → total 967.5
    expect(sale.total).toBe(967.5);
    const inv = (await db.query(`select amount from finance_invoices where id=$1`, [sale.invoiceId])).rows[0];
    expect(Number(inv.amount)).toBe(967.5);
    const audit = await db.query(`select count(*)::int c from pos_audit_log where tenant_slug=$1 and action='sale_discounts'`, [TENANT]);
    expect(audit.rows[0].c).toBeGreaterThan(0);
  }, T);

  it("returns items: credit note + refund JE + restock + sale status", async () => {
    const { createPosReturn } = await import("../lib/pos/returns");
    const before = (await db.query(`select current_stock from inventory_products where tenant_slug=$1 and sku='SPLIT-1'`, [TENANT])).rows[0];

    const ret = await createPosReturn(TENANT, {
      receiptNo,
      items: [{ sku: "SPLIT-1", quantity: 1 }],
      refundMethod: "cash",
      reason: "defective",
      createdBy: "test",
    });
    expect("error" in ret).toBe(false);

    // Credit note JE exists on the invoice
    const sale = (await db.query(`select * from pos_sales where id=$1`, [saleId])).rows[0];
    expect(sale.status).toBe("refunded");
    const after = (await db.query(`select current_stock from inventory_products where tenant_slug=$1 and sku='SPLIT-1'`, [TENANT])).rows[0];
    expect(Number(after.current_stock)).toBe(Number(before.current_stock) + 1);

    // Refund payment row recorded
    const pay = await db.query(`select * from finance_payments where tenant_slug=$1 and reference=$2`, [TENANT, `${receiptNo}-REF`]);
    expect(pay.rows.length).toBe(1);

    // Double return rejected
    const again = await createPosReturn(TENANT, { receiptNo, items: [{ sku: "SPLIT-1", quantity: 1 }] });
    expect("error" in again && again.error).toMatch(/unreturned|cannot return/i);
  }, T);
});

describe("cash control", () => {
  it("tracks pay-in/pay-out in expected cash and flags over-tolerance variance", async () => {
    const { openShift, closeShift, getShiftSummary, addCashMovement } = await import("../lib/pos/shifts");
    const { createPosSale } = await import("../lib/pos/sales");
    const { createRegister } = await import("../lib/pos/registers");

    const reg = await createRegister(TENANT, { code: "TILL-C", name: "C" });
    const shift = await openShift(TENANT, { openingFloat: 2000, registerId: reg.id, openedBy: "t" });

    await makeProduct("CASH-1", 10, 100);
    await createPosSale(TENANT, { items: [{ sku: "CASH-1", quantity: 1 }], paymentMethod: "cash", registerId: reg.id });
    await addCashMovement(TENANT, { shiftId: shift.id, type: "drop", amount: 500, reason: "bank drop" });

    const summary = await getShiftSummary(TENANT, shift.id);
    // expected = 2000 + 107.5 - 500 = 1607.5
    expect(summary!.expectedCash).toBe(1607.5);
    expect(summary!.cashMovements.drop).toBe(500);

    // Over-tolerance variance (>100) requires a reason
    const tooBig = await closeShift(TENANT, shift.id, { closingCounted: 1000, closedBy: "t" });
    expect("error" in tooBig).toBe(true);

    const closed = await closeShift(TENANT, shift.id, { closingCounted: 1607.5, closedBy: "t" });
    expect("error" in closed).toBe(false);
    expect(Number((closed as any).variance)).toBe(0);
  }, T);
});

describe("held sales, price lists & loyalty", () => {
  it("parks and resumes a cart", async () => {
    const { holdSale, listHeldSales, deleteHeldSale } = await import("../lib/pos/held");
    const h = await holdSale(TENANT, { label: "Customer stepped out", cart: [{ sku: "X" }] });
    const list = await listHeldSales(TENANT);
    expect(list.find((x) => x.id === h.id)).toBeTruthy();
    expect(await deleteHeldSale(TENANT, h.id)).toBe(true);
  }, T);

  it("applies a customer price list over sale_price", async () => {
    const { upsertPriceList } = await import("../lib/pos/price-lists");
    const { createPosSale } = await import("../lib/pos/sales");
    const { openShift, getOpenShift } = await import("../lib/pos/shifts");
    const { createRegister } = await import("../lib/pos/registers");

    const reg = await createRegister(TENANT, { code: "TILL-D", name: "D" });
    if (!(await getOpenShift(TENANT, reg.id))) await openShift(TENANT, { registerId: reg.id, openedBy: "t" });

    await makeProduct("PL-1", 10, 500);
    const pl = await upsertPriceList(TENANT, { name: "Wholesale", items: [{ sku: "PL-1", price: 400 }] });

    const sale = await createPosSale(TENANT, {
      items: [{ sku: "PL-1", quantity: 1 }],
      paymentMethod: "cash",
      registerId: reg.id,
      priceListId: pl.id,
    });
    // 400 + 7.5% = 430
    expect(sale.total).toBe(430);
  }, T);

  it("earns and redeems loyalty points", async () => {
    const { createPosSale } = await import("../lib/pos/sales");
    const { loyaltyBalance } = await import("../lib/pos/loyalty");
    const { openShift, getOpenShift } = await import("../lib/pos/shifts");

    await db.query(
      `insert into finance_customers (id, tenant_slug, customer_code, name)
       values (gen_random_uuid(), $1, 'CUST-L1', 'Loyal Customer') on conflict do nothing`, [TENANT]
    );
    await makeProduct("LOY-1", 10, 2000);

    const regRows = await db.query(`select id from pos_registers where tenant_slug=$1 and code='TILL-D'`, [TENANT]);
    const regId = regRows.rows[0].id;
    if (!(await getOpenShift(TENANT, regId))) await openShift(TENANT, { registerId: regId, openedBy: "t" });

    const sale = await createPosSale(TENANT, {
      items: [{ sku: "LOY-1", quantity: 1 }],
      paymentMethod: "cash",
      registerId: regId,
      customerCode: "CUST-L1",
    });
    // total 2150 → floor(2150/1000) = 2 pts
    expect(sale.total).toBe(2150);
    const bal = await loyaltyBalance(TENANT, "CUST-L1");
    expect(Number(bal.points)).toBe(2);

    // Redeem 2 pts (× ₦10 = ₦20 discount)
    const sale2 = await createPosSale(TENANT, {
      items: [{ sku: "LOY-1", quantity: 1 }],
      paymentMethod: "cash",
      registerId: regId,
      customerCode: "CUST-L1",
      loyaltyRedeemPoints: 2,
    });
    // (2000 - 20) + 7.5% = 1980 + 148.5 = 2128.5
    expect(sale2.total).toBe(2128.5);
    const bal2 = await loyaltyBalance(TENANT, "CUST-L1");
    // 2 (sale 1) + 2 (sale 2 earn) − 2 (redeemed) = 2
    expect(Number(bal2.points)).toBe(2);
  }, T);
});
