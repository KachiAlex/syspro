import { randomUUID } from "crypto";

import { db, sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";

// ---------------------------------------------------------------------------
// Multi-currency support: exchange-rate register plus realized gain/loss
// helpers. Amounts stored on finance documents are base-currency; documents
// may also carry `transaction_currency` + `exchange_rate` (foreign units per
// base unit) so the realized difference can be posted on settlement.
// ---------------------------------------------------------------------------

export function ensureCurrencyTables() {
  return ensureOnce("finance/currency:ensureTables", ensureCurrencyTablesRun);
}

async function ensureCurrencyTablesRun() {
  const sql = SQL;
  await sql`create table if not exists exchange_rates (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    currency text not null,
    rate_date date not null,
    rate numeric not null,
    created_at timestamptz not null default now()
  )`;
  await sql`alter table finance_invoices add column if not exists transaction_currency text`;
  await sql`alter table finance_invoices add column if not exists exchange_rate numeric`;
  await sql`alter table finance_payments add column if not exists transaction_currency text`;
  await sql`alter table finance_payments add column if not exists exchange_rate numeric`;
}

export async function upsertExchangeRate(input: {
  tenantSlug: string;
  currency: string;
  rateDate: string;
  rate: number;
}) {
  await ensureCurrencyTables();
  if (input.rate <= 0) throw new Error("Exchange rate must be positive");
  await db.query(
    `insert into exchange_rates (id, tenant_slug, currency, rate_date, rate)
     values ($1,$2,$3,$4,$5)
     on conflict (tenant_slug, currency, rate_date)
     do update set rate = excluded.rate`,
    [randomUUID(), input.tenantSlug, input.currency.toUpperCase(),
     input.rateDate, input.rate]
  );
}

export async function listExchangeRates(tenantSlug: string, currency?: string) {
  await ensureCurrencyTables();
  return (await db.query<any>(
    `select * from exchange_rates where tenant_slug = $1
     ${currency ? "and currency = $2" : ""}
     order by currency, rate_date desc`,
    currency ? [tenantSlug, currency.toUpperCase()] : [tenantSlug]
  )).rows;
}

// Latest rate on or before `date`; falls back to the earliest later rate.
export async function getExchangeRate(
  tenantSlug: string, currency: string, date: string
): Promise<number | null> {
  await ensureCurrencyTables();
  const rows = (await db.query<{ rate: number }>(
    `select rate::float as rate from exchange_rates
     where tenant_slug = $1 and currency = $2 and rate_date <= $3
     order by rate_date desc limit 1`,
    [tenantSlug, currency.toUpperCase(), date]
  )).rows;
  if (rows.length) return rows[0].rate;
  const later = (await db.query<{ rate: number }>(
    `select rate::float as rate from exchange_rates
     where tenant_slug = $1 and currency = $2
     order by rate_date limit 1`,
    [tenantSlug, currency.toUpperCase()]
  )).rows;
  return later[0]?.rate ?? null;
}

// Base value of a foreign amount: rate is foreign units per base unit.
export function toBase(foreignAmount: number, rate: number): number {
  return foreignAmount / rate;
}
export function toForeign(baseAmount: number, rate: number): number {
  return baseAmount * rate;
}

// Realized gain/loss: base value actually received minus the base AR amount
// extinguished. Positive => gain (credit), negative => loss (debit).
export function realizedGainLoss(
  baseReceived: number,
  baseSettled: number
): { amount: number; isGain: boolean } {
  const diff = baseReceived - baseSettled;
  return { amount: Math.abs(diff), isGain: diff > 0 };
}

// ---------------------------------------------------------------------------
// Period-end revaluation: remeasure open foreign-currency AR/AP at the
// closing rate. Deltas post to 7700 against the AR/AP control account and are
// tracked in fx_revaluations so a run can be reversed before settlement.
// ---------------------------------------------------------------------------

export async function ensureRevaluationTables() {
  await ensureCurrencyTables();
  await db.query(`create table if not exists fx_revaluations (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    currency text not null,
    direction text not null,
    as_of date not null,
    closing_rate numeric not null,
    delta numeric not null,
    journal_entry_id text,
    reversed_journal_entry_id text,
    status text not null default 'posted',
    created_at timestamptz not null default now()
  )`);
  await db.query(`alter table bills add column if not exists transaction_currency text`);
  await db.query(`alter table bills add column if not exists exchange_rate numeric`);
}

/**
 * Revalues open foreign-currency documents at the closing rate.
 * `direction`: 'ar' (finance_invoices) or 'ap' (bills) or 'both'.
 * Rate convention: foreign units per base unit (same as exchange_rates).
 * Returns one revaluation row per (currency, side) with a posted JE.
 */
export async function revalueOpenBalances(input: {
  tenantSlug: string;
  asOf: string;
  direction?: "ar" | "ap" | "both";
  userId?: string;
}) {
  await ensureRevaluationTables();
  const { postGLEntry, GL_ACCOUNTS } = await import("./gl");
  const dir = input.direction ?? "both";
  const results: any[] = [];

  const sides: Array<{
    side: "ar" | "ap";
    table: string;
    balanceCol: string;
    openStatuses: string[];
    control: string;
  }> = [
    ...(dir !== "ap" ? [{
      side: "ar" as const, table: "finance_invoices", balanceCol: "balance_due",
      openStatuses: ["sent", "partially_paid", "overdue"], control: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE,
    }] : []),
    ...(dir !== "ar" ? [{
      side: "ap" as const, table: "bills", balanceCol: "balance_due",
      openStatuses: ["open", "sent", "partially_paid", "overdue"], control: GL_ACCOUNTS.ACCOUNTS_PAYABLE,
    }] : []),
  ];

  for (const s of sides) {
    // Per-currency aggregate of (foreign balance, booked base balance).
    // Booked base = balance_due stored in base at the doc's original rate;
    // foreign = balance_due (base) * original rate → revalued at closing rate.
    const docs = (await db.query<any>(
      `select transaction_currency, exchange_rate::float as rate, ${s.balanceCol}::float as open_base
       from ${s.table}
       where tenant_slug = $1 and ${s.balanceCol} > 0
         and status = any($2)
         and transaction_currency is not null and transaction_currency <> ''
         and exchange_rate is not null and exchange_rate > 0`,
      [input.tenantSlug, s.openStatuses]
    )).rows;

    const byCurrency = new Map<string, { foreign: number; bookedBase: number }>();
    for (const d of docs) {
      const cur = String(d.transaction_currency).toUpperCase();
      const agg = byCurrency.get(cur) ?? { foreign: 0, bookedBase: 0 };
      agg.bookedBase += Number(d.open_base);
      agg.foreign += Number(d.open_base) * Number(d.rate); // base × (foreign per base) = foreign units outstanding
      byCurrency.set(cur, agg);
    }

    for (const [currency, agg] of byCurrency) {
      const closing = await getExchangeRate(input.tenantSlug, currency, input.asOf);
      if (!closing) continue;
      const revaluedBase = agg.foreign / closing;
      const delta = Math.round((revaluedBase - agg.bookedBase) * 100) / 100;
      if (Math.abs(delta) < 0.01) continue;

      // AR: delta>0 → unrealized gain (Dr AR / Cr 7700); delta<0 → loss.
      // AP: delta>0 → loss (Dr 7700 / Cr AP); delta<0 → gain (Dr AP / Cr 7700).
      const isGain = s.side === "ar" ? delta > 0 : delta < 0;
      const abs = Math.abs(delta);
      const je = await postGLEntry({
        tenantSlug: input.tenantSlug,
        entryDate: input.asOf,
        journalType: "ADJUSTMENT",
        referenceType: "fx_revaluation",
        referenceId: `${s.side}-${currency}-${input.asOf}`,
        description: `FX revaluation ${s.side.toUpperCase()} ${currency} @ ${closing}`,
        createdBy: input.userId,
        lines: isGain
          ? [
              { accountCode: s.control, debitAmount: abs, description: "Revalue open balance" },
              { accountCode: GL_ACCOUNTS.EXCHANGE_GAIN_LOSS, creditAmount: abs, description: "Unrealized FX gain" },
            ]
          : [
              { accountCode: GL_ACCOUNTS.EXCHANGE_GAIN_LOSS, debitAmount: abs, description: "Unrealized FX loss" },
              { accountCode: s.control, creditAmount: abs, description: "Revalue open balance" },
            ],
      });

      const id = randomUUID();
      await db.query(
        `insert into fx_revaluations (id, tenant_slug, currency, direction, as_of,
           closing_rate, delta, journal_entry_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, input.tenantSlug, currency, s.side, input.asOf, closing, delta, je.id]
      );
      results.push({ id, currency, direction: s.side, closingRate: closing, delta, journalEntryId: je.id });
    }
  }
  return { asOf: input.asOf, revaluations: results };
}

/** Reverses a posted revaluation (typically at the start of the next period). */
export async function reverseRevaluation(tenantSlug: string, revaluationId: string, reversalDate: string, userId?: string) {
  await ensureRevaluationTables();
  const { reverseGLEntry } = await import("./gl");
  const row = (await db.query<any>(
    `select * from fx_revaluations where id = $1 and tenant_slug = $2`,
    [revaluationId, tenantSlug]
  )).rows[0];
  if (!row) throw new Error(`Revaluation ${revaluationId} not found`);
  if (row.status !== "posted") throw new Error(`Revaluation is ${row.status}`);

  const reversal = await reverseGLEntry(
    row.journal_entry_id,
    `Reversal of FX revaluation ${row.direction.toUpperCase()} ${row.currency} as of ${reversalDate}`,
    userId
  );
  await db.query(
    `update fx_revaluations set status = 'reversed', reversed_journal_entry_id = $1 where id = $2`,
    [reversal.id, revaluationId]
  );
  return { reversed: true, reversalEntryId: reversal.id };
}

export async function listRevaluations(tenantSlug: string) {
  await ensureRevaluationTables();
  return (await db.query<any>(
    `select * from fx_revaluations where tenant_slug = $1 order by as_of desc, created_at desc`,
    [tenantSlug]
  )).rows;
}
