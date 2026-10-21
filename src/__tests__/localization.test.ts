import { describe, it, expect, beforeAll, afterAll } from "vitest";
import process from "node:process";
import { randomUUID } from "node:crypto";

const T = 120000;
const TENANT = `__ngtest_${Date.now()}__`;

async function cleanup() {
  const { db } = await import("../lib/sql-client");
  await db.query(`delete from journal_entry_lines where entry_id in (select id from journal_entries where tenant_slug = $1)`, [TENANT]);
  await db.query(`delete from journal_entries where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from account_balances where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from fiscal_periods where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from journal_sequences where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from accounting_audit_log where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from tax_transactions where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from tax_rates where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from admin_statutory_profiles where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from admin_payroll_entries where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from admin_payroll_runs where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from bill_items where bill_id in (select id from bills where tenant_slug = $1)`, [TENANT]);
  await db.query(`delete from bills where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from finance_invoice_lines where invoice_id in (select id from finance_invoices where tenant_slug = $1)`, [TENANT]);
  await db.query(`delete from finance_invoices where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from chart_of_accounts where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from tenants where slug = $1`, [TENANT]);
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  await cleanup();
  const { db } = await import("../lib/sql-client");
  await db.query(
    `insert into tenants (name, slug, settings, seats)
     values ($1, $2, '{"currency":"NGN"}'::jsonb, 1)
     on conflict (slug) do nothing`,
    ["NG Localization Test", TENANT]
  );
}, T);

afterAll(cleanup, T);

describe("Nigeria PAYE math (no DB needed)", () => {
  it("applies CRA then annual brackets correctly", async () => {
    const { computeNigeriaPaye } = await import("../lib/finance/localization");
    // Gross ₦3,000,000/yr → CRA = max(200k, 30k) + 600k = 800k; taxable = 2.2M
    const r = computeNigeriaPaye(3_000_000);
    expect(r.cra).toBe(800_000);
    expect(r.taxable).toBe(2_200_000);
    // 21k + 33k + 75k + 95k + 600k*21% = 350,000
    expect(r.tax).toBe(350_000);
  });

  it("zero tax below the effective exemption and caps relief floor", async () => {
    const { computeNigeriaPaye } = await import("../lib/finance/localization");
    // Gross 200k → CRA = max(200k, 2k) + 40k = 240k > gross → taxable 0
    const low = computeNigeriaPaye(200_000);
    expect(low.taxable).toBe(0);
    expect(low.tax).toBe(0);
    // At ₦10M the ₦200k fixed minimum still wins (1% = ₦100k < ₦200k)
    const mid = computeNigeriaPaye(10_000_000);
    expect(mid.cra).toBe(200_000 + 2_000_000);
    // Above ₦20M the 1%-of-gross floor takes over
    const high = computeNigeriaPaye(25_000_000);
    expect(high.cra).toBe(250_000 + 5_000_000); // 1% floor + 20%
  });
});

