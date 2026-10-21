import { describe, it, expect, beforeAll, afterAll } from "vitest";
import process from "node:process";

const T = 120000;
const TENANT = `test-bankstmt-${Date.now()}`;
let db: any;

async function cleanup() {
  await db.query(`delete from bank_statement_lines where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from finance_payments where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from finance_invoice_lines where invoice_id in (select id from finance_invoices where tenant_slug = $1)`, [TENANT]);
  await db.query(`delete from finance_invoices where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from journal_entry_lines where journal_entry_id in (select id from journal_entries where tenant_slug = $1)`, [TENANT]);
  await db.query(`delete from journal_entry_lines where entry_id in (select id from journal_entries where tenant_slug = $1)`, [TENANT]);
  await db.query(`delete from journal_entries where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from tenants where slug = $1`, [TENANT]);
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  db = (await import("../lib/sql-client")).db;
  await cleanup();
  await db.query(
    `insert into tenants (name, slug, settings, seats) values ($1, $2, '{}'::jsonb, 1) on conflict (slug) do nothing`,
    ["Bank Stmt", TENANT]
  );
  const { ensureBankStatementTables } = await import("../lib/finance/bank-statement");
  await ensureBankStatementTables();
}, T);

afterAll(async () => { if (db) await cleanup(); }, T);

describe("bank statement import & matching", () => {
  it("imports lines and reports summary by status", async () => {
    const { importStatementLines, statementSummary, listStatementLines } = await import("../lib/finance/bank-statement");
    const out = await importStatementLines({
      tenantSlug: TENANT, bankAccountCode: "1100",
      lines: [
        { date: "2026-11-01", description: "Deposit", amount: 50000 },
        { date: "2026-11-02", description: "Bank charge", amount: -500 },
      ],
    });
    expect(out.imported).toBe(2);
    const lines = await listStatementLines({ tenantSlug: TENANT, bankAccountCode: "1100" });
    expect(lines).toHaveLength(2);
    const summary = await statementSummary(TENANT, "1100");
    expect(summary.find((s: any) => s.status === "unmatched")?.n).toBe(2);
  }, T);

  it("auto-match links a deposit line to a successful payment", async () => {
    const { importStatementLines, autoMatch } = await import("../lib/finance/bank-statement");
    const { createPayment } = await import("../lib/finance/db");
    await createPayment({
      tenantSlug: TENANT, reference: "PAY-AM-1", grossAmount: 25000, fees: 0,
      method: "bank_transfer", paymentDate: "2026-11-03",
      confirmationDetails: "t", status: "successful",
    } as any);
    await importStatementLines({
      tenantSlug: TENANT, bankAccountCode: "1100",
      lines: [{ date: "2026-11-03", description: "TRF", amount: 25000 }],
    });
    const out = await autoMatch({ tenantSlug: TENANT, bankAccountCode: "1100" });
    expect(out.matched).toBeGreaterThanOrEqual(1);
    const row = (await db.query(
      `select status, matched_entity from bank_statement_lines
       where tenant_slug=$1 and amount=25000 order by created_at desc limit 1`, [TENANT])).rows[0];
    expect(row.status).toBe("matched");
    expect(row.matched_entity).toBe("finance_payment");
  }, T);

  it("manual match validates targets and unmatch resets the line", async () => {
    const { importStatementLines, matchStatementLine, unmatchStatementLine } = await import("../lib/finance/bank-statement");
    const { createPayment } = await import("../lib/finance/db");
    const pay = await createPayment({
      tenantSlug: TENANT, reference: "PAY-MM-1", grossAmount: 9000, fees: 0,
      method: "bank_transfer", paymentDate: "2026-11-05",
      confirmationDetails: "t", status: "successful",
    } as any);
    const { ids } = await importStatementLines({
      tenantSlug: TENANT, bankAccountCode: "1100",
      lines: [{ date: "2026-11-10", description: "Late deposit", amount: 9000 }],
    });
    const lineId = ids[0];
    // Outside the 4-day auto window — manual match required
    await matchStatementLine({ tenantSlug: TENANT, lineId, matchedEntity: "finance_payment", matchedId: pay.id });
    let row = (await db.query(`select status, matched_id from bank_statement_lines where id=$1`, [lineId])).rows[0];
    expect(row.status).toBe("matched");
    expect(row.matched_id).toBe(pay.id);
    // Can't re-match a matched line
    await expect(matchStatementLine({ tenantSlug: TENANT, lineId, matchedEntity: "finance_payment", matchedId: pay.id }))
      .rejects.toThrow(/matched|unmatch/i);
    // Bogus target rejected
    await unmatchStatementLine(TENANT, lineId);
    row = (await db.query(`select status, matched_id from bank_statement_lines where id=$1`, [lineId])).rows[0];
    expect(row.status).toBe("unmatched");
    await expect(matchStatementLine({ tenantSlug: TENANT, lineId, matchedEntity: "finance_payment", matchedId: "nope" }))
      .rejects.toThrow();
  }, T);

  it("posts an unmatched bank charge as a JE and marks the line posted", async () => {
    const { importStatementLines, postStatementLine } = await import("../lib/finance/bank-statement");
    const { ids } = await importStatementLines({
      tenantSlug: TENANT, bankAccountCode: "1100",
      lines: [{ date: "2026-11-06", description: "SMS alert fee", amount: -50 }],
    });
    const out = await postStatementLine({ tenantSlug: TENANT, lineId: ids[0], kind: "bank_charge" });
    expect(out.journalEntryId).toBeTruthy();
    const row = (await db.query(`select status, journal_entry_id from bank_statement_lines where id=$1`, [ids[0]])).rows[0];
    expect(row.status).toBe("posted");
    const lines = (await db.query(
      `select account_code, debit_amount::float dr, credit_amount::float cr
       from journal_entry_lines where journal_entry_id = $1 or entry_id = $1`, [out.journalEntryId])).rows;
    const charge = lines.find((l: any) => l.account_code === "6810");
    const bank = lines.find((l: any) => l.account_code === "1100");
    expect(charge?.dr).toBe(50);
    expect(bank?.cr).toBe(50);
  }, T);

  it("ignore marks a line without posting", async () => {
    const { importStatementLines, ignoreStatementLine } = await import("../lib/finance/bank-statement");
    const { ids } = await importStatementLines({
      tenantSlug: TENANT, bankAccountCode: "1100",
      lines: [{ date: "2026-11-07", description: "Noise", amount: 1 }],
    });
    await ignoreStatementLine(TENANT, ids[0]);
    const row = (await db.query(`select status, journal_entry_id from bank_statement_lines where id=$1`, [ids[0]])).rows[0];
    expect(row.status).toBe("ignored");
    expect(row.journal_entry_id).toBeNull();
  }, T);
});
