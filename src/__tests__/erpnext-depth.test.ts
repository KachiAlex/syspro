import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../lib/sql-client";

const TENANT = `__erpnext_${Date.now()}__`;
const T = 300000;

async function cleanup() {
  for (const t of [
    "subscription_invoices", "subscriptions", "subscription_plans",
    "invoice_discountings", "bank_guarantees", "bank_recon_rules",
    "asset_usage_log", "asset_finance_books", "asset_locations",
    "asset_maintenance", "asset_depreciation_schedule", "fixed_assets",
    "coupon_codes", "promotional_schemes", "pricing_rules",
    "shipping_rules", "tax_withholding_entries", "tax_withholding_categories",
    "tax_rules", "party_tax_categories", "item_tax_templates", "tax_templates",
    "transaction_deletion_records", "deferred_schedule", "deferred_items",
    "statement_runs", "cost_center_allocations", "monthly_distributions",
    "mode_of_payment", "payment_orders",
    "finance_invoice_lines", "finance_invoices", "finance_customers",
    "payment_applications", "finance_payments",
    "bank_statement_lines",
    "journal_entry_lines", "journal_entries",
    "chart_of_accounts", "fiscal_periods",
  ]) {
    await db.query(`delete from ${t} where tenant_slug = $1`, [TENANT]).catch(() => undefined);
  }
}
beforeAll(cleanup, 120000);
afterAll(cleanup, 120000);

