import { describe, it, expect, beforeAll, afterAll } from "vitest";
import process from "node:process";

const T = 240000;
const TENANT = `test-erpdepth-${Date.now()}`;
let db: any;

async function cleanup() {
  for (const [table, col] of [
    ["asset_depreciation_schedule", "tenant_slug"],
    ["fixed_assets", "tenant_slug"],
    ["fx_revaluations", "tenant_slug"],
    ["pos_promotions", "tenant_slug"],
    ["subcontract_materials", "tenant_slug"],
    ["subcontract_orders", "tenant_slug"],
    ["production_runs", "tenant_slug"],
    ["dunning_notices", "tenant_slug"],
    ["stock_movements", "tenant_slug"],
    ["work_order_materials", null],
    ["work_order_operations", null],
    ["work_orders", "tenant_slug"],
    ["exchange_rates", "tenant_slug"],
    ["inventory_products", "tenant_slug"],
    ["finance_customers", "tenant_slug"],
  ] as Array<[string, string | null]>) {
    try {
      if (col) {
        await db.query(`delete from ${table} where ${col} = $1`, [TENANT]);
      } else {
        await db.query(
          `delete from ${table} where work_order_id in (select id from work_orders where tenant_slug = $1)`,
          [TENANT]
        );
      }
    } catch { /* table may not exist yet */ }
  }
  await db.query(`delete from finance_invoice_lines where invoice_id in (select id from finance_invoices where tenant_slug = $1)`, [TENANT]).catch(() => {});
  await db.query(`delete from finance_invoices where tenant_slug = $1`, [TENANT]).catch(() => {});
  await db.query(`delete from journal_entry_lines where journal_entry_id in (select id from journal_entries where tenant_slug = $1)`, [TENANT]).catch(() => {});
  await db.query(`delete from journal_entry_lines where entry_id in (select id from journal_entries where tenant_slug = $1)`, [TENANT]).catch(() => {});
  await db.query(`delete from journal_entries where tenant_slug = $1`, [TENANT]).catch(() => {});
  await db.query(`delete from tenants where slug = $1`, [TENANT]).catch(() => {});
}

async function jeLinesFor(referenceId: string) {
  const rows = await db.query(
    `select l.*, coalesce(l.account_code, ca.code) as code
     from journal_entry_lines l
     join journal_entries e on e.id = coalesce(l.journal_entry_id, l.entry_id)
     left join chart_of_accounts ca on ca.id = l.account_id
     where e.tenant_slug = $1 and e.reference_id = $2`,
    [TENANT, referenceId]
  );
  return rows.rows ?? rows;
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  db = (await import("../lib/sql-client")).db;
  await cleanup();
  await db.query(
    `insert into tenants (name, slug, settings, seats)
     values ($1, $2, $3::jsonb, 1)
     on conflict (slug) do nothing`,
    ["ERP Depth", TENANT, JSON.stringify({
      currency: "NGN",
      creditControl: { dunningFees: { "1": 500, "2": 1000 }, autoHoldLevel: 2 },
    })]
  );
  const { ensureAssetTables } = await import("../lib/finance/fixed-assets");
  const { ensureRevaluationTables } = await import("../lib/finance/currency");
  const { ensurePromotionTables } = await import("../lib/pos/promotions");
  const { ensureSubcontractTables } = await import("../lib/manufacturing/subcontracting");
  const { ensureBatchTables } = await import("../lib/manufacturing/batches");
  const { ensureCreditTables } = await import("../lib/finance/credit-control");
  await ensureAssetTables(); await ensureRevaluationTables();
  await ensurePromotionTables(); await ensureSubcontractTables();
  await ensureBatchTables(); await ensureCreditTables();
}, T);

afterAll(async () => {
  if (db) await cleanup();
}, T);

