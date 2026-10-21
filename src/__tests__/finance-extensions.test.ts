import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { db } from "@/lib/sql-client";

const TENANT = `__fxtest_${Date.now()}__`;

async function cleanup() {
  await db.query(`delete from journal_entry_lines where entry_id in (select id from journal_entries where tenant_slug = $1)`, [TENANT]);
  await db.query(`delete from journal_entries where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from account_balances where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from fiscal_periods where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from journal_sequences where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from accounting_audit_log where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from staff_advance_applications where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from staff_advances where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from imprest_transactions where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from imprest_funds where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from invoice_payment_schedule where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from dunning_notices where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from finance_customers where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from payment_terms where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from bank_statement_lines where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from chart_of_accounts where tenant_slug = $1`, [TENANT]);
}
beforeAll(cleanup, 120000);
afterAll(cleanup, 120000);

const T = 300000;

describe.skipIf(!process.env.DATABASE_URL)("finance extensions", () => {
  it("imprest fund: replenish -> disburse -> petty cash book balances", async () => {
    const { createFund, replenishFund, disburseFund, pettyCashBook, getFund } =
      await import("@/lib/finance/imprest");

    const fund = await createFund({
      tenantSlug: TENANT, name: "HQ Petty Cash", custodian: "Ada",
      floatAmount: 500,
    });
    expect(fund.id).toBeTruthy();

    const rep = await replenishFund({
      tenantSlug: TENANT, fundId: fund.id, txnDate: "2026-11-01",
    });
    expect(rep.amount).toBe(500);
    expect(rep.journalEntryId).toBeTruthy();

    const dis = await disburseFund({
      tenantSlug: TENANT, fundId: fund.id, txnDate: "2026-11-02",
      amount: 120, expenseAccountCode: "6100", description: "Taxi",
    });
    expect(dis.journalEntryId).toBeTruthy();

    const after = await getFund(TENANT, fund.id);
    expect(after.balance).toBe(380);

    const book = await pettyCashBook(TENANT, fund.id);
    expect(book.closingBalance).toBe(380);
    expect(book.lines.length).toBe(2);

    // Overdraft is rejected
    await expect(disburseFund({
      tenantSlug: TENANT, fundId: fund.id, txnDate: "2026-11-03",
      amount: 1000, expenseAccountCode: "6100",
    })).rejects.toThrow(/balance/i);
  }, T);

  it("staff advance: issue -> apply -> refund -> settled", async () => {
    const { createFund, replenishFund, issueAdvance, applyAdvance, refundAdvance, getAdvance } =
      await import("@/lib/finance/imprest");

    const fund = await createFund({
      tenantSlug: TENANT, name: "Field Fund", floatAmount: 300,
    });
    await replenishFund({ tenantSlug: TENANT, fundId: fund.id, txnDate: "2026-11-01" });

    const adv = await issueAdvance({
      tenantSlug: TENANT, employeeName: "Emeka", fundId: fund.id,
      amount: 200, purpose: "Travel", issueDate: "2026-11-02",
    });
    let row = await getAdvance(TENANT, adv.id);
    expect(row.outstanding).toBe(200);

    const app = await applyAdvance({
      tenantSlug: TENANT, advanceId: adv.id, amount: 150,
      expenseAccountCode: "6010", entryDate: "2026-11-05",
    });
    expect(app.status).toBe("partially_settled");

    const ref = await refundAdvance({
      tenantSlug: TENANT, advanceId: adv.id, amount: 50,
      fundId: fund.id, entryDate: "2026-11-06",
    });
    expect(ref.status).toBe("refunded");

    row = await getAdvance(TENANT, adv.id);
    expect(row.outstanding).toBe(0);
    expect(row.status).toBe("refunded");
  }, T);

  it("payment terms schedule + credit limit + dunning + customer statement", async () => {
    const { createPaymentTerm, buildInvoiceSchedule, getInvoiceSchedule,
      upsertCustomer, assertCreditAvailable, issueDunningNotice,
      customerStatement } = await import("@/lib/finance/credit-control");
    const { insertFinanceInvoice } = await import("@/lib/finance/db");

    const term = await createPaymentTerm({
      tenantSlug: TENANT, name: "30/70",
      terms: [{ days: 0, portion: 30 }, { days: 30, portion: 70 }],
    });

    // Credit limit enforcement
    await upsertCustomer({
      tenantSlug: TENANT, customerCode: "C-ACME", name: "Acme",
      creditLimit: 100,
    });
    await expect(
      assertCreditAvailable(TENANT, "C-ACME", 50)
    ).resolves.toBeTruthy();
    await expect(
      assertCreditAvailable(TENANT, "C-ACME", 200)
    ).rejects.toThrow(/credit limit/i);

    // Dunning needs a real overdue invoice (50 < credit limit 100 -> allowed)
    const inv = await insertFinanceInvoice({
      tenantSlug: TENANT, customerName: "Acme", customerCode: "C-ACME",
      invoiceNumber: "INV-DUN", issuedDate: "2026-09-01",
      dueDate: "2026-09-15", currency: "NGN",
      status: "sent",
      lineItems: [{ description: "Work", quantity: 1, unitPrice: 50, amount: 50 }],
      amount: 50, balanceDue: 50,
    } as any);

    // Term template produces a two-part schedule for the issued invoice
    await db.query(`delete from invoice_payment_schedule where invoice_id = $1`, [inv.id]);
    const sched = await buildInvoiceSchedule({
      tenantSlug: TENANT, invoiceId: inv.id, issueDate: "2026-09-01",
      amount: 50, paymentTermId: term.id,
    });
    expect(sched.length).toBe(2);
    expect(sched[0].amount).toBe(15);
    expect(sched[1].amount).toBe(35);

    const d = await issueDunningNotice({
      tenantSlug: TENANT, invoiceId: inv.id, issueDate: "2026-10-20",
      feeAmount: 5,
    });
    expect(d.level).toBeGreaterThanOrEqual(1);
    expect(d.journalEntryId).toBeTruthy(); // fee posted to GL

    // Customer statement picks up the customer party lines
    const stmt = await customerStatement({
      tenantSlug: TENANT, customerCode: "C-ACME",
    });
    expect(stmt.lines.length).toBeGreaterThan(0);

    await db.query(`delete from invoice_payment_schedule where invoice_id = $1`, [inv.id]);
    await db.query(`delete from dunning_notices where invoice_id = $1`, [inv.id]);
    await db.query(`delete from finance_invoice_lines where invoice_id = $1`, [inv.id]);
    await db.query(`delete from finance_invoices where id = $1`, [inv.id]);
  }, T);

  it("bank statement import + auto-match against a GL receipt", async () => {
    const { postGLEntry, GL_ACCOUNTS } = await import("@/lib/finance/gl");
    const { importStatementLines, autoMatch, statementSummary } =
      await import("@/lib/finance/bank-statement");

    // A bank-side GL receipt exists already
    await postGLEntry({
      tenantSlug: TENANT, entryDate: "2026-11-03",
      description: "Customer receipt",
      lines: [
        { accountCode: GL_ACCOUNTS.BANK, debitAmount: 750 },
        { accountCode: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE, creditAmount: 750 },
      ],
    });

    const { imported } = await importStatementLines({
      tenantSlug: TENANT, bankAccountCode: "1100",
      lines: [
        { date: "2026-11-03", description: "NIP CR ACME", amount: 750 },
        { date: "2026-11-04", description: "BANK CHG", amount: -25 },
      ],
    });
    expect(imported).toBe(2);

    const m = await autoMatch({ tenantSlug: TENANT, bankAccountCode: "1100" });
    expect(m.matched).toBe(1);

    const summary = await statementSummary(TENANT, "1100");
    const unmatched = summary.find((s: any) => s.status === "unmatched");
    expect(unmatched.n).toBe(1); // the bank charge remains
  }, T);

  it("payment request -> callback posts AR receipt with fx gain/loss", async () => {
    const { insertFinanceInvoice, receiveInvoicePayment } = await import("@/lib/finance/db");
    const { createPaymentRequest, handlePaymentCallback } = await import("@/lib/finance/gateway");

    const inv = await insertFinanceInvoice({
      tenantSlug: TENANT, customerName: "Acme", customerCode: "C-ACME2",
      invoiceNumber: "INV-GW", issuedDate: "2026-11-01",
      dueDate: "2026-11-30", currency: "NGN", status: "sent",
      lineItems: [{ description: "Service", quantity: 1, unitPrice: 400, amount: 400 }],
      amount: 400, balanceDue: 400,
    } as any);

    const req = await createPaymentRequest({
      tenantSlug: TENANT, invoiceId: inv.id, provider: "paystack",
    });
    expect(req.reference).toMatch(/^PR-/);
    expect(req.linkUrl).toBeTruthy();

    const cb = await handlePaymentCallback({
      tenantSlug: TENANT, provider: "paystack", reference: req.reference,
      status: "paid", paidAmount: 400, paymentDate: "2026-11-10",
    });
    expect(cb.status).toBe("paid");
    expect((cb as any).invoice.status).toBe("paid");

    // Idempotent replay
    const replay = await handlePaymentCallback({
      tenantSlug: TENANT, provider: "paystack", reference: req.reference,
      status: "paid", paymentDate: "2026-11-10",
    });
    expect(replay.alreadyProcessed).toBe(true);

    // FX: foreign invoice settled at different rate -> gain/loss line
    const fxInv = await insertFinanceInvoice({
      tenantSlug: TENANT, customerName: "Globex", customerCode: "C-GLX",
      invoiceNumber: "INV-FX", issuedDate: "2026-11-01",
      dueDate: "2026-11-30", currency: "NGN", status: "sent",
      lineItems: [{ description: "Goods", quantity: 1, unitPrice: 100, amount: 100 }],
      amount: 100, balanceDue: 100,
    } as any);
    await receiveInvoicePayment({
      tenantSlug: TENANT, invoiceId: fxInv.id, amount: 105,
      method: "bank_transfer", paymentDate: "2026-11-10",
      allocations: [{ invoiceId: fxInv.id, amount: 105, settledAmount: 100 }],
      transactionCurrency: "USD", exchangeRate: 1600,
    });
    const fxLines = (await db.query<any>(
      `select jel.* from journal_entry_lines jel
       join journal_entries je on je.id = coalesce(jel.journal_entry_id, jel.entry_id)
       where je.tenant_slug = $1 and jel.account_code = '7700'`,
      [TENANT]
    )).rows;
    expect(fxLines.length).toBe(1);
    expect(Number(fxLines[0].credit_amount ?? fxLines[0].credit)).toBe(5);

    // Cleanup: dependents before invoices (FK order)
    await db.query(`delete from payment_requests where tenant_slug = $1`, [TENANT]);
    await db.query(`delete from payment_applications where tenant_slug = $1`, [TENANT]);
    await db.query(`delete from finance_payments where tenant_slug = $1`, [TENANT]);
    await db.query(`delete from invoice_payment_schedule where tenant_slug = $1`, [TENANT]);
    await db.query(`delete from dunning_notices where tenant_slug = $1`, [TENANT]);
    await db.query(`delete from finance_invoice_lines where invoice_id in ($1,$2)`, [inv.id, fxInv.id]);
    await db.query(`delete from finance_invoices where id in ($1,$2)`, [inv.id, fxInv.id]);
  }, T);
});