describe.skipIf(!process.env.DATABASE_URL)("erpnext depth tranches B–F", () => {
  it("deferred revenue: schedule generates, processes into GL, reports remaining", async () => {
    const { createDeferredItem, processDeferredAccounting, deferredReport } =
      await import("../lib/finance/deferred");

    const item = await createDeferredItem({
      tenantSlug: TENANT,
      direction: "revenue",
      documentType: "invoice",
      documentId: "INV-DEF-1",
      party: "ACME",
      totalAmount: 1200,
      serviceStartDate: "2026-01-01",
      serviceEndDate: "2026-12-31",
      recognitionAccountCode: "4000",
    });
    expect(item.id).toBeTruthy();

    const run = await processDeferredAccounting({ tenantSlug: TENANT, asOf: "2026-01-31" });
    expect(run.posted.length).toBe(1);

    const { rows: jes } = await db.query(
      `select je.id from journal_entries je
       where je.tenant_slug = $1 and je.reference_type like 'deferred%'`,
      [TENANT],
    );
    expect(jes.length).toBe(1);

    const report = await deferredReport({ tenantSlug: TENANT });
    expect(report[0].totalAmount).toBe(1200);
    expect(report[0].recognizedAmount).toBe(100); // 1200/12
    expect(report[0].remainingAmount).toBe(1100);

    // Idempotent: re-processing the same period posts nothing
    const rerun = await processDeferredAccounting({ tenantSlug: TENANT, asOf: "2026-01-31" });
    expect(rerun.posted.length).toBe(0);
  }, T);

  it("GL vs subledger comparison + transaction deletion records", async () => {
    const { glVsSubledgerComparison, recordTransactionDeletion, listDeletionRecords } =
      await import("../lib/finance/ledger-integrity");
    const { postGLEntry } = await import("../lib/finance/gl");

    await postGLEntry({
      tenantSlug: TENANT,
      entryDate: "2026-02-01",
      journalType: "SYSTEM",
      referenceType: "invoice",
      referenceId: "TEST-INV-9",
      description: "Test AR entry",
      lines: [
        { accountCode: "1200", debitAmount: 500, partyType: "customer", partyId: "C-TEST" },
        { accountCode: "4000", creditAmount: 500 },
      ],
    });

    const cmp = await glVsSubledgerComparison({ tenantSlug: TENANT });
    // 500 AR posted to GL with no subledger invoice → receivable shows the gap
    expect(cmp.receivable.glBalance).toBe(500);
    expect(cmp.receivable.difference).toBe(500);

    await recordTransactionDeletion({
      tenantSlug: TENANT,
      documentType: "invoice",
      documentId: "INV-DELETED-1",
      documentData: { amount: 999 },
      reason: "duplicate",
    });
    const recs = await listDeletionRecords(TENANT);
    expect(recs.length).toBe(1);
    expect(recs[0].document_id).toBe("INV-DELETED-1");
  }, T);

  it("tax engine: template + rule resolution + withholding cumulative threshold", async () => {
    const {
      upsertTaxTemplate, upsertTaxRule, resolveTaxTemplate, computeTaxLines,
      setPartyTaxCategory, upsertWithholdingCategory, computeAndRecordWithholding,
      upsertShippingRule, resolveShippingCharge,
    } = await import("../lib/finance/tax-engine");

    const tpl = await upsertTaxTemplate({
      tenantSlug: TENANT,
      name: "Lagos VAT",
      direction: "sales",
      lines: [{ description: "VAT", rate: 7.5, accountCode: "2205" }],
    });
    expect(tpl.id).toBeTruthy();

    await setPartyTaxCategory({ tenantSlug: TENANT, partyType: "customer", partyId: "C-VIP", taxCategory: "lagos" });
    await upsertTaxRule({
      tenantSlug: TENANT,
      name: "Lagos rule",
      priority: 10,
      direction: "sales",
      taxCategory: "lagos",
      taxTemplateId: tpl.id,
    });

    const resolved = await resolveTaxTemplate({
      tenantSlug: TENANT, direction: "sales", partyType: "customer", partyId: "C-VIP",
    });
    expect(resolved?.name).toBe("Lagos VAT");
    const lines = computeTaxLines(1000, resolved!.lines);
    expect(lines[0].amount).toBe(75);

    const cat = await upsertWithholdingCategory({
      tenantSlug: TENANT,
      name: "WHT 5%",
      accountCode: "2210",
      rates: [{ rate: 5, singleThreshold: 0, cumulativeThreshold: 0 }],
    });
    const w1 = await computeAndRecordWithholding({
      tenantSlug: TENANT, categoryId: cat.id, partyType: "vendor", partyId: "V-1",
      documentType: "bill", documentId: "B-1", taxableAmount: 100000,
    });
    expect(w1.withheld).toBe(5000);
    const w2 = await computeAndRecordWithholding({
      tenantSlug: TENANT, categoryId: cat.id, partyType: "vendor", partyId: "V-1",
      documentType: "bill", documentId: "B-2", taxableAmount: 50000,
    });
    expect(w2.cumulativeBefore).toBe(100000);

    await upsertShippingRule({
      tenantSlug: TENANT, name: "Standard freight", maxValue: 500000,
      chargeType: "flat", chargeValue: 5000,
    });
    const ship = await resolveShippingCharge({ tenantSlug: TENANT, orderValue: 100000 });
    expect(ship.charge).toBe(5000);
  }, T);

  it("pricing: rule resolution + coupon redemption with limits", async () => {
    const { upsertPricingRule, resolvePrice, upsertCouponCode, redeemCoupon } =
      await import("../lib/finance/pricing");

    await upsertPricingRule({
      tenantSlug: TENANT, name: "VIP 10%", priority: 5,
      partyType: "customer", partyId: "C-VIP",
      mode: "discount_pct", value: 10,
    });
    const p1 = await resolvePrice({ tenantSlug: TENANT, item: "WIDGET", partyType: "customer", partyId: "C-VIP", basePrice: 1000 });
    expect(p1.price).toBe(900);
    expect(p1.rule).toBe("VIP 10%");
    const p2 = await resolvePrice({ tenantSlug: TENANT, item: "WIDGET", partyType: "customer", partyId: "C-OTHER", basePrice: 1000 });
    expect(p2.price).toBe(1000);

    await upsertCouponCode({
      tenantSlug: TENANT, code: "SAVE10", discountType: "percent", discountValue: 10,
      minOrderValue: 500, maxUses: 1,
    });
    const r1 = await redeemCoupon({ tenantSlug: TENANT, code: "SAVE10", orderValue: 1000 });
    expect(r1.valid).toBe(true);
    expect(r1.discount).toBe(100);
    const r2 = await redeemCoupon({ tenantSlug: TENANT, code: "SAVE10", orderValue: 1000 });
    expect(r2.valid).toBe(false); // usage limit reached
    const r3 = await redeemCoupon({ tenantSlug: TENANT, code: "NOPE", orderValue: 1000 });
    expect(r3.valid).toBe(false);
  }, T);

  it("assets: location tree, per-book params, usage depreciation, activity log", async () => {
    const { createAsset } = await import("../lib/finance/fixed-assets");
    const {
      upsertAssetLocation, listAssetLocationTree,
      upsertAssetFinanceBook, recordAssetUsage, postUsageDepreciation,
      getAssetActivity, completeMaintenance, scheduleMaintenance,
    } = await import("../lib/finance/asset-lifecycle");

    await upsertAssetLocation({ tenantSlug: TENANT, name: "HQ" });
    await upsertAssetLocation({ tenantSlug: TENANT, name: "HQ-Floor1", parentName: "HQ" });
    const tree = await listAssetLocationTree(TENANT);
    expect(tree[0].name).toBe("HQ");
    expect(tree[0].children[0].name).toBe("HQ-Floor1");

    const asset = await createAsset({
      tenantSlug: TENANT, name: "Generator A",
      acquisitionDate: "2026-01-01", cost: 100000, salvageValue: 10000,
      usefulLifeMonths: 60,
    });

    await upsertAssetFinanceBook({
      tenantSlug: TENANT, assetId: asset.id, financeBook: "main",
      method: "units_of_production", totalExpectedUnits: 90000,
    });
    await recordAssetUsage({ tenantSlug: TENANT, assetId: asset.id, periodDate: "2026-02-28", units: 9000 });
    const dep = await postUsageDepreciation({ tenantSlug: TENANT, assetId: asset.id, periodDate: "2026-02-28" });
    // 90000 base × 9000/90000 = 9000
    expect(dep.amount).toBe(9000);
    expect(dep.journalEntryId).toBeTruthy();

    // Repair with stock parts: Dr 6450 total / Cr 1500 parts + Cr 1100 labor
    const maint = await scheduleMaintenance({
      tenantSlug: TENANT, assetId: asset.id, kind: "repair",
      scheduledDate: "2026-03-01", description: "Replace filter",
    });
    const done = await completeMaintenance({
      tenantSlug: TENANT, maintenanceId: maint.id, completedDate: "2026-03-02",
      cost: 2000, parts: [{ item: "FILTER-X", qty: 2, cost: 500 }],
    });
    expect(done.totalCost).toBe(3000);
    expect(done.partsCost).toBe(1000);

    const activity = await getAssetActivity(TENANT, asset.id);
    const events = activity.map((a: any) => a.event);
    expect(events).toContain("maintenance");
    expect(events).toContain("usage");
  }, T);

  it("treasury: recon rules suggest matches, guarantees, subscription invoicing", async () => {
    const {
      upsertBankReconRule, applyReconRules,
      issueBankGuarantee, listBankGuarantees,
      upsertSubscriptionPlan, createSubscription, generateSubscriptionInvoices,
      fetchAndStoreExchangeRates,
    } = await import("../lib/finance/treasury");
    const { importStatementLines } = await import("../lib/finance/bank-statement");
    const { insertFinanceInvoice } = await import("../lib/finance/db");

    // Recon rule → party suggestion + document match
    const cust = `C-${Date.now()}`;
    const { upsertCustomer } = await import("../lib/finance/credit-control");
    await upsertCustomer({ tenantSlug: TENANT, customerCode: cust, name: "Rule Customer" });
    const inv = await insertFinanceInvoice({
      tenantSlug: TENANT,
      customerName: "Rule Customer",
      customerCode: cust,
      invoiceNumber: `INV-RULE-${Date.now()}`,
      issuedDate: "2026-02-01",
      dueDate: "2026-03-01",
      amount: 25000,
      status: "sent",
      lineItems: [{ description: "Service", quantity: 1, unitPrice: 25000 }],
    });
    await importStatementLines({
      tenantSlug: TENANT, bankAccountCode: "1100",
      lines: [{ date: "2026-02-05", description: "TRF RULE CUSTOMER PAYMENT", amount: 25000 }],
    });
    await upsertBankReconRule({
      tenantSlug: TENANT, name: "Rule cust receipts", pattern: "RULE CUSTOMER",
      matchField: "description", partyType: "customer", partyId: cust, amountTolerance: 0,
    });
    const suggestions = await applyReconRules({ tenantSlug: TENANT, bankAccountCode: "1100" });
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].suggestion.partyId).toBe(cust);
    expect(suggestions[0].suggestion.document?.docNo).toBeTruthy();

    // Bank guarantee with margin
    const bg = await issueBankGuarantee({
      tenantSlug: TENANT, direction: "issued", beneficiary: "NPA",
      bank: "GTB", amount: 5000000, startDate: "2026-01-01", endDate: "2027-01-01",
      marginAmount: 500000,
    });
    expect(bg.journal_entry_id).toBeTruthy();
    expect((await listBankGuarantees(TENANT))[0].beneficiary).toBe("NPA");

    // Subscription → auto invoice
    const plan = await upsertSubscriptionPlan({
      tenantSlug: TENANT, name: "Monthly SaaS", item: "SAAS-FEE",
      unitPrice: 50000, interval: "monthly",
    });
    const { rows: [fc] } = await db.query(
      `select id from finance_customers where tenant_slug = $1 and customer_code = $2`,
      [TENANT, cust],
    );
    await createSubscription({
      tenantSlug: TENANT, customerId: fc?.id ?? cust, planId: plan.id, startDate: "2026-01-01",
    });
    const gen = await generateSubscriptionInvoices({ tenantSlug: TENANT, asOf: "2026-01-31" });
    expect(gen.generated).toBe(1);
    const { rows: subInv } = await db.query(
      `select * from subscription_invoices where tenant_slug = $1`, [TENANT],
    );
    expect(subInv.length).toBe(1);
    // Second run same period → nothing new (advanced to Feb but asOf stays Jan)
    const gen2 = await generateSubscriptionInvoices({ tenantSlug: TENANT, asOf: "2026-01-31" });
    expect(gen2.generated).toBe(0);

    // Rate fetch with injected fetch impl (no network in tests)
    const rates = await fetchAndStoreExchangeRates({
      tenantSlug: TENANT, baseCurrency: "NGN", currencies: ["USD", "EUR"],
      fetchImpl: (async () => ({
        ok: true,
        json: async () => ({ rates: { USD: 0.00066, EUR: 0.00061 } }),
      })) as any,
    });
    expect(rates.stored).toBe(2);
    const { rows: rateRows } = await db.query(
      `select currency, rate::float r, source from exchange_rates where tenant_slug = $1`,
      [TENANT],
    );
    expect(rateRows.find((r: any) => r.currency === "USD")?.r).toBeCloseTo(0.00066, 6);
    expect(rateRows[0].source).toBe("auto");
  }, T);
});
