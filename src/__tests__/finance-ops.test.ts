import { describe, it, expect, beforeAll, afterAll } from "vitest";
import process from "node:process";

const T = 120000;
const TENANT = `test-finops-${Date.now()}`;
const TENANT_B = `test-finops-b-${Date.now()}`;
const TENANT_C = `test-consol-c-${Date.now()}`;
const TENANT_D = `test-consol-d-${Date.now()}`;
let db: any;

async function cleanup() {
  for (const slug of [TENANT, TENANT_B, TENANT_C, TENANT_D]) {
    await db.query(`delete from finance_returns where tenant_slug = $1`, [slug]);
    await db.query(`delete from recurring_invoices where tenant_slug = $1`, [slug]);
    await db.query(`delete from landed_cost_vouchers where tenant_slug = $1`, [slug]);
    await db.query(`delete from tax_transactions where tenant_slug = $1`, [slug]);
    await db.query(`delete from stock_movements where tenant_slug = $1`, [slug]);
    await db.query(`delete from inventory_products where tenant_slug = $1`, [slug]);
    await db.query(`delete from finance_invoice_lines where invoice_id in (select id from finance_invoices where tenant_slug = $1)`, [slug]);
    await db.query(`delete from finance_invoices where tenant_slug = $1`, [slug]);
    await db.query(`delete from bills where tenant_slug = $1`, [slug]);
    await db.query(`delete from journal_entry_lines where journal_entry_id in (select id from journal_entries where tenant_slug = $1)`, [slug]);
    await db.query(`delete from journal_entries where tenant_slug = $1`, [slug]);
    await db.query(`delete from chart_of_accounts where tenant_slug = $1`, [slug]);
    await db.query(`update tenants set consolidation_group = null where slug = $1`, [slug]);
    await db.query(`delete from tenants where slug = $1`, [slug]);
  }
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  db = (await import("../lib/sql-client")).db;
  await cleanup();
  for (const [slug, name] of [
    [TENANT, "FinOps A"], [TENANT_B, "FinOps B"],
    [TENANT_C, "Consol C"], [TENANT_D, "Consol D"],
  ] as const) {
    await db.query(
      `insert into tenants (name, slug, settings, seats)
       values ($1, $2, '{"currency":"NGN"}'::jsonb, 1)
       on conflict (slug) do nothing`,
      [name, slug]
    );
  }
}, T);

afterAll(async () => {
  if (db) await cleanup();
}, T);