describe("fixed assets", () => {
  let assetId: string;

  it("creates an asset with a full straight-line schedule", async () => {
    const { createAsset, getAssetSchedule } = await import("../lib/finance/fixed-assets");
    const out = await createAsset({
      tenantSlug: TENANT, name: "Delivery Van", acquisitionDate: "2026-01-01",
      cost: 1200000, salvageValue: 0, usefulLifeMonths: 12, method: "straight_line",
    });
    assetId = out.id;
    expect(out.assetNo).toMatch(/^FA-/);
    const sched = await getAssetSchedule(TENANT, assetId);
    expect(sched).toHaveLength(12);
    expect(Number(sched[0].amount)).toBe(100000);
    expect(sched.reduce((s: number, r: any) => s + Number(r.amount), 0)).toBeCloseTo(1200000, 1);
  }, T);

  it("posts depreciation JEs for due periods and updates NBV", async () => {
    const { runDepreciation, listAssets } = await import("../lib/finance/fixed-assets");
    const out = await runDepreciation({ tenantSlug: TENANT, asOf: "2026-03-31" });
    expect(out.posted).toHaveLength(3);
    const lines = await jeLinesFor(assetId);
    const dep = lines.filter((l: any) => l.code === "6400");
    expect(dep.length).toBe(3);
    expect(dep.reduce((s: number, l: any) => s + Number(l.debit ?? l.debit_amount), 0)).toBeCloseTo(300000, 1);
    const asset = (await listAssets(TENANT)).find((a: any) => a.id === assetId);
    expect(Number(asset.net_book_value)).toBeCloseTo(900000, 1);
  }, T);

  it("is idempotent — re-running posts nothing new", async () => {
    const { runDepreciation } = await import("../lib/finance/fixed-assets");
    const out = await runDepreciation({ tenantSlug: TENANT, asOf: "2026-03-31" });
    expect(out.posted).toHaveLength(0);
  }, T);

  it("disposes at a gain and derecognizes cost + accum dep", async () => {
    const { disposeAsset, listAssets } = await import("../lib/finance/fixed-assets");
    const out = await disposeAsset({
      tenantSlug: TENANT, assetId, disposalDate: "2026-04-15",
      method: "sale", proceeds: 1000000,
    });
    expect(out.gainLoss).toBeCloseTo(100000, 1); // 1,000,000 − NBV 900,000
    const lines = await jeLinesFor(assetId);
    const codes = lines.map((l: any) => `${l.code}:${Number(l.debit ?? l.debit_amount) > 0 ? "dr" : "cr"}`);
    expect(codes).toContain("1100:dr"); // proceeds to bank
    expect(codes).toContain("1700:dr"); // accum dep removed
    expect(codes).toContain("1600:cr"); // cost derecognized
    expect(codes).toContain("7600:cr"); // gain
    const asset = (await listAssets(TENANT)).find((a: any) => a.id === assetId);
    expect(asset.status).toBe("disposed");
  }, T);
});

describe("FX revaluation", () => {
  const asOf = "2026-03-31";
  let invoiceId: string;
  let revalId: string;

  it("revalues open foreign AR and posts unrealized gain", async () => {
    const { insertFinanceInvoice } = await import("../lib/finance/db");
    const { upsertExchangeRate, revalueOpenBalances } = await import("../lib/finance/currency");

    // $1,000 invoice booked when rate was 1500 NGN/USD → ₦1,500,000 AR.
    const inv = await insertFinanceInvoice({
      tenantSlug: TENANT, customerName: "FX Customer",
      invoiceNumber: `FX-${Date.now()}`, issuedDate: "2026-02-01", dueDate: "2026-12-31",
      currency: "NGN", status: "sent",
      lineItems: [{ description: "Export sale", quantity: 1, unitPrice: 1500000, amount: 1500000, accountCode: "4000" }],
      amount: 1500000, balanceDue: 1500000,
    } as any);
    invoiceId = inv.id;
    // Rate convention: foreign units per base unit — $1,000 / ₦1,500,000.
    await db.query(
      `update finance_invoices set transaction_currency = 'USD', exchange_rate = $2 where id = $1`,
      [invoiceId, 1000 / 1500000]
    );
    // Closing rate strengthens NGN: ₦1,450/$ → revalued ₦1,450,000 → ₦50,000 loss.
    await upsertExchangeRate({ tenantSlug: TENANT, currency: "USD", rateDate: asOf, rate: 1000 / 1450000 });

    const out = await revalueOpenBalances({ tenantSlug: TENANT, asOf, direction: "ar" });
    expect(out.revaluations).toHaveLength(1);
    const rev = out.revaluations[0];
    revalId = rev.id;
    expect(rev.currency).toBe("USD");
    expect(rev.delta).toBeCloseTo(-50000, 0);

    const lines = await jeLinesFor(`ar-USD-${asOf}`);
    const loss = lines.find((l: any) => l.code === "7700");
    expect(Number(loss.debit ?? loss.debit_amount)).toBeCloseTo(50000, 0);
    const ar = lines.find((l: any) => l.code === "1200");
    expect(Number(ar.credit ?? ar.credit_amount)).toBeCloseTo(50000, 0);
  }, T);

  it("reverses the revaluation on demand", async () => {
    const { reverseRevaluation, listRevaluations } = await import("../lib/finance/currency");
    const out = await reverseRevaluation(TENANT, revalId, "2026-04-01");
    expect(out.reversed).toBe(true);
    const list = await listRevaluations(TENANT);
    expect(list.find((r: any) => r.id === revalId).status).toBe("reversed");
  }, T);
});

