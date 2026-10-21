import { randomUUID } from "crypto";
import { db, sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { postGLEntry, GL_ACCOUNTS } from "./gl";

// ---------------------------------------------------------------------------
// Deferred revenue & expense (ERPNext Process Deferred Accounting):
//   - Line items flagged deferred book to a balance-sheet holding account at
//     invoice/bill time (the line's accountCode should already be the
//     deferred account — callers set it).
//   - A schedule spreads recognition across the service period.
//   - processDeferredAccounting posts monthly recognition JEs:
//       sales:  Dr Deferred Revenue / Cr Revenue account
//       purchase: Dr Expense account / Cr Deferred Expense
// ---------------------------------------------------------------------------

export function ensureDeferredTables() {
  return ensureOnce("finance/deferred:ensureTables", async () => {
    const sql = SQL;
    await sql`
      create table if not exists deferred_items (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        direction text not null check (direction in ('revenue','expense')),
        document_type text not null,         -- 'invoice' | 'bill'
        document_id text not null,
        line_no integer not null default 0,
        party text,
        item text,
        total_amount numeric not null,
        recognized_amount numeric not null default 0,
        service_start_date date not null,
        service_end_date date not null,
        deferred_account_code text not null,
        recognition_account_code text not null,
        status text not null default 'open',
        created_at timestamptz not null default now()
      )`;
    await sql`create index if not exists deferred_items_idx
      on deferred_items (tenant_slug, status, direction)`;

    await sql`
      create table if not exists deferred_schedule (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        deferred_item_id uuid not null references deferred_items (id) on delete cascade,
        period_date date not null,
        amount numeric not null,
        status text not null default 'pending',
        journal_entry_id text,
        created_at timestamptz not null default now()
      )`;
    await sql`create index if not exists deferred_sched_idx
      on deferred_schedule (tenant_slug, status, period_date)`;
  });
}

/** Split an amount evenly across calendar months between two dates. */
export function buildRecognitionSchedule(input: {
  totalAmount: number; startDate: string; endDate: string;
}): Array<{ periodDate: string; amount: number }> {
  const start = new Date(input.startDate + "T00:00:00Z");
  const end = new Date(input.endDate + "T00:00:00Z");
  if (!(end >= start)) throw new Error("service_end_date must be on/after service_start_date");
  const months: Date[] = [];
  for (let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
       d <= end;
       d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    months.push(d);
  }
  const n = Math.max(months.length, 1);
  const per = Math.floor((input.totalAmount / n) * 100) / 100;
  const out: Array<{ periodDate: string; amount: number }> = [];
  let remaining = input.totalAmount;
  for (const [i, m] of months.entries()) {
    const last = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 0));
    const amount = i === months.length - 1 ? Math.round(remaining * 100) / 100 : per;
    remaining = Math.round((remaining - amount) * 100) / 100;
    out.push({ periodDate: last.toISOString().slice(0, 10), amount });
  }
  return out;
}

export async function createDeferredItem(input: {
  tenantSlug: string;
  direction: "revenue" | "expense";
  documentType: "invoice" | "bill";
  documentId: string;
  lineNo?: number;
  party?: string;
  item?: string;
  totalAmount: number;
  serviceStartDate: string;
  serviceEndDate: string;
  /** Revenue/expense account the amounts eventually land in. */
  recognitionAccountCode: string;
  deferredAccountCode?: string;
}) {
  await ensureDeferredTables();
  if (!(input.totalAmount > 0)) throw new Error("totalAmount must be positive");
  const id = randomUUID();
  const deferredAccount = input.deferredAccountCode
    ?? (input.direction === "revenue" ? GL_ACCOUNTS.DEFERRED_REVENUE : GL_ACCOUNTS.DEFERRED_EXPENSE);
  const schedule = buildRecognitionSchedule({
    totalAmount: input.totalAmount,
    startDate: input.serviceStartDate,
    endDate: input.serviceEndDate,
  });
  await SQL`
    insert into deferred_items (
      id, tenant_slug, direction, document_type, document_id, line_no,
      party, item, total_amount, service_start_date, service_end_date,
      deferred_account_code, recognition_account_code
    ) values (
      ${id}, ${input.tenantSlug}, ${input.direction}, ${input.documentType}, ${input.documentId},
      ${input.lineNo ?? 0}, ${input.party ?? null}, ${input.item ?? null},
      ${input.totalAmount}, ${input.serviceStartDate}, ${input.serviceEndDate},
      ${deferredAccount}, ${input.recognitionAccountCode}
    )`;
  for (const row of schedule) {
    await SQL`
      insert into deferred_schedule (tenant_slug, deferred_item_id, period_date, amount)
      values (${input.tenantSlug}, ${id}, ${row.periodDate}, ${row.amount})`;
  }
  return { id, periods: schedule.length };
}

