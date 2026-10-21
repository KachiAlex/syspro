import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../lib/sql-client";

const TENANT = `__depth_${Date.now()}__`;
const T = 300000;

async function cleanup() {
  for (const t of [
    "asset_capitalizations", "asset_value_adjustments", "asset_movements",
    "asset_maintenance", "asset_maintenance_teams",
    "asset_depreciation_schedule", "fixed_assets",
    "journal_entry_templates", "accounting_dimensions", "finance_settings",
    "sales_orders", "purchase_order_items", "purchase_orders",
    "journal_entry_lines", "journal_entries",
    "chart_of_accounts", "fiscal_periods",
  ]) {
    await db.query(`delete from ${t} where tenant_slug = $1`, [TENANT]).catch(() => undefined);
  }
}
beforeAll(cleanup, 120000);
afterAll(cleanup, 120000);

describe.skipIf(!process.env.DATABASE_URL)("accounting depth: finance book + dimensions + settings + templates + assets", () => {
  it("posts to a named finance book and rejects posting before the frozen boundary", async () => {
    const { postGLEntry } = await import("../lib/finance/gl");
    const { updateFinanceSettings } = await import("../lib/finance/settings");

    const je = await postGLEntry({
      tenantSlug: TENANT,
      entryDate: "2026-11-10",
      description: "Tax-book accrual",
      financeBook: "tax",
      lines: [
        { accountCode: "6100", debitAmount: 100 },
        { accountCode: "1100", creditAmount: 100 },
      ],
    });
    expect(je.id).toBeTruthy();
    const { rows } = await db.query(
      `select finance_book from journal_entries where id = $1`, [je.id],
    );
    expect(rows[0].finance_book).toBe("tax");

    await updateFinanceSettings(TENANT, { accountsFrozenUntil: "2026-11-15" });
    await expect(
      postGLEntry({
        tenantSlug: TENANT,
        entryDate: "2026-11-10",
        description: "should fail",
        lines: [
          { accountCode: "6100", debitAmount: 5 },
          { accountCode: "1100", creditAmount: 5 },
        ],
      }),
    ).rejects.toThrow(/frozen/i);
    // Unfreeze for later tests.
    await updateFinanceSettings(TENANT, { accountsFrozenUntil: null });
    const s = await (await import("../lib/finance/settings")).getFinanceSettings(TENANT);
    expect(s.accountsFrozenUntil).toBeNull();
  }, T);

  it("enforces required accounting dimensions with allowed values", async () => {
    const { postGLEntry } = await import("../lib/finance/gl");
    const { upsertDimension, listDimensions, deleteDimension } = await import("../lib/finance/dimensions");

    const dim = await upsertDimension({
      tenantSlug: TENANT,
      dimensionKey: "outlet",
      label: "Outlet",
      requiredFor: ["pos_sale"],
      allowedValues: ["LEKKI", "IKEJA"],
    });
    expect(dim.dimensionKey).toBe("outlet");
    expect((await listDimensions(TENANT)).length).toBe(1);

    // Missing required dimension → reject
    await expect(
      postGLEntry({
        tenantSlug: TENANT,
        entryDate: "2026-11-16",
        referenceType: "pos_sale",
        description: "POS sale no dim",
        lines: [
          { accountCode: "4000", creditAmount: 50 },
          { accountCode: "1110", debitAmount: 50 },
        ],
      }),
    ).rejects.toThrow(/dimension/i);

    // Disallowed value → reject
    await expect(
      postGLEntry({
        tenantSlug: TENANT,
        entryDate: "2026-11-16",
        referenceType: "pos_sale",
        description: "POS sale bad dim",
        lines: [
          { accountCode: "4000", creditAmount: 50, dimensions: { outlet: "ABUJA" } },
          { accountCode: "1110", debitAmount: 50, dimensions: { outlet: "ABUJA" } },
        ],
      }),
    ).rejects.toThrow(/not allowed/i);

    // Valid value → posts, dimension stored on the line
    const je = await postGLEntry({
      tenantSlug: TENANT,
      entryDate: "2026-11-16",
      referenceType: "pos_sale",
      description: "POS sale ok",
      lines: [
        { accountCode: "4000", creditAmount: 50, dimensions: { outlet: "LEKKI" } },
        { accountCode: "1110", debitAmount: 50, dimensions: { outlet: "LEKKI" } },
      ],
    });
    const { rows } = await db.query(
      `select dimensions from journal_entry_lines where entry_id = $1 order by line_number`,
      [je.id],
    );
    expect(rows[0].dimensions.outlet).toBe("LEKKI");

    // Other voucher types are unaffected
    const free = await postGLEntry({
      tenantSlug: TENANT,
      entryDate: "2026-11-16",
      referenceType: "manual",
      description: "No requirement",
      lines: [
        { accountCode: "6100", debitAmount: 10 },
        { accountCode: "1100", creditAmount: 10 },
      ],
    });
    expect(free.id).toBeTruthy();

    expect(await deleteDimension(dim.id, TENANT)).toBe(true);
  }, T);

  it("journal entry templates: CRUD, scaled execution, tenant isolation", async () => {
    const {
      upsertJournalEntryTemplate,
      listJournalEntryTemplates,
      postFromTemplate,
      deleteJournalEntryTemplate,
    } = await import("../lib/finance/je-templates");

    const tpl = await upsertJournalEntryTemplate({
      tenantSlug: TENANT,
      name: "Monthly Rent Accrual",
      journalType: "MANUAL",
      lines: [
        { accountCode: "6100", debitAmount: 1000, description: "Rent expense" },
        { accountCode: "2100", creditAmount: 1000, description: "Accrued rent" },
      ],
    });
    expect(tpl.id).toBeTruthy();
    expect((await listJournalEntryTemplates(TENANT)).map((t) => t.name)).toContain("Monthly Rent Accrual");

    // Scale to a different amount — must still balance
    const je = await postFromTemplate({
      tenantSlug: TENANT,
      templateId: tpl.id,
      entryDate: "2026-11-20",
      totalDebit: 1500,
      description: "November rent",
    });
    expect(je.totalDebit).toBeCloseTo(1500, 2);
    expect(je.totalCredit).toBeCloseTo(1500, 2);

    // Tenant isolation: another tenant cannot see or execute it
    expect(await listJournalEntryTemplates("__other_tenant__")).toHaveLength(0);
    await expect(
      postFromTemplate({
        tenantSlug: "__other_tenant__",
        templateId: tpl.id,
        entryDate: "2026-11-20",
      }),
    ).rejects.toThrow(/not found/i);

    expect(await deleteJournalEntryTemplate(tpl.id, TENANT)).toBe(true);
  }, T);

  it("credit check honors finance_settings.creditCheckMode", async () => {
    const { updateFinanceSettings } = await import("../lib/finance/settings");
    const { assertCreditAvailable } = await import("../lib/finance/credit-control");

    await updateFinanceSettings(TENANT, { creditCheckMode: "off" });
    const res = await assertCreditAvailable(TENANT, "__nonexistent_customer__", 999999);
    expect(res.ok).toBe(true);
    await updateFinanceSettings(TENANT, { creditCheckMode: "block" });
  }, T);

  it("asset lifecycle: movement, maintenance w/ GL cost, revaluation, capitalization, depreciation ledger", async () => {
    const { createAsset, runDepreciation } = await import("../lib/finance/fixed-assets");
    const {
      recordAssetMovement,
      listAssetMovements,
      createMaintenanceTeam,
      scheduleMaintenance,
      completeMaintenance,
      adjustAssetValue,
      capitalizeAsset,
      assetDepreciationLedger,
      assetDepreciationsAndBalances,
    } = await import("../lib/finance/asset-lifecycle");

    const asset = await createAsset({
      tenantSlug: TENANT,
      name: "Delivery Van",
      category: "Vehicles",
      acquisitionDate: "2026-01-01",
      cost: 12000,
      usefulLifeMonths: 12,
      depreciationStartDate: "2026-01-01",
    });
    expect(asset.id).toBeTruthy();

    // Movement
    await recordAssetMovement({ tenantSlug: TENANT, assetId: asset.id, toLocation: "Lekki Depot", custodian: "Driver A" });
    const moves = await listAssetMovements(TENANT, asset.id);
    expect(moves).toHaveLength(1);
    expect(moves[0].to_location).toBe("Lekki Depot");

    // Maintenance team + scheduled repair completed with cost → JE posts
    await createMaintenanceTeam({ tenantSlug: TENANT, name: "Fleet Crew", members: ["emp_1"] });
    const m = await scheduleMaintenance({
      tenantSlug: TENANT, assetId: asset.id, kind: "repair",
      teamName: "Fleet Crew", scheduledDate: "2026-11-05", description: "Engine fix",
    });
    const done = await completeMaintenance({
      tenantSlug: TENANT, maintenanceId: m.id, completedDate: "2026-11-06", cost: 800,
    });
    expect(done.journalEntryId).toBeTruthy();
    const { rows: maintLines } = await db.query(
      `select account_code, debit_amount, credit_amount from journal_entry_lines
       where entry_id = $1 order by line_number`,
      [done.journalEntryId],
    );
    expect(maintLines[0].account_code).toBe("6450"); // repairs & maintenance
    expect(Number(maintLines[0].debit_amount)).toBe(800);

    // Revaluation: NBV 12000 → 15000, +3000 to revaluation reserve
    const adj = await adjustAssetValue({
      tenantSlug: TENANT, assetId: asset.id, adjustmentDate: "2026-11-07",
      newNetBookValue: 15000, reason: "Market uplift",
    });
    expect(adj.delta).toBe(3000);
    const { rows: adjLines } = await db.query(
      `select account_code, credit_amount from journal_entry_lines
       where entry_id = $1 order by line_number`,
      [adj.journalEntryId],
    );
    expect(adjLines.some((l) => l.account_code === "3200" && Number(l.credit_amount) === 3000)).toBe(true);

    // Capitalization: expense pool → new asset with JE
    const cap = await capitalizeAsset({
      tenantSlug: TENANT,
      name: "Warehouse Shelving",
      capitalizationDate: "2026-11-08",
      amount: 5000,
      usefulLifeMonths: 24,
      depreciationStartDate: "2026-11-08",
    });
    expect(cap.assetNo).toMatch(/^FA-/);
    expect(cap.journalEntryId).toBeTruthy();

    // Depreciation ledger + balances reports
    await runDepreciation({ tenantSlug: TENANT, asOf: "2026-11-30" });
    const ledger = await assetDepreciationLedger({ tenantSlug: TENANT, assetId: asset.id });
    expect(ledger.length).toBeGreaterThan(0);
    const posted = ledger.filter((r) => r.status === "posted");
    expect(posted.length).toBeGreaterThan(0);
    const jan = posted.find((r) => r.periodDate === "2026-01-31");
    expect(jan.depreciation).toBeCloseTo(1000, 0);
    // Revaluation raised cost 12000 → 15000; opening NBV = cost − prior dep.
    expect(jan.openingNbv).toBeCloseTo(15000, 0);
    expect(jan.closingNbv).toBeCloseTo(14000, 0);

    const balances = await assetDepreciationsAndBalances({ tenantSlug: TENANT });
    const van = balances.find((b) => b.assetId === asset.id);
    expect(van).toBeTruthy();
    expect(van.location).toBe("Lekki Depot");
  }, T);

  it("order analysis: sales pipeline and purchase received-vs-billed", async () => {
    const { ensureSalesOrdersTable } = await import("../lib/sales/orders");
    await ensureSalesOrdersTable();
    const { db: dbClient } = await import("../lib/sql-client");

    await dbClient.query(
      `insert into sales_orders (id, tenant_slug, order_number, customer_name, order_date, items, quantity, total, status)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [`so_depth_1`, TENANT, "SO-100", "Acme", "2026-11-01",
       JSON.stringify([{ description: "Widget", quantity: 10, unitPrice: 20 }]), 10, 200, "Delivered"],
    );
    await dbClient.query(
      `insert into sales_orders (id, tenant_slug, order_number, customer_name, order_date, items, quantity, total, status)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [`so_depth_2`, TENANT, "SO-101", "Beta", "2026-11-02",
       JSON.stringify([{ description: "Gadget", quantity: 5, unitPrice: 40 }]), 5, 200, "Pending"],
    );

    const { ensurePurchaseOrderTables } = await import("../lib/finance/purchase-orders");
    const { sql } = await import("../lib/sql-client");
    await ensurePurchaseOrderTables(sql as any);
    await dbClient.query(
      `insert into purchase_orders (id, tenant_slug, order_number, po_number, supplier_name, issued_date, due_date, status, total_amount, balance_due)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [`po_depth_1`, TENANT, "PO-200", "PO-200", "Supplier X", "2026-11-01", "2026-12-01", "sent", 1000, 1000],
    );
    await dbClient.query(
      `insert into purchase_order_items (id, purchase_order_id, description, quantity, received_quantity, unit_price, amount)
       values (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6)`,
      [`po_depth_1`, "Steel", 100, 60, 10, 1000],
    );

    const {
      salesOrderAnalysis,
      purchaseOrderAnalysis,
      itemsToBeBilledSales,
      itemsToBeDeliveredSales,
      itemsToBeBilledPurchase,
      itemsToBeReceivedPurchase,
    } = await import("../lib/finance/order-analysis");

    const sales = await salesOrderAnalysis({ tenantSlug: TENANT });
    const so1 = sales.find((r) => r.orderNumber === "SO-100");
    expect(so1.delivered).toBe(true);
    expect(so1.pendingBillingAmount).toBe(200); // delivered, not invoiced
    const so2 = sales.find((r) => r.orderNumber === "SO-101");
    expect(so2.delivered).toBe(false);

    expect((await itemsToBeBilledSales({ tenantSlug: TENANT })).map((r) => r.orderNumber)).toEqual(
      expect.arrayContaining(["SO-100", "SO-101"]),
    );
    expect((await itemsToBeDeliveredSales({ tenantSlug: TENANT })).map((r) => r.orderNumber)).toContain("SO-101");

    const po = await purchaseOrderAnalysis({ tenantSlug: TENANT });
    const po1 = po.find((r) => r.poNumber === "PO-200");
    expect(po1.orderedQty).toBe(100);
    expect(po1.receivedQty).toBe(60);
    expect(po1.receivedAmount).toBe(600);
    expect(po1.receivedNotBilled).toBe(600); // nothing billed yet
    expect(po1.orderedNotReceived).toBe(40);

    expect((await itemsToBeBilledPurchase({ tenantSlug: TENANT })).map((r) => r.poNumber)).toContain("PO-200");
    const toRecv = await itemsToBeReceivedPurchase({ tenantSlug: TENANT });
    expect(toRecv[0].pendingQty).toBe(40);
    expect(toRecv[0].pendingValue).toBe(400);

    // Tenant isolation
    expect(await salesOrderAnalysis({ tenantSlug: "__other_tenant__" })).toHaveLength(0);
    expect(await purchaseOrderAnalysis({ tenantSlug: "__other_tenant__" })).toHaveLength(0);
  }, T);
});
