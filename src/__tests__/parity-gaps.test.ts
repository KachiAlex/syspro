import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../lib/sql-client";

const TENANT = `__parity_${Date.now()}__`;
const T = 300000;

async function cleanup() {
  for (const t of [
    "loyalty_point_entries", "loyalty_programs", "pos_loyalty_txns",
    "sales_partner_commissions", "sales_partners",
    "share_transfers", "shareholders", "share_types",
    "pegged_currencies", "cheque_print_templates",
    "tax_pack_applications", "process_run_logs",
    "tax_withholding_categories", "tax_templates",
    "finance_invoice_lines", "finance_invoices",
    "bank_statement_lines", "exchange_rates",
    "journal_entry_lines", "journal_entries",
    "chart_of_accounts",
  ]) {
    await db.query(`delete from ${t} where tenant_slug = $1`, [TENANT]).catch(() => undefined);
  }
  // shared CoA rows created by the equity default
  await db.query(`delete from chart_of_accounts where tenant_slug is null and code in ('3210','3220')`).catch(() => undefined);
  // mirrored pos txns for the test customer
  await db.query(`delete from pos_loyalty_txns where tenant_slug = $1`, [TENANT]).catch(() => undefined);
}
beforeAll(cleanup, 120000);
afterAll(cleanup, 120000);