describe.skipIf(!process.env.DATABASE_URL)("Nigeria localization pack", () => {
  it("seeds tax rates + statutory profile idempotently", async () => {
    const { seedNigeriaPack } = await import("../lib/finance/localization");
    const { db } = await import("../lib/sql-client");

    const first = await seedNigeriaPack(TENANT);
    expect(first.taxRatesInserted).toBe(6);
    expect(first.statutoryProfile).toBe("created");
    expect(first.coaSeeded.inserted).toBeGreaterThan(0);

    const second = await seedNigeriaPack(TENANT);
    expect(second.taxRatesInserted).toBe(0);
    expect(second.taxRatesSkipped).toBe(6);
    expect(second.coaSeeded.inserted).toBe(0);

    const { rows: [profile] } = await db.query<any>(
      `select * from admin_statutory_profiles where tenant_slug = $1`, [TENANT]);
    expect(profile.country_code).toBe("NG");
    expect(profile.paye_annualize).toBe(true);
    expect(Number(profile.pension_employee_rate)).toBe(8);
    expect(Number(profile.pension_employer_rate)).toBe(10);
    expect(profile.employer_contributions.length).toBe(3);
  }, T);

  it("posts bill JE with input VAT split + WHT payable, and records tax transactions", async () => {
    const { createBill } = await import("../lib/finance/bills");
    const { db } = await import("../lib/sql-client");
    const { GL_ACCOUNTS } = await import("../lib/finance/gl");

    const bill = await createBill({
      tenantSlug: TENANT,
      vendorId: randomUUID(),
      billDate: "2026-11-05",
      whtRate: 10, // services WHT for a company vendor
      items: [
        { description: "Consulting", quantity: 1, unitPrice: 1000, taxRate: 7.5, accountCode: "6100" },
      ],
    });

    // subtotal 1000 + VAT 75 = 1075 total; WHT 100 withheld → vendor owed 975
    expect(bill.taxes).toBe(75);
    expect(bill.whtAmount).toBe(100);
    expect(bill.balanceDue).toBe(975);

    const je = (await db.query<any>(
      `select id from journal_entries where tenant_slug = $1 and reference_type = 'bill' and reference_id = $2`,
      [TENANT, bill.id]
    )).rows[0];
    const lines = (await db.query<any>(
      `select account_code, debit_amount, credit_amount from journal_entry_lines where journal_entry_id = $1 or entry_id = $1`,
      [je.id]
    )).rows;
    const byCode = Object.fromEntries(lines.map((l: any) => [l.account_code, l]));
    expect(Number(byCode["6100"].debit_amount)).toBe(1000);          // expense net of VAT
    expect(Number(byCode[GL_ACCOUNTS.VAT_INPUT].debit_amount)).toBe(75);  // input VAT claimable
    expect(Number(byCode[GL_ACCOUNTS.ACCOUNTS_PAYABLE].credit_amount)).toBe(975);
    expect(Number(byCode[GL_ACCOUNTS.WHT_PAYABLE].credit_amount)).toBe(100);

    const tx = (await db.query<any>(
      `select transaction_type, tax_amount from tax_transactions
       where tenant_slug = $1 and source_type = 'bill' and source_id = $2`,
      [TENANT, bill.id]
    )).rows;
    const types = Object.fromEntries(tx.map((t: any) => [t.transaction_type, Number(t.tax_amount)]));
    expect(types["vat_input"]).toBe(75);
    expect(types["wht_deducted"]).toBe(100);
  }, T);

  it("records invoice output VAT and aggregates the VAT summary", async () => {
    const { insertFinanceInvoice } = await import("../lib/finance/db");
    const { generateVatSummary } = await import("../lib/finance/localization");

    const inv = await insertFinanceInvoice({
      tenantSlug: TENANT, customerName: "VAT Client", customerCode: "C-VAT",
      invoiceNumber: "INV-VAT-1", issuedDate: "2026-11-05", dueDate: "2026-11-20",
      currency: "NGN", status: "sent",
      lineItems: [{ description: "Services", quantity: 1, unitPrice: 2000, amount: 2000, taxRate: 7.5 }],
      amount: 2150, balanceDue: 2150,
    } as any);
    expect(inv.id).toBeTruthy();

    const vat = await generateVatSummary(TENANT, "2026-11-01", "2026-11-30");
    expect(vat.outputVat.taxAmount).toBe(150);   // 7.5% of 2000
    expect(vat.inputVat.taxAmount).toBe(75);     // from the bill above
    expect(vat.netPayable).toBe(75);
    expect(vat.monthly.length).toBe(1);
    expect(vat.monthly[0].month).toBe("2026-11");
  }, T);

  it("recomputes PAYE annually + employer contributions in a payroll run", async () => {
    const { createPayrollRun } = await import("../lib/hr/db");
    const { db } = await import("../lib/sql-client");

    const { runId } = await createPayrollRun({
      tenantSlug: TENANT,
      period: "2026-11",
      config: { taxRate: 0, pensionRate: 0, healthInsuranceRate: 0, transportAllowance: 0, housingAllowance: 0, mealAllowance: 0 },
      entries: [{
        employeeId: "emp-1", employeeName: "Test Employee",
        department: null, position: null,
        baseSalary: 250_000, transportAllowance: 0, housingAllowance: 0, mealAllowance: 0,
        bonus: 0, tax: 0, pension: 0, healthInsurance: 0, otherDeductions: 0,
        totalDeductions: 0, grossPay: 0, netPay: 0,
      }],
    });

    const { rows: [e] } = await db.query<any>(
      `select * from admin_payroll_entries where run_id = $1`, [runId]);

    // Annual gross 3,000,000 → CRA 800k → taxable 2.2M → annual 350k → monthly 29,166.67
    expect(Number(e.tax)).toBeCloseTo(29_166.67, 2);
    expect(Number(e.pension)).toBe(20_000);          // 8% EE
    expect(Number(e.employer_cost)).toBe(30_000);    // 25k pension + 2.5k NSITF + 2.5k ITF
    const bd = e.employer_breakdown as { name: string; amount: number }[];
    expect(bd.find((b) => /pension/i.test(b.name))!.amount).toBe(25_000);
    const sb = e.statutory_breakdown as any;
    expect(Number(sb.nhf)).toBe(6_250);               // 2.5% NHF
    expect(Number(sb.paye)).toBeCloseTo(29_166.67, 2);
    // net = 250k − (29,166.67 + 20,000 + 6,250)
    expect(Number(e.net_pay)).toBeCloseTo(194_583.33, 2);
  }, T);

  it("builds the PAYE remittance and WHT schedules", async () => {
    const { generatePayeRemittance, generateWhtSchedule } = await import("../lib/finance/localization");

    const remit = await generatePayeRemittance(TENANT);
    expect(remit.periods.length).toBe(1);
    expect(remit.periods[0].period).toBe("2026-11");
    expect(remit.periods[0].paye).toBeCloseTo(29_166.67, 2);
    expect(remit.periods[0].pensionEmployer).toBe(25_000);
    expect(remit.periods[0].nhf).toBe(6_250);
    expect(remit.totals.employerCost).toBe(30_000);

    const wht = await generateWhtSchedule(TENANT, "2026-11-01", "2026-11-30");
    expect(wht.totalWht).toBe(100);
    expect(wht.lines.length).toBe(1);
    expect(wht.lines[0].rate).toBe(10);
  }, T);
});