describe("POS promotions", () => {
  it("percent and bogo promos discount matching lines; expired promos don't apply", async () => {
    const { upsertPromotion, applyPromotions } = await import("../lib/pos/promotions");
    const now = new Date();
    const iso = (d: Date) => d.toISOString();

    await upsertPromotion(TENANT, {
      code: "PCT10", name: "10% off", type: "percent", percent: 10,
      activeFrom: iso(new Date(now.getTime() - 86400000)), activeTo: iso(new Date(now.getTime() + 86400000)),
    });
    await upsertPromotion(TENANT, {
      code: "BOGO", name: "Buy 2 get 1", type: "bogo", buyQty: 2, getQty: 1, skus: ["WIDGET"],
      activeFrom: iso(new Date(now.getTime() - 86400000)), activeTo: iso(new Date(now.getTime() + 86400000)),
    });
    await upsertPromotion(TENANT, {
      code: "OLD", name: "Expired", type: "percent", percent: 50,
      activeFrom: "2020-01-01T00:00:00Z", activeTo: "2020-12-31T00:00:00Z",
    });

    const lines = [
      { sku: "WIDGET", qty: 3, price: 100, discount: 0 },
      { sku: "GADGET", qty: 1, price: 200, discount: 0 },
    ];
    const applied = await applyPromotions(TENANT, lines);
    expect(applied).toContain("PCT10");
    expect(applied).toContain("BOGO");
    expect(applied).not.toContain("OLD");
    // WIDGET: 10% (30) + bogo 1 free (100) → capped at 300
    expect(lines[0].discount).toBe(130);
    // GADGET: 10% only
    expect(lines[1].discount).toBe(20);
  }, T);
});