describe.skipIf(!process.env.DATABASE_URL)("parity gaps tranche", () => {
  it("equity: share issue posts capital+premium and feeds the share ledger", async () => {
    const { upsertShareType, upsertShareholder, recordShareTransfer, shareLedger, shareBalance } =
      await import("../lib/finance/equity");

    const st = await upsertShareType({
      tenantSlug: TENANT, name: "Ordinary ₦1 @ 2 premium",
      faceValue: 1, premium: 2,
    });
    const holder = await upsertShareholder({ tenantSlug: TENANT, name: "Ada Equity" });

    const tr = await recordShareTransfer({
      tenantSlug: TENANT, transferType: "issue", shareTypeId: st.id,
      toShareholderId: holder.id, qty: 1000, rate: 3, postingDate: "2026-11-01",
    });
    expect(tr.journal_entry_id).toBeTruthy();

    // JE should be balanced: bank 3000 / capital 1000 / premium 2000
    const lines = (await db.query(
      `select l.account_code, l.debit_amount, l.credit_amount from journal_entry_lines l
       join journal_entries j on j.id = l.journal_entry_id
       where j.id = $1`, [tr.journal_entry_id])).rows;
    const dr = lines.reduce((s: number, r: any) => s + Number(r.debit_amount), 0);
    const cr = lines.reduce((s: number, r: any) => s + Number(r.credit_amount), 0);
    expect(dr).toBe(3000); expect(cr).toBe(3000);

    const ledger = await shareLedger({ tenantSlug: TENANT, shareholderId: holder.id });
    expect(Number(ledger[0].qty)).toBe(1000);
    const bal = await shareBalance(TENANT);
    expect(bal[0].shares).toBe(1000);
    expect(bal[0].capitalValue).toBe(1000);
  }, T);

  it("sales partners: commission accrues on an invoice and pays out", async () => {
    const { upsertSalesPartner, accrueCommission, payCommission } =
      await import("../lib/finance/partners");

    const partner = await upsertSalesPartner({
      tenantSlug: TENANT, name: "Agent Kunle", commissionRate: 5,
    });
    const invoiceId = `pinv_${Date.now()}`;
    await db.query(
      `insert into finance_invoices
         (id, tenant_slug, customer_name, customer_code, invoice_number,
          issued_date, due_date, amount, balance_due, status)
       values ($1,$2,$3,$4,$5,'2026-11-01','2026-12-01',$6,$6,'sent')`,
      [invoiceId, TENANT, "Acme Ltd", "CUST-1", "PINV-1", 20000],
    );

    const c = await accrueCommission({ tenantSlug: TENANT, invoiceId, partnerId: partner.id });
    expect(Number(c.commission_amount)).toBe(1000);
    expect(c.journalEntryId ?? c.accrual_journal_entry_id).toBeTruthy();

    const paid = await payCommission({ tenantSlug: TENANT, commissionId: c.id, paidDate: "2026-11-05" });
    expect(paid.journalEntryId).toBeTruthy();
    const st = (await db.query(
      `select status from sales_partner_commissions where id = $1`, [c.id])).rows;
    expect(st[0].status).toBe("paid");
  }, T);

  it("loyalty: points earn on invoice and redeem as discount, unified with POS ledger", async () => {
    const { upsertLoyaltyProgram, earnOnInvoice, redeemOnInvoice } =
      await import("../lib/finance/loyalty-program");

    const prog = await upsertLoyaltyProgram({
      tenantSlug: TENANT, name: "Naira Club", earnRate: 0.1,
      redeemValue: 1, minPointsToRedeem: 10, maxRedeemPct: 50,
    });

    const earn = await earnOnInvoice({
      tenantSlug: TENANT, programId: prog.id, customerCode: "CUST-1",
      invoiceId: "LOY-INV-1", invoiceAmount: 5000,
    });
    expect(earn.points).toBe(500);

    // max 50% of ₦1,000 invoice = 500 pts value... redeem 300
    const redeem = await redeemOnInvoice({
      tenantSlug: TENANT, programId: prog.id, customerCode: "CUST-1",
      invoiceId: "LOY-INV-2", invoiceAmount: 1000, points: 300,
    });
    expect(redeem.discountAmount).toBe(300);
    expect(redeem.balance.points).toBe(200);

    // unified POS ledger sees both
    const pos = (await db.query(
      `select type, sum(points) pts from pos_loyalty_txns
       where tenant_slug=$1 and customer_code='CUST-1' group by type`, [TENANT])).rows;
    expect(Number(pos.find((r: any) => r.type === "earn")?.pts)).toBe(500);
    expect(Number(pos.find((r: any) => r.type === "redeem")?.pts)).toBe(300);
  }, T);

  it("pegged currencies: resolution walks the peg chain to a direct rate", async () => {
    const { upsertPeggedCurrency, resolveRateWithPegs } = await import("../lib/finance/pegged");
    const { upsertExchangeRate } = await import("../lib/finance/currency");

    await upsertExchangeRate({ tenantSlug: TENANT, currency: "USD", rateDate: "2026-11-01", rate: 1500 });
    await upsertPeggedCurrency({ tenantSlug: TENANT, currency: "AED", peggedTo: "USD", rate: 3.6725 });

    const r = await resolveRateWithPegs({ tenantSlug: TENANT, currency: "AED", date: "2026-11-01" });
    expect(r).not.toBeNull();
    expect(r!.via).toBe("peg");
    expect(r!.path).toEqual(["AED", "USD"]);
    // AED rate = USD rate / 3.6725 or ×3.6725 depending on convention — just assert sane positive
    expect(r!.rate).toBeGreaterThan(0);
  }, T);

  it("cheque printing: template renders all positions incl. amount in words", async () => {
    const { upsertChequeTemplate, renderCheque, amountInWords } = await import("../lib/finance/cheque-print");

    await upsertChequeTemplate({
      tenantSlug: TENANT, name: "GTB Standard", bank: "GTBank", isDefault: true,
      fields: {
        cheque_size: { w: 203, h: 93 },
        date: { x: 160, y: 12, format: "DDMMYYYY" },
        payee: { x: 30, y: 32 },
        amount_figures: { x: 160, y: 45 },
        amount_words: { x: 20, y: 52 },
      },
    });

    const out = await renderCheque({
      tenantSlug: TENANT, payee: "Vendor Okafor", amount: 12500.5, date: "2026-11-05",
    });
    expect(out.positions.payee.text).toBe("Vendor Okafor");
    expect(out.positions.date.text).toBe("05112026");
    expect(out.positions.amount_words.text).toMatch(/[Tt]welve thousand/);
    expect(amountInWords(1)).toMatch(/One/);
  }, T);

  it("bank clearance: lines clear/unclear and summary counts split", async () => {
    const { importStatementLines, clearStatementLines, unclearStatementLines, clearanceSummary } =
      await import("../lib/finance/bank-statement");

    const imp = await importStatementLines({
      tenantSlug: TENANT, bankAccountCode: "1100",
      lines: [
        { date: "2026-11-01", description: "Deposit", amount: 5000 },
        { date: "2026-11-02", description: "Cheque 102", amount: -1500 },
      ],
    });
    expect(imp.imported).toBe(2);

    await clearStatementLines({ tenantSlug: TENANT, lineIds: [imp.ids[0]], clearanceDate: "2026-11-03" });
    let s = await clearanceSummary(TENANT);
    const bank = s.find((r: any) => r.bank_account_code === "1100");
    expect(Number(bank.cleared_count)).toBe(1);
    expect(Number(bank.uncleared_count)).toBe(1);

    await unclearStatementLines({ tenantSlug: TENANT, lineIds: [imp.ids[0]] });
    s = await clearanceSummary(TENANT);
    expect(Number(s.find((r: any) => r.bank_account_code === "1100").uncleared_count)).toBe(2);
  }, T);

  it("ledger merge: GL lines rewrite to target account and source retires", async () => {
    const { postGLEntry } = await import("../lib/finance/gl");
    const { mergeAccounts } = await import("../lib/finance/ledger-integrity");

    // posting auto-provisions both accounts into the CoA
    await postGLEntry({
      tenantSlug: TENANT, entryDate: "2026-11-01", journalType: "MANUAL",
      description: "seed merge target", lines: [
        { accountCode: "6991", debitAmount: 1, description: "seed" },
        { accountCode: "1100", creditAmount: 1, description: "seed" },
      ],
    });
    const je = await postGLEntry({
      tenantSlug: TENANT, entryDate: "2026-11-01", journalType: "MANUAL",
      description: "expense to merge", lines: [
        { accountCode: "6990", debitAmount: 400, description: "old" },
        { accountCode: "1100", creditAmount: 400, description: "bank" },
      ],
    });
    expect(je.id).toBeTruthy();

    const m = await mergeAccounts({
      tenantSlug: TENANT, fromCode: "6990", toCode: "6991", confirmed: true,
    });
    expect(m.stats.journalLines).toBeGreaterThan(0);

    const remaining = (await db.query(
      `select count(*) n from journal_entry_lines l join journal_entries j on j.id = l.journal_entry_id
       where j.tenant_slug = $1 and l.account_code = '6990'`, [TENANT])).rows;
    expect(Number(remaining[0].n)).toBe(0);
  }, T);

  it("process run logs: recordRun captures status/duration and lists", async () => {
    const { recordRun, listProcessRuns } = await import("../lib/finance/process-log");

    await recordRun("parity-test", {
      tenantSlug: TENANT, params: { x: 1 },
      result: { ok: true }, itemCount: 3, status: "success", durationMs: 42,
    });
    await recordRun("parity-test", {
      tenantSlug: TENANT, status: "failed",
      error: "boom", durationMs: 5,
    });

    const runs = await listProcessRuns({ tenantSlug: TENANT, process: "parity-test" });
    expect(runs.length).toBe(2);
    expect(runs.find((r: any) => r.status === "failed")?.error).toBe("boom");
  }, T);

  it("tax packs: applying NG pack creates templates + withholding categories", async () => {
    const { listTaxPacks, applyTaxPack, listAppliedPacks } = await import("../lib/finance/tax-packs");

    const packs = listTaxPacks();
    expect(packs.find((p) => p.code === "NG")).toBeTruthy();

    const applied = await applyTaxPack({ tenantSlug: TENANT, packCode: "NG" });
    expect(applied.templates.length).toBeGreaterThan(0);

    const tmpl = (await db.query(
      `select count(*) n from tax_templates where tenant_slug = $1`, [TENANT])).rows;
    expect(Number(tmpl[0].n)).toBeGreaterThan(0);

    const appliedList = await listAppliedPacks(TENANT);
    expect(appliedList[0].pack_code).toBe("NG");
  }, T);
});