export async function listDeferredItems(tenantSlug: string, direction?: string, status?: string) {
  await ensureDeferredTables();
  return (await SQL`
    select * from deferred_items
    where tenant_slug = ${tenantSlug}
      ${direction ? SQL`and direction = ${direction}` : SQL``}
      ${status ? SQL`and status = ${status}` : SQL``}
    order by service_start_date desc
  `) as any[];
}

/**
 * Posts all due recognition rows up to `asOf`. Idempotent — schedule rows are
 * marked posted with their JE id.
 */
export async function processDeferredAccounting(input: {
  tenantSlug: string; asOf?: string; userId?: string;
}) {
  await ensureDeferredTables();
  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);
  const due = (await SQL`
    select s.id schedule_id, s.deferred_item_id, s.period_date::text, s.amount, d.*
    from deferred_schedule s
    join deferred_items d on d.id = s.deferred_item_id and d.tenant_slug = s.tenant_slug
    where s.tenant_slug = ${input.tenantSlug}
      and s.status = 'pending'
      and s.period_date <= ${asOf}
      and d.status = 'open'
    order by s.period_date
  `) as any[];

  const posted: Array<{ scheduleId: string; item: string; amount: number; journalEntryId: string }> = [];
  for (const row of due) {
    const amt = Number(row.amount);
    const isRevenue = row.direction === "revenue";
    const je = await postGLEntry({
      tenantSlug: input.tenantSlug,
      entryDate: String(row.period_date).slice(0, 10),
      journalType: "SYSTEM",
      referenceType: "deferred_accounting",
      referenceId: row.deferred_item_id,
      description: `${isRevenue ? "Revenue" : "Expense"} recognition — ${row.item ?? row.document_id} (${String(row.period_date).slice(0, 7)})`,
      createdBy: input.userId,
      lines: isRevenue
        ? [
            { accountCode: row.deferred_account_code, debitAmount: amt, description: "Release deferred revenue" },
            { accountCode: row.recognition_account_code, creditAmount: amt, description: "Recognize revenue" },
          ]
        : [
            { accountCode: row.recognition_account_code, debitAmount: amt, description: "Recognize expense" },
            { accountCode: row.deferred_account_code, creditAmount: amt, description: "Release deferred expense" },
          ],
    });
    await SQL`
      update deferred_schedule set status = 'posted', journal_entry_id = ${je.id}
      where id = ${row.schedule_id}`;
    await SQL`
      update deferred_items
      set recognized_amount = recognized_amount + ${amt},
          status = case when recognized_amount + ${amt} >= total_amount - 0.005 then 'completed' else 'open' end
      where id = ${row.deferred_item_id} and tenant_slug = ${input.tenantSlug}`;
    posted.push({ scheduleId: row.schedule_id, item: row.item, amount: amt, journalEntryId: je.id });
  }
  return { asOf, posted };
}

/** ERPNext "Deferred Revenue and Expense" report. */
export async function deferredReport(input: {
  tenantSlug: string; direction?: "revenue" | "expense"; asOf?: string;
}) {
  await ensureDeferredTables();
  const items = await listDeferredItems(input.tenantSlug, input.direction);
  return items.map((d) => ({
    itemId: d.id,
    documentType: d.document_type,
    documentId: d.document_id,
    party: d.party,
    item: d.item,
    direction: d.direction,
    totalAmount: Number(d.total_amount),
    recognizedAmount: Number(d.recognized_amount),
    remainingAmount: Math.round((Number(d.total_amount) - Number(d.recognized_amount)) * 100) / 100,
    serviceStartDate: String(d.service_start_date).slice(0, 10),
    serviceEndDate: String(d.service_end_date).slice(0, 10),
    status: d.status,
    deferredAccount: d.deferred_account_code,
    recognitionAccount: d.recognition_account_code,
  }));
}
