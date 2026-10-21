import { describe, it, expect, beforeAll, afterAll } from "vitest";
import process from "node:process";

const T = 120000;
const TENANT = `test-serial-${Date.now()}`;
let db: any;
let recordStockMovement: any;
let transferStock: any;
let createWarehouse: any;
let lotTracking: any;
let submitEInvoice: any;
let getEInvoiceStatus: any;
let insertFinanceInvoice: any;

const SKU_SERIAL = `SER-${Date.now()}`;
const SKU_BATCH = `BAT-${Date.now()}`;

async function cleanup() {
  await db.query(`delete from einvoice_submissions where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from tax_transactions where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from inventory_serials where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from inventory_lot_stock where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from stock_movements where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from inventory_stock_balances where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from inventory_warehouses where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from inventory_products where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from finance_invoice_lines where invoice_id in (select id from finance_invoices where tenant_slug = $1)`, [TENANT]);
  await db.query(`delete from finance_invoices where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from journal_entry_lines where journal_entry_id in (select id from journal_entries where tenant_slug = $1)`, [TENANT]);
  await db.query(`delete from journal_entries where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from chart_of_accounts where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from tenants where slug = $1`, [TENANT]);
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  db = (await import("../lib/sql-client")).db;
  ({ recordStockMovement } = await import("../lib/inventory/stock-movements"));
  ({ transferStock, createWarehouse } = await import("../lib/inventory/warehouses"));
  lotTracking = await import("../lib/inventory/lot-tracking");
  ({ submitEInvoice, getEInvoiceStatus } = await import("../lib/finance/einvoice-submission"));
  ({ insertFinanceInvoice } = await import("../lib/finance/db"));

  await cleanup();
  await db.query(
    `insert into tenants (name, slug, settings, seats)
     values ($1, $2, '{"currency":"NGN"}'::jsonb, 1)
     on conflict (slug) do nothing`,
    ["Serial Test Tenant", TENANT]
  );
  await db.query(
    `insert into inventory_products (id, tenant_slug, name, sku, category, tracking, current_stock)
     values ($1, $2, 'Serial Widget', $3, 'hardware', 'serial', 0)`,
    [`p-ser-${Date.now()}`, TENANT, SKU_SERIAL]
  );
  await db.query(
    `insert into inventory_products (id, tenant_slug, name, sku, category, tracking, current_stock)
     values ($1, $2, 'Batch Chemical', $3, 'chemicals', 'batch', 0)`,
    [`p-bat-${Date.now()}`, TENANT, SKU_BATCH]
  );
}, T);

afterAll(async () => {
  if (db) await cleanup();
}, T);

describe("serial tracking", () => {
  it("rejects a serial-tracked receipt without serial numbers", async () => {
    if (!process.env.DATABASE_URL) return;
    await expect(
      recordStockMovement(TENANT, {
        productSku: SKU_SERIAL,
        productName: "Serial Widget",
        movementType: "purchase_receipt",
        quantity: 3,
        unitCost: 100,
        referenceType: "test",
        referenceId: "t1",
      }, { skipJournalEntry: true })
    ).rejects.toThrow(/serial number/i);
  }, T);

  it("rejects mismatched serial count", async () => {
    if (!process.env.DATABASE_URL) return;
    await expect(
      recordStockMovement(TENANT, {
        productSku: SKU_SERIAL,
        productName: "Serial Widget",
        movementType: "purchase_receipt",
        quantity: 3,
        unitCost: 100,
        referenceType: "test",
        referenceId: "t1",
        serialNos: ["SN-1", "SN-2"],
      }, { skipJournalEntry: true })
    ).rejects.toThrow(/require exactly 3/);
  }, T);

  it("receives serials and lists them in stock", async () => {
    if (!process.env.DATABASE_URL) return;
    await recordStockMovement(TENANT, {
      productSku: SKU_SERIAL,
      productName: "Serial Widget",
      movementType: "purchase_receipt",
      quantity: 3,
      unitCost: 100,
      referenceType: "test",
      referenceId: "t1",
      serialNos: ["SN-1", "SN-2", "SN-3"],
    }, { skipJournalEntry: true });

    const serials = await lotTracking.listSerials(TENANT, { sku: SKU_SERIAL, status: "in_stock" });
    expect(serials.map((s: any) => s.serialNo).sort()).toEqual(["SN-1", "SN-2", "SN-3"]);
  }, T);

  it("rejects duplicate in-stock serials on re-receipt", async () => {
    if (!process.env.DATABASE_URL) return;
    await expect(
      recordStockMovement(TENANT, {
        productSku: SKU_SERIAL,
        productName: "Serial Widget",
        movementType: "purchase_receipt",
        quantity: 1,
        unitCost: 100,
        referenceType: "test",
        referenceId: "t2",
        serialNos: ["SN-1"],
      }, { skipJournalEntry: true })
    ).rejects.toThrow(/already in stock/);
  }, T);

  it("issues serials and marks them issued", async () => {
    if (!process.env.DATABASE_URL) return;
    await recordStockMovement(TENANT, {
      productSku: SKU_SERIAL,
      productName: "Serial Widget",
      movementType: "sale",
      quantity: 1,
      unitCost: 100,
      referenceType: "test",
      referenceId: "sale1",
      serialNos: ["SN-1"],
    }, { skipJournalEntry: true });

    const trace = await lotTracking.traceSerial(TENANT, SKU_SERIAL, "SN-1");
    expect(trace.serial.status).toBe("issued");
    expect(trace.movements.length).toBe(2);
  }, T);

  it("rejects issuing an already-issued serial", async () => {
    if (!process.env.DATABASE_URL) return;
    await expect(
      recordStockMovement(TENANT, {
        productSku: SKU_SERIAL,
        productName: "Serial Widget",
        movementType: "sale",
        quantity: 1,
        unitCost: 100,
        referenceType: "test",
        referenceId: "sale2",
        serialNos: ["SN-1"],
      }, { skipJournalEntry: true })
    ).rejects.toThrow(/not available|Unknown serial/);
  }, T);
});

