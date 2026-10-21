import { randomUUID } from "crypto";

import { db, sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { postGLEntry, GL_ACCOUNTS } from "./gl";

// ---------------------------------------------------------------------------
// Bank statement import + auto-matching. Statement lines are matched to
// finance_payments and bank-side GL lines by amount and date window.
// Unmatched bank-side items (charges, interest) can be posted as JEs.
// ---------------------------------------------------------------------------

export function ensureBankStatementTables() {
  return ensureOnce("finance/bankstmt:ensureTables", ensureBankStatementTablesRun);
}

async function ensureBankStatementTablesRun() {
  const sql = SQL;
  await sql`create table if not exists bank_statement_lines (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    bank_account_code text not null,
    line_date date not null,
    description text,
    reference text,
    amount numeric not null,
    status text not null default 'unmatched',
    matched_entity text,
    matched_id text,
    journal_entry_id uuid,
    reconciliation_id text,
    created_at timestamptz not null default now()
  )`;
  await sql`create index if not exists bank_stmt_lines_idx
    on bank_statement_lines (tenant_slug, bank_account_code, line_date)`;
  await sql`create index if not exists bank_stmt_lines_status_idx
    on bank_statement_lines (tenant_slug, status)`;
  await sql`alter table bank_statement_lines add column if not exists clearance_date date`;
  await sql`alter table bank_statement_lines add column if not exists cleared boolean not null default false`;
}

export type StatementLineInput = {
  date: string;
  description?: string;
  reference?: string;
  amount: number;           // + deposit, - withdrawal
};

export async function importStatementLines(input: {
  tenantSlug: string;
  bankAccountCode: string;
  lines: StatementLineInput[];
}) {
  await ensureBankStatementTables();
  const inserted: string[] = [];
  for (const l of input.lines) {
    const id = randomUUID();
    await db.query(
      `insert into bank_statement_lines (id, tenant_slug, bank_account_code,
         line_date, description, reference, amount)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [id, input.tenantSlug, input.bankAccountCode, l.date,
       l.description ?? null, l.reference ?? null, l.amount]
    );
    inserted.push(id);
  }
  return { imported: inserted.length, ids: inserted };
}

export async function listStatementLines(input: {
  tenantSlug: string;
  bankAccountCode?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}) {
  await ensureBankStatementTables();
  const params: any[] = [input.tenantSlug];
  const conds: string[] = ["tenant_slug = $1"];
  if (input.bankAccountCode) { params.push(input.bankAccountCode); conds.push(`bank_account_code = $${params.length}`); }
  if (input.status) { params.push(input.status); conds.push(`status = $${params.length}`); }
  if (input.startDate) { params.push(input.startDate); conds.push(`line_date >= $${params.length}`); }
  if (input.endDate) { params.push(input.endDate); conds.push(`line_date <= $${params.length}`); }
  return (await db.query<any>(
    `select * from bank_statement_lines where ${conds.join(" and ")}
     order by line_date, created_at`,
    params
  )).rows;
}

const MATCH_WINDOW_DAYS = 4;
const MATCH_TOLERANCE = 0.005; // absolute naira tolerance

// Auto-match unmatched lines against finance_payments and bank-side GL lines.
export async function autoMatch(input: {
  tenantSlug: string;
  bankAccountCode: string;
  windowDays?: number;
}) {
  await ensureBankStatementTables();
  const window = input.windowDays ?? MATCH_WINDOW_DAYS;
  const lines = await listStatementLines({
    tenantSlug: input.tenantSlug,
    bankAccountCode: input.bankAccountCode,
    status: "unmatched",
  });

  let matched = 0;
  for (const line of lines) {
    const amt = Number(line.amount);
    const date = (line.line_date instanceof Date
      ? line.line_date.toISOString() : String(line.line_date)).slice(0, 10);
    const d = new Date(date);
    const from = new Date(d.getTime() - window * 86400000).toISOString().slice(0, 10);
    const to = new Date(d.getTime() + window * 86400000).toISOString().slice(0, 10);

    // 1. Deposits: match successful finance payments (net_amount / gross).
    if (amt > 0) {
      const pays = (await db.query<any>(
        `select id, reference, net_amount::float, gross_amount::float, payment_date::date d
         from finance_payments
         where tenant_slug = $1 and status = 'successful'
           and payment_date between $2 and $5
           and (abs(net_amount - $3) < $4 or abs(gross_amount - $3) < $4)
         order by payment_date limit 1`,
        [input.tenantSlug, from, amt, MATCH_TOLERANCE, to]
      )).rows;
      if (pays.length) {
        await db.query(
          `update bank_statement_lines set status='matched',
             matched_entity='finance_payment', matched_id=$1 where id=$2`,
          [pays[0].id, line.id]
        );
        matched++;
        continue;
      }
    }

    // 2. Either direction: match bank-side GL lines on this account.
    const gl = (await db.query<any>(
      `select jel.id::text as line_id, je.id as entry_id,
              coalesce(je.journal_number, je.entry_number) as jnum,
              coalesce(jel.debit_amount, jel.debit, 0)::float as dr,
              coalesce(jel.credit_amount, jel.credit, 0)::float as cr
       from journal_entry_lines jel
       join journal_entries je
         on je.id = coalesce(jel.journal_entry_id, jel.entry_id)
       join chart_of_accounts coa
         on (jel.account_id is not null and coa.id::text = jel.account_id::text)
            or (jel.account_id is null
                and (coa.account_code = jel.account_code or coa.code = jel.account_code)
                and (coa.tenant_slug = je.tenant_slug or coa.tenant_slug is null))
       where je.tenant_slug = $1 and (coa.account_code = $2 or coa.code = $2)
         and coalesce(je.approval_status, je.status, 'POSTED') not in ('DRAFT','REJECTED')
         and je.entry_date between $3 and $6
         and ($4 > 0 and abs(coalesce(jel.debit_amount, jel.debit, 0) - $4) < $5
              or $4 < 0 and abs(coalesce(jel.credit_amount, jel.credit, 0) + $4) < $5)
       limit 1`,
      [input.tenantSlug, input.bankAccountCode, from, amt, MATCH_TOLERANCE, to]
    )).rows;
    if (gl.length) {
      await db.query(
        `update bank_statement_lines set status='matched',
           matched_entity='journal_entry_line', matched_id=$1,
           journal_entry_id=$2 where id=$3`,
        [gl[0].line_id, gl[0].entry_id, line.id]
      );
      matched++;
    }
  }
  return { examined: lines.length, matched };
}

// Post an unmatched bank-side line as a JE (bank charge, interest, or
// miscellaneous entry). kind: 'bank_charge' | 'interest' | 'manual'.
export async function postStatementLine(input: {
  tenantSlug: string;
  lineId: string;
  kind: "bank_charge" | "interest" | "manual";
  expenseAccountCode?: string;
  description?: string;
  userId?: string;
}) {
  await ensureBankStatementTables();
  const line = (await db.query<any>(
    `select * from bank_statement_lines where id = $1 and tenant_slug = $2`,
    [input.lineId, input.tenantSlug]
  )).rows[0];
  if (!line) throw new Error(`Statement line ${input.lineId} not found`);
  if (line.status !== "unmatched")
    throw new Error(`Statement line is ${line.status}`);
  const amt = Number(line.amount);
  const bank = line.bank_account_code;

  let glLines;
  if (input.kind === "bank_charge" || (input.kind === "manual" && amt < 0)) {
    const abs = Math.abs(amt);
    glLines = [
      { accountCode: input.expenseAccountCode ?? GL_ACCOUNTS.BANK_CHARGES,
        debitAmount: abs, description: input.description ?? line.description },
      { accountCode: bank, creditAmount: abs, description: "Bank charge" },
    ];
  } else {
    glLines = [
      { accountCode: bank, debitAmount: amt, description: input.description ?? line.description },
      { accountCode: input.expenseAccountCode ?? GL_ACCOUNTS.INTEREST_INCOME,
        creditAmount: amt, description: input.kind === "interest" ? "Bank interest" : "Miscellaneous" },
    ];
  }

  const je = await postGLEntry({
    tenantSlug: input.tenantSlug,
    entryDate: (line.line_date instanceof Date
      ? line.line_date.toISOString() : String(line.line_date)).slice(0, 10),
    journalType: "SYSTEM",
    referenceType: "bank_statement_line",
    referenceId: line.id,
    description: input.description ?? `Bank statement: ${line.description ?? input.kind}`,
    createdBy: input.userId,
    lines: glLines,
  });

  await db.query(
    `update bank_statement_lines set status='posted', journal_entry_id=$1 where id=$2`,
    [je.id, line.id]
  );
  return { journalEntryId: je.id, journalNumber: je.journalNumber };
}

// Manually match a line to a finance payment or journal entry line — used
// when the auto-matcher can't (amount off beyond tolerance, out of window).
export async function matchStatementLine(input: {
  tenantSlug: string;
  lineId: string;
  matchedEntity: "finance_payment" | "journal_entry_line";
  matchedId: string;
}) {
  await ensureBankStatementTables();
  const line = (await db.query<any>(
    `select * from bank_statement_lines where id = $1 and tenant_slug = $2`,
    [input.lineId, input.tenantSlug]
  )).rows[0];
  if (!line) throw new Error(`Statement line ${input.lineId} not found`);
  if (line.status !== "unmatched")
    throw new Error(`Statement line is ${line.status} — unmatch it first`);

  let journalEntryId: string | null = null;
  if (input.matchedEntity === "finance_payment") {
    const pay = (await db.query<any>(
      `select id from finance_payments where id = $1 and tenant_slug = $2 and status = 'successful'`,
      [input.matchedId, input.tenantSlug]
    )).rows[0];
    if (!pay) throw new Error("Payment not found or not successful");
  } else {
    const jel = (await db.query<any>(
      `select jel.id::text as line_id, je.id as entry_id
       from journal_entry_lines jel
       join journal_entries je on je.id = coalesce(jel.journal_entry_id, jel.entry_id)
       where jel.id = $1 and je.tenant_slug = $2`,
      [input.matchedId, input.tenantSlug]
    )).rows[0];
    if (!jel) throw new Error("Journal entry line not found");
    journalEntryId = jel.entry_id;
  }

  await db.query(
    `update bank_statement_lines set status='matched',
       matched_entity=$1, matched_id=$2, journal_entry_id=$3 where id=$4`,
    [input.matchedEntity, input.matchedId, journalEntryId, line.id]
  );
  return { ok: true };
}

export async function unmatchStatementLine(tenantSlug: string, lineId: string) {
  await ensureBankStatementTables();
  await db.query(
    `update bank_statement_lines set status='unmatched', matched_entity=null,
       matched_id=null, journal_entry_id=null
     where id=$1 and tenant_slug=$2 and status='matched'`,
    [lineId, tenantSlug]
  );
}

export async function ignoreStatementLine(tenantSlug: string, lineId: string) {
  await ensureBankStatementTables();
  await db.query(
    `update bank_statement_lines set status='ignored' where id=$1 and tenant_slug=$2`,
    [lineId, tenantSlug]
  );
}

/**
 * Bank clearance — mark statement lines as cleared against the bank's records.
 * ERPNext Bank Clearance: a line is "cleared" once it appears on the bank's
 * own statement; unclearing reverses the flag. Independent of matching —
 * matching links a line to our books, clearance confirms it hit the bank.
 */
export async function clearStatementLines(input: {
  tenantSlug: string; lineIds: string[]; clearanceDate?: string;
}) {
  await ensureBankStatementTables();
  const date = input.clearanceDate ?? new Date().toISOString().slice(0, 10);
  await db.query(
    `update bank_statement_lines set cleared = true, clearance_date = $3
     where tenant_slug = $1 and id = any($2)`,
    [input.tenantSlug, input.lineIds, date],
  );
  return { cleared: input.lineIds.length, clearanceDate: date };
}

export async function unclearStatementLines(input: { tenantSlug: string; lineIds: string[] }) {
  await ensureBankStatementTables();
  await db.query(
    `update bank_statement_lines set cleared = false, clearance_date = null
     where tenant_slug = $1 and id = any($2)`,
    [input.tenantSlug, input.lineIds],
  );
  return { uncleared: input.lineIds.length };
}

/** Bank clearance report: matched-but-uncleared vs cleared per account. */
export async function clearanceSummary(tenantSlug: string, bankAccountCode?: string) {
  await ensureBankStatementTables();
  const cond = bankAccountCode ? "and bank_account_code = $2" : "";
  const params = bankAccountCode ? [tenantSlug, bankAccountCode] : [tenantSlug];
  return (await db.query<any>(
    `select bank_account_code,
            count(*) filter (where cleared)::int cleared_count,
            sum(amount) filter (where cleared)::float cleared_amount,
            count(*) filter (where not cleared)::int uncleared_count,
            sum(amount) filter (where not cleared)::float uncleared_amount
     from bank_statement_lines where tenant_slug = $1 ${cond}
     group by bank_account_code order by bank_account_code`,
    params
  )).rows;
}

export async function statementSummary(tenantSlug: string, bankAccountCode?: string) {
  await ensureBankStatementTables();
  const cond = bankAccountCode ? "and bank_account_code = $2" : "";
  const params = bankAccountCode ? [tenantSlug, bankAccountCode] : [tenantSlug];
  const rows = (await db.query<any>(
    `select status, count(*)::int n, sum(amount)::float total
     from bank_statement_lines where tenant_slug = $1 ${cond} group by status`,
    params
  )).rows;
  return rows;
}
