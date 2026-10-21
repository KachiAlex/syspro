import { randomUUID } from "crypto";

import { db, sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { postGLEntry, GL_ACCOUNTS } from "./gl";

// ---------------------------------------------------------------------------
// Imprest / petty-cash funds + staff advances.
// All money movements post through the canonical GL:
//   replenish     Dr petty cash float        Cr bank
//   disburse      Dr expense account          Cr petty cash float
//   advance issue Dr staff advances           Cr petty cash float (or bank)
//   advance apply Dr expense account          Cr staff advances
//   advance refundDr petty cash/bank          Cr staff advances
// ---------------------------------------------------------------------------

export function ensureImprestTables() {
  return ensureOnce("finance/imprest:ensureTables", ensureImprestTablesRun);
}

async function ensureImprestTablesRun() {
  const sql = SQL;
  await sql`create table if not exists imprest_funds (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    name text not null,
    custodian text,
    float_amount numeric not null default 0,
    petty_cash_account_code text not null default '1040',
    bank_account_code text not null default '1110',
    status text not null default 'active',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;
  await sql`create table if not exists imprest_transactions (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    fund_id uuid not null,
    txn_type text not null,
    txn_date date not null,
    amount numeric not null,
    expense_account_code text,
    description text,
    journal_entry_id uuid,
    status text not null default 'posted',
    created_at timestamptz not null default now()
  )`;
  await sql`create table if not exists staff_advances (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    advance_number text not null,
    employee_name text not null,
    employee_id text,
    fund_id uuid,
    amount numeric not null,
    purpose text,
    status text not null default 'issued',
    issue_date date not null,
    journal_entry_id uuid,
    applied_amount numeric not null default 0,
    refunded_amount numeric not null default 0,
    metadata jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;
  await sql`create table if not exists staff_advance_applications (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    advance_id uuid not null,
    expense_id text,
    amount numeric not null,
    journal_entry_id uuid,
    created_at timestamptz not null default now()
  )`;
}

// ---------------------------------------------------------------------------
// Funds
// ---------------------------------------------------------------------------
export type ImprestFund = {
  id: string;
  tenantSlug: string;
  name: string;
  custodian: string | null;
  floatAmount: number;
  pettyCashAccountCode: string;
  bankAccountCode: string;
  status: string;
  balance: number;
};

async function fundBalance(fundId: string): Promise<number> {
  const rows = (await db.query<{ balance: number }>(
    `select coalesce(sum(case when txn_type = 'replenishment' then amount
                              when txn_type = 'adjustment' then amount
                              else -amount end), 0)::float as balance
     from imprest_transactions where fund_id = $1 and status = 'posted'`,
    [fundId]
  )).rows;
  return rows[0]?.balance ?? 0;
}

export async function listFunds(tenantSlug: string): Promise<ImprestFund[]> {
  await ensureImprestTables();
  const funds = (await db.query<any>(
    `select * from imprest_funds where tenant_slug = $1 order by name`,
    [tenantSlug]
  )).rows;
  const out: ImprestFund[] = [];
  for (const f of funds) {
    out.push({
      id: f.id,
      tenantSlug: f.tenant_slug,
      name: f.name,
      custodian: f.custodian,
      floatAmount: Number(f.float_amount),
      pettyCashAccountCode: f.petty_cash_account_code,
      bankAccountCode: f.bank_account_code,
      status: f.status,
      balance: await fundBalance(f.id),
    });
  }
  return out;
}

export async function createFund(input: {
  tenantSlug: string;
  name: string;
  custodian?: string;
  floatAmount: number;
  pettyCashAccountCode?: string;
  bankAccountCode?: string;
}): Promise<ImprestFund> {
  await ensureImprestTables();
  const id = randomUUID();
  await db.query(
    `insert into imprest_funds (id, tenant_slug, name, custodian, float_amount,
       petty_cash_account_code, bank_account_code)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [id, input.tenantSlug, input.name, input.custodian ?? null, input.floatAmount,
     input.pettyCashAccountCode ?? GL_ACCOUNTS.PETTY_CASH,
     input.bankAccountCode ?? GL_ACCOUNTS.BANK]
  );
  const funds = await listFunds(input.tenantSlug);
  return funds.find((f) => f.id === id)!;
}

export async function getFund(tenantSlug: string, fundId: string) {
  const funds = await listFunds(tenantSlug);
  const fund = funds.find((f) => f.id === fundId);
  if (!fund) throw new Error(`Imprest fund ${fundId} not found`);
  return fund;
}

// ---------------------------------------------------------------------------
// Replenishment: Dr petty cash float / Cr bank — tops float back to target.
// ---------------------------------------------------------------------------
export async function replenishFund(input: {
  tenantSlug: string;
  fundId: string;
  txnDate: string;
  amount?: number;               // defaults to topping-up to float_amount
  description?: string;
  userId?: string;
}) {
  await ensureImprestTables();
  const fund = await getFund(input.tenantSlug, input.fundId);
  const amount = input.amount ?? Math.max(0, fund.floatAmount - fund.balance);
  if (amount <= 0) throw new Error("Fund already at or above float amount");

  const je = await postGLEntry({
    tenantSlug: input.tenantSlug,
    entryDate: input.txnDate,
    journalType: "SYSTEM",
    referenceType: "imprest_replenishment",
    referenceId: input.fundId,
    description: input.description ?? `Imprest replenishment: ${fund.name}`,
    createdBy: input.userId,
    lines: [
      { accountCode: fund.pettyCashAccountCode, debitAmount: amount,
        description: `Petty cash float ${fund.name}` },
      { accountCode: fund.bankAccountCode, creditAmount: amount,
        description: `Funding transfer ${fund.name}` },
    ],
  });

  const id = randomUUID();
  await db.query(
    `insert into imprest_transactions (id, tenant_slug, fund_id, txn_type, txn_date,
       amount, description, journal_entry_id)
     values ($1,$2,$3,'replenishment',$4,$5,$6,$7)`,
    [id, input.tenantSlug, input.fundId, input.txnDate, amount, je.description, je.id]
  );
  return { id, amount, journalEntryId: je.id, journalNumber: je.journalNumber };
}

// ---------------------------------------------------------------------------
// Disbursement: Dr expense account / Cr petty cash float.
// ---------------------------------------------------------------------------
export async function disburseFund(input: {
  tenantSlug: string;
  fundId: string;
  txnDate: string;
  amount: number;
  expenseAccountCode: string;
  description?: string;
  userId?: string;
}) {
  await ensureImprestTables();
  const fund = await getFund(input.tenantSlug, input.fundId);
  if (input.amount <= 0) throw new Error("Disbursement amount must be positive");
  if (input.amount > fund.balance)
    throw new Error(`Disbursement exceeds fund balance (${fund.balance})`);

  const je = await postGLEntry({
    tenantSlug: input.tenantSlug,
    entryDate: input.txnDate,
    journalType: "SYSTEM",
    referenceType: "imprest_disbursement",
    referenceId: input.fundId,
    description: input.description ?? `Imprest disbursement: ${fund.name}`,
    createdBy: input.userId,
    lines: [
      { accountCode: input.expenseAccountCode, debitAmount: input.amount,
        description: input.description },
      { accountCode: fund.pettyCashAccountCode, creditAmount: input.amount,
        description: `Petty cash ${fund.name}` },
    ],
  });

  const id = randomUUID();
  await db.query(
    `insert into imprest_transactions (id, tenant_slug, fund_id, txn_type, txn_date,
       amount, expense_account_code, description, journal_entry_id)
     values ($1,$2,$3,'disbursement',$4,$5,$6,$7,$8)`,
    [id, input.tenantSlug, input.fundId, input.txnDate, input.amount,
     input.expenseAccountCode, je.description, je.id]
  );
  return { id, journalEntryId: je.id, journalNumber: je.journalNumber };
}

// ---------------------------------------------------------------------------
// Staff advances
// ---------------------------------------------------------------------------
async function nextAdvanceNumber(tenantSlug: string): Promise<string> {
  const rows = (await db.query<{ n: number }>(
    `select count(*) + 1 as n from staff_advances where tenant_slug = $1`,
    [tenantSlug]
  )).rows;
  return `ADV-${String(rows[0]?.n ?? 1).padStart(5, "0")}`;
}

export async function issueAdvance(input: {
  tenantSlug: string;
  employeeName: string;
  employeeId?: string;
  fundId?: string;                 // from petty cash fund; else from bank
  amount: number;
  purpose?: string;
  issueDate: string;
  userId?: string;
}) {
  await ensureImprestTables();
  if (input.amount <= 0) throw new Error("Advance amount must be positive");

  let creditAccount: string = GL_ACCOUNTS.BANK;
  if (input.fundId) {
    const fund = await getFund(input.tenantSlug, input.fundId);
    if (input.amount > fund.balance)
      throw new Error(`Advance exceeds fund balance (${fund.balance})`);
    creditAccount = fund.pettyCashAccountCode;
  }

  const id = randomUUID();
  const advanceNumber = await nextAdvanceNumber(input.tenantSlug);
  const je = await postGLEntry({
    tenantSlug: input.tenantSlug,
    entryDate: input.issueDate,
    journalType: "SYSTEM",
    referenceType: "staff_advance",
    referenceId: id,
    description: `Staff advance ${advanceNumber}: ${input.employeeName}`,
    createdBy: input.userId,
    lines: [
      { accountCode: GL_ACCOUNTS.STAFF_ADVANCES, debitAmount: input.amount,
        partyType: "employee", partyId: input.employeeId ?? input.employeeName,
        description: input.purpose },
      { accountCode: creditAccount, creditAmount: input.amount,
        description: `Advance funding` },
    ],
  });

  await db.query(
    `insert into staff_advances (id, tenant_slug, advance_number, employee_name,
       employee_id, fund_id, amount, purpose, issue_date, journal_entry_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, input.tenantSlug, advanceNumber, input.employeeName,
     input.employeeId ?? null, input.fundId ?? null, input.amount,
     input.purpose ?? null, input.issueDate, je.id]
  );
  return { id, advanceNumber, journalEntryId: je.id, journalNumber: je.journalNumber };
}

export async function getAdvance(tenantSlug: string, advanceId: string) {
  await ensureImprestTables();
  const rows = (await db.query<any>(
    `select * from staff_advances where id = $1 and tenant_slug = $2`,
    [advanceId, tenantSlug]
  )).rows;
  if (!rows.length) throw new Error(`Staff advance ${advanceId} not found`);
  const a = rows[0];
  return {
    ...a,
    amount: Number(a.amount),
    appliedAmount: Number(a.applied_amount),
    refundedAmount: Number(a.refunded_amount),
    outstanding: Number(a.amount) - Number(a.applied_amount) - Number(a.refunded_amount),
  };
}

// Apply part/all of an advance to an expense claim: Dr expense / Cr staff advances.
export async function applyAdvance(input: {
  tenantSlug: string;
  advanceId: string;
  expenseId?: string;
  expenseAccountCode?: string;
  amount: number;
  entryDate: string;
  userId?: string;
}) {
  await ensureImprestTables();
  const adv = await getAdvance(input.tenantSlug, input.advanceId);
  if (!["issued", "partially_settled"].includes(adv.status))
    throw new Error(`Advance ${adv.advance_number} is ${adv.status}`);
  if (input.amount <= 0 || input.amount > adv.outstanding)
    throw new Error(`Application amount must be 0 < amt <= ${adv.outstanding}`);

  const je = await postGLEntry({
    tenantSlug: input.tenantSlug,
    entryDate: input.entryDate,
    journalType: "SYSTEM",
    referenceType: "staff_advance_application",
    referenceId: input.advanceId,
    description: `Advance ${adv.advance_number} applied to expense`,
    createdBy: input.userId,
    lines: [
      { accountCode: input.expenseAccountCode ?? GL_ACCOUNTS.GENERAL_EXPENSE,
        debitAmount: input.amount,
        description: `Expense claim ${input.expenseId ?? ""}` },
      { accountCode: GL_ACCOUNTS.STAFF_ADVANCES, creditAmount: input.amount,
        partyType: "employee", partyId: adv.employee_id ?? adv.employee_name,
        description: `Advance settlement` },
    ],
  });

  const applied = adv.appliedAmount + input.amount;
  const status =
    applied + adv.refundedAmount >= adv.amount
      ? adv.refundedAmount > 0 ? "refunded" : "settled"
      : "partially_settled";
  await db.query(
    `insert into staff_advance_applications (id, tenant_slug, advance_id, expense_id,
       amount, journal_entry_id) values ($1,$2,$3,$4,$5,$6)`,
    [randomUUID(), input.tenantSlug, input.advanceId, input.expenseId ?? null,
     input.amount, je.id]
  );
  await db.query(
    `update staff_advances set applied_amount = $1, status = $2, updated_at = now()
     where id = $3`,
    [applied, status, input.advanceId]
  );
  return { journalEntryId: je.id, journalNumber: je.journalNumber, status };
}

// Refund the unused part of an advance: Dr petty cash/bank / Cr staff advances.
export async function refundAdvance(input: {
  tenantSlug: string;
  advanceId: string;
  amount: number;
  fundId?: string;
  entryDate: string;
  userId?: string;
}) {
  await ensureImprestTables();
  const adv = await getAdvance(input.tenantSlug, input.advanceId);
  if (!["issued", "partially_settled"].includes(adv.status))
    throw new Error(`Advance ${adv.advance_number} is ${adv.status}`);
  if (input.amount <= 0 || input.amount > adv.outstanding)
    throw new Error(`Refund amount must be 0 < amt <= ${adv.outstanding}`);

  let debitAccount: string = GL_ACCOUNTS.BANK;
  if (input.fundId) {
    const fund = await getFund(input.tenantSlug, input.fundId);
    debitAccount = fund.pettyCashAccountCode;
  }
  const je = await postGLEntry({
    tenantSlug: input.tenantSlug,
    entryDate: input.entryDate,
    journalType: "SYSTEM",
    referenceType: "staff_advance_refund",
    referenceId: input.advanceId,
    description: `Advance ${adv.advance_number} refund`,
    createdBy: input.userId,
    lines: [
      { accountCode: debitAccount, debitAmount: input.amount,
        description: `Advance refund received` },
      { accountCode: GL_ACCOUNTS.STAFF_ADVANCES, creditAmount: input.amount,
        partyType: "employee", partyId: adv.employee_id ?? adv.employee_name,
        description: `Advance refund` },
    ],
  });

  const refunded = adv.refundedAmount + input.amount;
  const status =
    adv.appliedAmount + refunded >= adv.amount ? "refunded" : "partially_settled";
  await db.query(
    `update staff_advances set refunded_amount = $1, status = $2, updated_at = now()
     where id = $3`,
    [refunded, status, input.advanceId]
  );
  return { journalEntryId: je.id, journalNumber: je.journalNumber, status };
}

// ---------------------------------------------------------------------------
// Petty cash book: chronological float movements with running balance.
// ---------------------------------------------------------------------------
export async function pettyCashBook(tenantSlug: string, fundId: string) {
  await ensureImprestTables();
  const fund = await getFund(tenantSlug, fundId);
  const rows = (await db.query<any>(
    `select t.txn_date, t.txn_type, t.amount::float as amount, t.description,
            t.journal_entry_id, t.expense_account_code
     from imprest_transactions t
     where t.fund_id = $1 and t.status = 'posted'
     union all
     select a.issue_date, 'advance_issue', a.amount::float, 'Advance '||a.advance_number||' - '||a.employee_name,
            a.journal_entry_id, null
     from staff_advances a
     where a.fund_id = $1
     union all
     select ap.created_at::date, 'advance_refund', -sa.refunded_amount::float,
            'Advance refunds '||sa.advance_number, null, null
     from staff_advances sa
     join staff_advance_applications ap on ap.advance_id = sa.id
     where sa.fund_id = $1 and sa.refunded_amount > 0
     order by 1`,
    [fundId]
  )).rows;

  let balance = 0;
  const lines = rows.map((r: any) => {
    const amt = r.txn_type === "disbursement" || r.txn_type === "advance_issue" || r.txn_type === "advance_refund"
      ? -Math.abs(r.amount) : Math.abs(r.amount);
    balance += amt;
    return { ...r, signedAmount: amt, runningBalance: balance };
  });
  return { fund, lines, closingBalance: balance };
}