describe("batch tracking", () => {
  it("rejects batch movements without a lot number", async () => {
    if (!process.env.DATABASE_URL) return;
    await expect(
      recordStockMovement(TENANT, {
        productSku: SKU_BATCH,
        productName: "Batch Chemical",
        movementType: "purchase_receipt",
        quantity: 50,
        unitCost: 10,
        referenceType: "test",
        referenceId: "b1",
      }, { skipJournalEntry: true })
    ).rejects.toThrow(/lot\/batch number/);
  }, T);

  it("tracks lot stock with expiry", async () => {
    if (!process.env.DATABASE_URL) return;
    const wh = await createWarehouse(TENANT, { name: "Batch WH", code: "BWH" });
    const expiry = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    await recordStockMovement(TENANT, {
      productSku: SKU_BATCH,
      productName: "Batch Chemical",
      movementType: "purchase_receipt",
      quantity: 50,
      unitCost: 10,
      referenceType: "test",
      referenceId: "b1",
      warehouseId: wh.id,
      lotNo: "LOT-A",
      expiryDate: expiry,
    }, { skipJournalEntry: true });

    const lots = await lotTracking.lotStock(TENANT, { sku: SKU_BATCH });
    expect(lots).toHaveLength(1);
    expect(lots[0].lotNo).toBe("LOT-A");
    expect(lots[0].qtyOnHand).toBe(50);
    expect(lots[0].expiryDate).toBe(expiry);

    const expiring = await lotTracking.expiringLots(TENANT, 30);
    expect(expiring.some((l: any) => l.lotNo === "LOT-A")).toBe(true);
  }, T);

  it("decrements lot stock on issue and rejects over-issue", async () => {
    if (!process.env.DATABASE_URL) return;
    const wh = (await lotTracking.lotStock(TENANT, { sku: SKU_BATCH }))[0];
    await recordStockMovement(TENANT, {
      productSku: SKU_BATCH,
      productName: "Batch Chemical",
      movementType: "work_order_issue",
      quantity: 20,
      unitCost: 10,
      referenceType: "test",
      referenceId: "b2",
      warehouseId: wh.warehouseId,
      lotNo: "LOT-A",
    }, { skipJournalEntry: true });

    const lots = await lotTracking.lotStock(TENANT, { sku: SKU_BATCH });
    expect(lots[0].qtyOnHand).toBe(30);

    await expect(
      recordStockMovement(TENANT, {
        productSku: SKU_BATCH,
        productName: "Batch Chemical",
        movementType: "work_order_issue",
        quantity: 40,
        unitCost: 10,
        referenceType: "test",
        referenceId: "b3",
        warehouseId: wh.warehouseId,
        lotNo: "LOT-A",
      }, { skipJournalEntry: true })
    ).rejects.toThrow(/Insufficient stock in lot/);
  }, T);
});

describe("serial transfer", () => {
  it("relocates serials between warehouses", async () => {
    if (!process.env.DATABASE_URL) return;
    const from = await createWarehouse(TENANT, { name: "From WH", code: "FWH" });
    const to = await createWarehouse(TENANT, { name: "To WH", code: "TWH" });

    // Receive SN-4 directly at the source warehouse so both the serial and
    // the per-warehouse balance exist.
    await recordStockMovement(TENANT, {
      productSku: SKU_SERIAL,
      productName: "Serial Widget",
      movementType: "purchase_receipt",
      quantity: 1,
      unitCost: 100,
      referenceType: "test",
      referenceId: "t3",
      warehouseId: from.id,
      serialNos: ["SN-4"],
    }, { skipJournalEntry: true });

    await transferStock({
      tenantSlug: TENANT,
      productSku: SKU_SERIAL,
      productName: "Serial Widget",
      quantity: 1,
      fromWarehouseId: from.id,
      toWarehouseId: to.id,
      serialNos: ["SN-4"],
    });

    const trace = await lotTracking.traceSerial(TENANT, SKU_SERIAL, "SN-4");
    expect(trace.serial.warehouseId).toBe(to.id);
    expect(trace.serial.status).toBe("in_stock");
  }, T);
});

describe("e-invoice submission", () => {
  it("submits to the sandbox provider and records IRN", async () => {
    if (!process.env.DATABASE_URL) return;
    const invoice = await insertFinanceInvoice({
      tenantSlug: TENANT, customerName: "E-Invoice Customer", customerCode: "C-EI",
      invoiceNumber: `INV-EI-${Date.now()}`, issuedDate: "2026-11-01", dueDate: "2026-11-30",
      currency: "NGN", status: "sent",
      lineItems: [{ description: "Consulting", quantity: 2, unitPrice: 50000, amount: 100000 }],
      amount: 100000, balanceDue: 100000,
    } as any);

    const sub = await submitEInvoice(TENANT, invoice.id, { submittedBy: "tester" });
    expect(sub.status).toBe("accepted");
    expect(sub.irn).toContain(invoice.invoiceNumber ?? "SYSERP");

    const status = await getEInvoiceStatus(TENANT, invoice.id);
    expect(status.status).toBe("accepted");
    expect(status.response.raw?.csid ?? status.response.reference).toBeTruthy();

    // idempotent: second submit returns the accepted submission
    const again = await submitEInvoice(TENANT, invoice.id, {});
    expect(again.id).toBe(sub.id);
  }, T);
});
