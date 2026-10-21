import { describe, it, expect, beforeAll, afterAll } from "vitest";

const T = 90000;
import fs from "node:fs";

// Load the Neon URL (commented line in .env.local) so we exercise a real DB
beforeAll(() => {
  const env = fs.readFileSync(".env.local", "utf8");
  const m = env.match(/#\s*DATABASE_URL="([^"]+)"/);
  if (!m) throw new Error("no commented DATABASE_URL");
  process.env.DATABASE_URL = m[1];
});

const TENANT = `__gltest_${Date.now()}__`;

async function cleanup() {
  const { db } = await import("@/lib/sql-client");
  await db.query(`delete from journal_entry_lines where entry_id in (select id from journal_entries where tenant_slug = $1)`, [TENANT]);
  await db.query(`delete from journal_entries where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from account_balances where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from fiscal_periods where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from journal_sequences where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from accounting_audit_log where tenant_slug = $1`, [TENANT]);
}

afterAll(cleanup);

describe.skipIf(!process.env.DATABASE_URL)("canonical GL posting", () => {
  it("posts a balanced entry with sequential numbering, dual columns, balances", async () => {
    const { postGLEntry, GL_ACCOUNTS } = await import("@/lib/finance/gl");
    const { db } = await import("@/lib/sql-client");

    const entry = await postGLEntry({
      tenantSlug: TENANT,
      entryDate: "2026-10-15",
      journalType: "SYSTEM",
      referenceType: "bill",
      referenceId: "test-bill-1",
      description: "Test bill posting",
      lines: [
        { accountCode: GL_ACCOUNTS.GENERAL_EXPENSE, debitAmount: 500, creditAmount: 0, description: "expense" },
        { accountCode: GL_ACCOUNTS.ACCOUNTS_PAYABLE, debitAmount: 0, creditAmount: 500, partyType: "vendor", partyId: "v1" },
      ],
    });

    expect(entry.journalNumber).toMatch(/^JV-2026-\d{5}$/);
    expect(entry.totalDebit).toBe(500);

    const rows = (await db.query<any>(
      `select * from journal_entries where id = $1`, [entry.id]
    )).rows;
    expect(rows[0].journal_number).toBe(entry.journalNumber);
    expect(rows[0].entry_number).toBe(entry.journalNumber);
    expect(rows[0].approval_status).toBe("POSTED");
    expect(rows[0].status).toBe("posted");
    expect(rows[0].fiscal_period_id).toBeTruthy();

    const lines = (await db.query<any>(
      `select * from journal_entry_lines where entry_id = $1 order by line_number`, [entry.id]
    )).rows;
    expect(lines).toHaveLength(2);
    expect(lines[0].account_code).toBe("6100");
    expect(lines[0].account_id).toBeTruthy();
    expect(lines[0].journal_entry_id).toBe(entry.id);
    expect(Number(lines[0].debit)).toBe(500);
    expect(Number(lines[1].credit_amount)).toBe(500);
    expect(lines[1].party_type).toBe("vendor");

    const bal = (await db.query<any>(
      `select * from account_balances ab
       join journal_entries je on je.fiscal_period_id = ab.fiscal_period_id
       where je.id = $1 and ab.account_id = $2`,
      [entry.id, lines[1].account_id]
    )).rows;
    expect(bal).toHaveLength(1);
    expect(Number(bal[0].period_credit)).toBe(500);
  }, T);

  it("rejects unbalanced entries", async () => {
    const { postGLEntry } = await import("@/lib/finance/gl");
    await expect(
      postGLEntry({
        tenantSlug: TENANT,
        entryDate: "2026-10-15",
        description: "bad",
        lines: [{ accountCode: "6100", debitAmount: 100 }, { accountCode: "2100", creditAmount: 50 }],
      })
    ).rejects.toThrow(/balance/i);
  }, T);

  it("reverses an entry and marks the original", async () => {
    const { postGLEntry, reverseGLEntry, GL_ACCOUNTS } = await import("@/lib/finance/gl");
    const { db } = await import("@/lib/sql-client");

    const entry = await postGLEntry({
      tenantSlug: TENANT,
      entryDate: "2026-10-16",
      description: "to reverse",
      lines: [
        { accountCode: GL_ACCOUNTS.BANK, debitAmount: 200 },
        { accountCode: GL_ACCOUNTS.SALES_REVENUE, creditAmount: 200 },
      ],
    });

    const rev = await reverseGLEntry(entry.id, "test reversal", "tester");
    expect(rev.journalType).toBe("REVERSING");

    const orig = (await db.query<any>(`select * from journal_entries where id = $1`, [entry.id])).rows[0];
    expect(orig.is_reversing).toBe(true);
    expect(orig.reversed_entry_id).toBe(rev.id);
  }, T);

  it("closes a fiscal period: closing JE to retained earnings, blocks reposting", async () => {
    const { postGLEntry, closeFiscalPeriod, GL_ACCOUNTS } = await import("@/lib/finance/gl");
    const { db } = await import("@/lib/sql-client");

    const e1 = await postGLEntry({
      tenantSlug: TENANT,
      entryDate: "2026-11-10",
      description: "revenue",
      lines: [
        { accountCode: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE, debitAmount: 1000 },
        { accountCode: GL_ACCOUNTS.SALES_REVENUE, creditAmount: 1000 },
      ],
    });
    await postGLEntry({
      tenantSlug: TENANT,
      entryDate: "2026-11-12",
      description: "expense",
      lines: [
        { accountCode: GL_ACCOUNTS.GENERAL_EXPENSE, debitAmount: 300 },
        { accountCode: GL_ACCOUNTS.ACCOUNTS_PAYABLE, creditAmount: 300 },
      ],
    });

    const result = await closeFiscalPeriod(e1.fiscalPeriodId!, "tester");
    expect(result.closingEntryId).toBeTruthy();

    const closing = (await db.query<any>(
      `select je.*, jel.account_code, jel.debit_amount, jel.credit_amount
       from journal_entries je join journal_entry_lines jel on jel.entry_id = je.id
       where je.id = $1`, [result.closingEntryId]
    )).rows;
    const re = closing.find((l: any) => l.account_code === "3100");
    expect(re).toBeTruthy();
    // Net income 700 => retained earnings credited 700
    expect(Number(re.credit_amount)).toBe(700);

    const period = (await db.query<any>(`select * from fiscal_periods where id = $1`, [e1.fiscalPeriodId])).rows[0];
    expect(period.status).toBe("closed");

    await expect(
      postGLEntry({
        tenantSlug: TENANT,
        entryDate: "2026-11-15",
        description: "should fail",
        lines: [
          { accountCode: GL_ACCOUNTS.BANK, debitAmount: 10 },
          { accountCode: GL_ACCOUNTS.SALES_REVENUE, creditAmount: 10 },
        ],
      })
    ).rejects.toThrow(/closed/i);
  }, T);
});