describe("manufacturing subcontracting + batches", () => {
  beforeAll(async () => {
    if (!db) return;
    await db.query(
      `insert into inventory_products (id, tenant_slug, name, sku, category, current_stock, unit_cost, sale_price, tracking, created_at)
       values (gen_random_uuid()::text, $1, 'Raw steel', 'RAW-1', 'raw', 100, 500, 0, 'none', now()),
              (gen_random_uuid()::text, $1, 'Brackets', 'FG-1', 'fg', 0, 0, 2000, 'none', now())
       on conflict do nothing`,
      [TENANT]
    );
  });

  it("issues materials to subcontractor (stock+WIP) and receives FG at cost+fee", async () => {
    const { createSubcontractOrder, issueSubcontractMaterials, receiveSubcontractGoods } =
      await import("../lib/manufacturing/subcontracting");

    const order = await createSubcontractOrder({
      tenantSlug: TENANT, subcontractor: "FabCo", productSku: "FG-1", productName: "Brackets",
      quantity: 10, feePerUnit: 200,
      materials: [{ sku: "RAW-1", quantity: 20, unitCost: 500 }],
    });
    await issueSubcontractMaterials(TENANT, order.id);

    const raw = (await db.query(
      `select current_stock::float s from inventory_products where tenant_slug = $1 and sku = 'RAW-1'`, [TENANT]
    )).rows[0];
    expect(raw.s).toBe(80);

    const receipt = await receiveSubcontractGoods({ tenantSlug: TENANT, orderId: order.id });
    expect(receipt.materialsCost).toBe(10000);
    expect(receipt.fee).toBe(2000);
    expect(receipt.finishedGoodsValue).toBe(12000);

    const fg = (await db.query(
      `select current_stock::float s from inventory_products where tenant_slug = $1 and sku = 'FG-1'`, [TENANT]
    )).rows[0];
    expect(fg.s).toBe(10);

    // Receipt JE: Dr 1400 12000 / Cr 1300 10000 / Cr 2100 2000
    const lines = await jeLinesFor(order.id);
    const fgLine = lines.find((l: any) => l.code === "1400");
    expect(Number(fgLine.debit ?? fgLine.debit_amount)).toBeCloseTo(12000, 0);
    const apLine = lines.find((l: any) => l.code === "2100");
    expect(Number(apLine.credit ?? apLine.credit_amount)).toBeCloseTo(2000, 0);
  }, T);

  it("splits a production run into lot-numbered work orders", async () => {
    const { createBatchRun, listBatchRuns } = await import("../lib/manufacturing/batches");
    const out = await createBatchRun({
      tenantSlug: TENANT, productSku: "FG-1", productName: "Brackets",
      totalQuantity: 25, batchSize: 10,
    });
    expect(out.batchCount).toBe(3);
    expect(out.workOrders.map((w: any) => w.lotNo)).toEqual([
      `LOT-${out.runNumber}-01`, `LOT-${out.runNumber}-02`, `LOT-${out.runNumber}-03`,
    ]);
    expect(out.workOrders.map((w: any) => Number(w.quantity))).toEqual([10, 10, 5]);
    const runs = await listBatchRuns(TENANT);
    const run = runs.find((r: any) => r.id === out.runId);
    expect(run.status).toBe("open");
  }, T);
});

describe("dunning automation", () => {
  it("cycle issues the correct level, is idempotent, and applies credit hold", async () => {
    const { insertFinanceInvoice } = await import("../lib/finance/db");
    const { runDunningCycle, listDunningNotices } = await import("../lib/finance/credit-control");

    await db.query(
      `insert into finance_customers (id, tenant_slug, customer_code, name, credit_hold)
       values (gen_random_uuid(), $1, 'C-DUN', 'Dunning Corp', false)
       on conflict do nothing`,
      [TENANT]
    );

    // 20 days overdue → level 2 target → autoHoldLevel=2 puts customer on hold.
    const pastDue = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10);
    const inv = await insertFinanceInvoice({
      tenantSlug: TENANT, customerName: "Dunning Corp", customerCode: "C-DUN",
      invoiceNumber: `DUN-${Date.now()}`, issuedDate: "2026-01-01", dueDate: pastDue,
      currency: "NGN", status: "sent",
      lineItems: [{ description: "Overdue svc", quantity: 1, unitPrice: 50000, amount: 50000, accountCode: "4100" }],
      amount: 50000, balanceDue: 50000,
    } as any);
    await db.query(
      `update finance_invoices set status = 'overdue', due_date = $1 where id = $2`,
      [pastDue, inv.id]
    );

    const cycle1 = await runDunningCycle({ tenantSlug: TENANT });
    expect(cycle1.issued).toHaveLength(1);
    expect(cycle1.issued[0].level).toBe(1); // escalates one level per run

    // Second cycle escalates to level 2 → autoHoldLevel puts customer on hold.
    const cycle2 = await runDunningCycle({ tenantSlug: TENANT });
    expect(cycle2.issued).toHaveLength(1);
    expect(cycle2.issued[0].level).toBe(2);
    expect(cycle2.held).toContain("C-DUN");

    const held = (await db.query(
      `select credit_hold from finance_customers where tenant_slug = $1 and customer_code = 'C-DUN'`, [TENANT]
    )).rows[0];
    expect(held.credit_hold).toBe(true);

    // Re-run: at target level already → nothing new.
    const cycle3 = await runDunningCycle({ tenantSlug: TENANT });
    expect(cycle3.issued).toHaveLength(0);

    const notices = await listDunningNotices(TENANT, inv.id);
    expect(notices).toHaveLength(2);
    expect(Math.max(...notices.map((n: any) => Number(n.fee_amount)))).toBe(1000); // level-2 fee
  }, T);
});