async function makeInvoice(overrides: any = {}) {
  const { insertFinanceInvoice } = await import("../lib/finance/db");
  return insertFinanceInvoice({
    tenantSlug: TENANT, customerName: "Return Co", customerCode: "C-RET",
    invoiceNumber: `INV-R-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    issuedDate: "2026-11-01", dueDate: "2026-11-30", currency: "NGN", status: "sent",
    lineItems: [{ description: "Goods", quantity: 2, unitPrice: 1000, amount: 2000, taxRate: 7.5 }],
    amount: 2150, balanceDue: 2150,
    ...overrides,
  } as any);
}

describe("sales returns (credit notes)", () => {
  it("posts a reversing JE, reduces invoice balance, and records negative VAT", async () => {
    if (!process.env.DATABASE_URL) return;
    const { createSalesReturn, listReturns } = await import("../lib/finance/returns");
    const invoice = await makeInvoice();

    const ret = await createSalesReturn(TENANT, {
      invoiceId: invoice.id,
      items: [{ description: "Goods", quantity: 1, unitPrice: 1000, taxRate: 7.5 }],
      reason: "damaged",
    });
    expect(ret.documentNo).toMatch(/^CN-/);
    expect(ret.netAmount).toBe(1000);
    expect(ret.taxAmount).toBe(75);
    expect(ret.totalAmount).toBe(1075);

    const inv = (await db.query(
      `select balance_due from finance_invoices where id = $1`, [invoice.id]
    )).rows[0];
    expect(Number(inv.balance_due)).toBe(1075); // 2150 − 1075

    // JE: 4900 Dr 1000, 2205 Dr 75, 1200 Cr 1075
    const lines = (await db.query(
      `select jel.account_code, jel.debit_amount, jel.credit_amount
       from journal_entry_lines jel
       join journal_entries je on je.id = jel.journal_entry_id or je.id = jel.entry_id
       where je.tenant_slug = $1 and je.reference_id = $2 and je.reference_type = 'sales_return'`,
      [TENANT, invoice.id]
    )).rows;
    const byCode = Object.fromEntries(lines.map((l: any) => [l.account_code, l]));
    expect(Number(byCode["4900"].debit_amount)).toBe(1000);
    expect(Number(byCode["2205"].debit_amount)).toBe(75);
    expect(Number(byCode["1200"].credit_amount)).toBe(1075);

    const tx = (await db.query(
      `select tax_amount from tax_transactions
       where tenant_slug = $1 and transaction_type = 'vat_output' and tax_amount < 0`,
      [TENANT]
    )).rows;
    expect(Number(tx[0].tax_amount)).toBe(-75);

    const list = await listReturns(TENANT, { direction: "sales" });
    expect(list.some((r: any) => r.id === ret.id)).toBe(true);
  }, T);
});

describe("purchase returns (debit notes)", () => {
  it("posts a reversing JE against the bill", async () => {
    if (!process.env.DATABASE_URL) return;
    const { createBill } = await import("../lib/finance/bills");
    const { createPurchaseReturn } = await import("../lib/finance/returns");
    const { randomUUID } = await import("node:crypto");

    const bill = await createBill({
      tenantSlug: TENANT,
      vendorId: randomUUID(),
      billDate: "2026-11-01",
      dueDate: "2026-11-30",
      items: [{ description: "Stock", quantity: 4, unitPrice: 500, accountCode: "1500", taxRate: 7.5 }],
    } as any);

    const ret = await createPurchaseReturn(TENANT, {
      billId: bill.id,
      items: [{ description: "Stock", sku: "X", quantity: 1, unitPrice: 500, taxRate: 7.5 }],
      reason: "defective",
    });
    expect(ret.documentNo).toMatch(/^DN-/);
    expect(ret.totalAmount).toBe(537.5);

    const b = (await db.query(`select balance_due from bills where id = $1`, [bill.id])).rows[0];
    expect(Number(b.balance_due)).toBe(Number(bill.balanceDue ?? bill.total) - 537.5);

    const lines = (await db.query(
      `select jel.account_code, jel.debit_amount, jel.credit_amount
       from journal_entry_lines jel
       join journal_entries je on je.id = jel.journal_entry_id or je.id = jel.entry_id
       where je.tenant_slug = $1 and je.reference_id = $2 and je.reference_type = 'purchase_return'`,
      [TENANT, bill.id]
    )).rows;
    const byCode = Object.fromEntries(lines.map((l: any) => [l.account_code, l]));
    expect(Number(byCode["2100"].debit_amount)).toBe(537.5);
    expect(Number(byCode["2200"].credit_amount)).toBe(37.5);
  }, T);
});

describe("landed cost", () => {
  it("allocates freight by value, updates unit cost, and capitalizes to inventory", async () => {
    if (!process.env.DATABASE_URL) return;
    const { createLandedCostVoucher } = await import("../lib/inventory/landed-cost");
    await db.query(
      `insert into inventory_products (id, tenant_slug, name, sku, category, current_stock, unit_cost)
       values ('lc-p1', $1, 'Item A', 'LC-A', 'goods', 10, 100),
              ('lc-p2', $1, 'Item B', 'LC-B', 'goods', 10, 300)`,
      [TENANT]
    );

    const v = await createLandedCostVoucher(TENANT, {
      referenceId: "GRN-001",
      chargeType: "freight",
      totalAmount: 800,
      items: [
        { sku: "LC-A", quantity: 10, unitCost: 100 },  // value 1000 → 200
        { sku: "LC-B", quantity: 10, unitCost: 300 },  // value 3000 → 600
      ],
    });
    expect(v.allocations.find((a) => a.sku === "LC-A")!.amount).toBe(200);
    expect(v.allocations.find((a) => a.sku === "LC-B")!.amount).toBe(600);

    const pa = (await db.query(
      `select unit_cost from inventory_products where tenant_slug = $1 and sku = 'LC-A'`, [TENANT]
    )).rows[0];
    expect(Number(pa.unit_cost)).toBe(120); // 100 + 200/10

    const lines = (await db.query(
      `select jel.account_code, jel.debit_amount, jel.credit_amount
       from journal_entry_lines jel
       join journal_entries je on je.id = jel.journal_entry_id or je.id = jel.entry_id
       where je.tenant_slug = $1 and je.reference_type = 'landed_cost'`,
      [TENANT]
    )).rows;
    const byCode = Object.fromEntries(lines.map((l: any) => [l.account_code, l]));
    expect(Number(byCode["1500"].debit_amount)).toBe(800);
    expect(Number(byCode["2100"].credit_amount)).toBe(800);
  }, T);

  it("rejects manual allocations that don't sum to the total", async () => {
    if (!process.env.DATABASE_URL) return;
    const { createLandedCostVoucher } = await import("../lib/inventory/landed-cost");
    await expect(
      createLandedCostVoucher(TENANT, {
        referenceId: "GRN-002", chargeType: "customs_duty", totalAmount: 500,
        allocationMethod: "manual",
        items: [{ sku: "LC-A", quantity: 1, unitCost: 10, allocatedAmount: 100 }],
      })
    ).rejects.toThrow(/must sum/);
  }, T);
});

describe("recurring invoices", () => {
  it("generates due invoices and advances the schedule", async () => {
    if (!process.env.DATABASE_URL) return;
    const { createRecurringTemplate, generateDueInvoices, getRecurringTemplate } =
      await import("../lib/finance/recurring");

    const tpl = await createRecurringTemplate(TENANT, {
      customerName: "Retainer Client",
      frequency: "monthly",
      startDate: "2026-09-01",
      endDate: "2026-11-30",
      template: {
        lineItems: [{ description: "Monthly retainer", quantity: 1, unitPrice: 50000, taxRate: 7.5 }],
        currency: "NGN",
      },
    });

    const { generated } = await generateDueInvoices(TENANT, "2026-11-15");
    expect(generated).toHaveLength(3); // Sep, Oct, Nov
    const t2 = await getRecurringTemplate(TENANT, tpl.id);
    expect(t2.status).toBe("completed"); // next run 2026-12-01 > end 2026-11-30

    const invs = (await db.query(
      `select count(*)::int as n, sum(amount)::numeric as total from finance_invoices where tenant_slug = $1`,
      [TENANT]
    )).rows[0];
    expect(invs.n).toBeGreaterThanOrEqual(3);
  }, T);
});

describe("consolidation", () => {
  it("consolidates a trial balance across group entities", async () => {
    if (!process.env.DATABASE_URL) return;
    const { setConsolidationGroup, consolidatedTrialBalance } =
      await import("../lib/finance/consolidation");
    const { postGLEntry } = await import("../lib/finance/gl");

    const group = `test-group-${Date.now()}`;
    await setConsolidationGroup(TENANT_C, group);
    await setConsolidationGroup(TENANT_D, group);

    // Entity C: Dr cash 1000 / Cr revenue 1000; Entity D: Dr cash 500 / Cr revenue 500
    for (const [slug, amt] of [[TENANT_C, 1000], [TENANT_D, 500]] as const) {
      await postGLEntry({
        tenantSlug: slug,
        entryDate: "2026-11-10",
        description: "consolidation test",
        lines: [
          { accountCode: "1110", debitAmount: amt, creditAmount: 0 },
          { accountCode: "4000", debitAmount: 0, creditAmount: amt },
        ],
      });
    }

    const tb = await consolidatedTrialBalance(TENANT_C, { asOf: "2026-12-31" });
    expect(tb.entities.sort()).toEqual([TENANT_C, TENANT_D].sort());
    const cash = tb.lines.find((l) => l.accountCode === "1110");
    const rev = tb.lines.find((l) => l.accountCode === "4000");
    expect(cash!.debit).toBe(1500);
    expect(rev!.credit).toBe(1500);
    expect(cash!.byEntity).toHaveLength(2);
  }, T);
});
