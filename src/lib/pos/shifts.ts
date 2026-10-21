import { randomUUID } from "node:crypto";
import { sql as SQL } from "../sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { getPosConfig, logPosAudit } from "./config";

export function ensureShiftTables(...args: Parameters<typeof ensureRun>) {
  return ensureOnce("pos/shifts:ensure", () => ensureRun(...args));
}

async function ensureRun(sql = SQL) {
  await sql`
    create table if not exists pos_shifts (
      id text primary key,
      tenant_slug text not null,
      status text not null default 'open' check (status in ('open','closed')),
      register_id text,
      opened_by text,
      opened_at timestamptz not null default now(),
      opening_float numeric not null default 0,
      closed_by text,
      closed_at timestamptz,
      closing_counted numeric,
      expected_cash numeric,
      variance numeric,
      flagged boolean not null default false,
      variance_reason text,
      notes text
    )
  `;
  await sql`alter table if exists pos_shifts add column if not exists register_id text`;
  await sql`alter table if exists pos_shifts add column if not exists flagged boolean not null default false`;
  await sql`alter table if exists pos_shifts add column if not exists variance_reason text`;
  await sql`alter table if exists pos_sales add column if not exists shift_id text`;
  await sql`
    create table if not exists pos_cash_movements (
      id text primary key,
      tenant_slug text not null,
      shift_id text not null,
      register_id text,
      type text not null check (type in ('pay_in','pay_out','drop')),
      amount numeric not null check (amount > 0),
      reason text,
      created_by text,
      created_at timestamptz not null default now()
    )
  `;
  // Summary queries read pos_sales.tenders/status and pos_returns — ensure the
  // columns/tables exist even before the sales module's own ensure has run.
  await sql`alter table if exists pos_sales add column if not exists tenders jsonb`;
  await sql`alter table if exists pos_sales add column if not exists status text not null default 'completed'`;
  await sql`
    create table if not exists pos_returns (
      id text primary key,
      tenant_slug text not null,
      sale_id text not null,
      invoice_id text,
      credit_note_id text,
      items jsonb not null,
      refund_method text not null default 'cash',
      refund_amount numeric not null,
      restocked boolean not null default false,
      reason text,
      created_by text,
      created_at timestamptz not null default now()
    )
  `;
  await sql`drop index if exists pos_shifts_one_open`;
  await sql`
    create unique index if not exists pos_shifts_one_open
    on pos_shifts (tenant_slug, coalesce(register_id, '')) where status = 'open'
  `;
}

export interface PosShift {
  id: string;
  status: "open" | "closed";
  registerId: string | null;
  openedBy: string | null;
  openedAt: string;
  openingFloat: number;
  closedBy: string | null;
  closedAt: string | null;
  closingCounted: number | null;
  expectedCash: number | null;
  variance: number | null;
  flagged: boolean;
  varianceReason: string | null;
  notes: string | null;
}

function normalize(r: any): PosShift {
  return {
    id: r.id,
    status: r.status,
    registerId: r.register_id,
    openedBy: r.opened_by,
    openedAt: r.opened_at,
    openingFloat: Number(r.opening_float ?? 0),
    closedBy: r.closed_by,
    closedAt: r.closed_at,
    closingCounted: r.closing_counted == null ? null : Number(r.closing_counted),
    expectedCash: r.expected_cash == null ? null : Number(r.expected_cash),
    variance: r.variance == null ? null : Number(r.variance),
    flagged: Boolean(r.flagged),
    varianceReason: r.variance_reason,
    notes: r.notes,
  };
}

export async function getOpenShift(tenantSlug: string, registerId?: string | null): Promise<PosShift | null> {
  const sql = SQL;
  await ensureShiftTables(sql);
  const rows = (await sql`
    select * from pos_shifts
    where tenant_slug = ${tenantSlug} and status = 'open'
      and coalesce(register_id, '') = coalesce(${registerId ?? null}, '')
    order by opened_at desc limit 1
  `) as any[];
  return rows[0] ? normalize(rows[0]) : null;
}

export async function openShift(
  tenantSlug: string,
  input: { openingFloat?: number; openedBy?: string; notes?: string; registerId?: string }
): Promise<PosShift> {
  const sql = SQL;
  await ensureShiftTables(sql);
  if (input.registerId) {
    const reg = (await sql`
      select id from pos_registers where id = ${input.registerId} and tenant_slug = ${tenantSlug} and is_active
    `) as any[];
    if (!reg.length) throw new Error("Register not found or inactive");
  }
  const existing = await getOpenShift(tenantSlug, input.registerId);
  if (existing) {
    throw new Error(`A shift is already open on this register (opened ${existing.openedAt} by ${existing.openedBy ?? "unknown"})`);
  }
  const id = `shift_${randomUUID().slice(0, 10)}`;
  try {
    const rows = (await sql`
      insert into pos_shifts (id, tenant_slug, status, register_id, opened_by, opening_float, notes, opened_at)
      values (${id}, ${tenantSlug}, 'open', ${input.registerId ?? null}, ${input.openedBy ?? null},
              ${input.openingFloat ?? 0}, ${input.notes ?? null}, now())
      returning *
    `) as any[];
    const shift = normalize(rows[0]);
    await logPosAudit(tenantSlug, {
      action: "shift_open", actor: input.openedBy, entityType: "pos_shift", entityId: id,
      detail: { registerId: input.registerId ?? null, openingFloat: input.openingFloat ?? 0 },
    });
    return shift;
  } catch (err: any) {
    if (/pos_shifts_one_open|duplicate key/.test(err.message ?? "")) {
      throw new Error("A shift is already open on this register");
    }
    throw err;
  }
}

export async function listShifts(
  tenantSlug: string,
  opts: { from?: string; to?: string; registerId?: string; limit?: number } = {}
): Promise<PosShift[]> {
  const sql = SQL;
  await ensureShiftTables(sql);
  const rows = (await sql`
    select * from pos_shifts
    where tenant_slug = ${tenantSlug}
      and (${opts.from ?? null}::date is null or opened_at >= ${opts.from ?? null}::date)
      and (${opts.to ?? null}::date is null or opened_at < (${opts.to ?? null}::date + 1))
      and (${opts.registerId ?? null}::text is null or register_id = ${opts.registerId ?? null})
    order by opened_at desc limit ${Math.min(opts.limit ?? 50, 200)}
  `) as any[];
  return rows.map(normalize);
}

// ---------------------------------------------------------------------------
// Cash movements (pay-in, pay-out, bank drop) — feed expected-cash math.
// ---------------------------------------------------------------------------

export async function addCashMovement(
  tenantSlug: string,
  input: {
    shiftId?: string;
    registerId?: string;
    type: "pay_in" | "pay_out" | "drop";
    amount: number;
    reason?: string;
    createdBy?: string;
  }
) {
  const sql = SQL;
  await ensureShiftTables(sql);
  const shift = input.shiftId
    ? (await sql`select * from pos_shifts where id = ${input.shiftId} and tenant_slug = ${tenantSlug} and status = 'open'` as any[])[0]
    : await getOpenShift(tenantSlug, input.registerId);
  if (!shift) throw new Error("No open shift for this register");
  if (!(input.amount > 0)) throw new Error("Cash movement amount must be positive");
  const id = `pcm_${randomUUID().slice(0, 10)}`;
  await sql`
    insert into pos_cash_movements (id, tenant_slug, shift_id, register_id, type, amount, reason, created_by)
    values (${id}, ${tenantSlug}, ${shift.id}, ${(shift as any).register_id ?? input.registerId ?? null},
            ${input.type}, ${input.amount}, ${input.reason ?? null}, ${input.createdBy ?? null})
  `;
  await logPosAudit(tenantSlug, {
    action: `cash_${input.type}`, actor: input.createdBy, entityType: "pos_shift", entityId: shift.id,
    detail: { amount: input.amount, reason: input.reason ?? null },
  });
  return { id, shiftId: shift.id };
}

export async function listCashMovements(tenantSlug: string, shiftId: string) {
  const sql = SQL;
  await ensureShiftTables(sql);
  return (await sql`
    select * from pos_cash_movements
    where tenant_slug = ${tenantSlug} and shift_id = ${shiftId}
    order by created_at
  `) as any[];
}

// ---------------------------------------------------------------------------
// Shift summary — the X-report (mid-shift) doubles as the Z-report once closed.
// expected_cash = float + cash sales - cash refunds + pay-ins - pay-outs/drops
// ---------------------------------------------------------------------------

export async function getShiftSummary(
  tenantSlug: string,
  shiftId: string
): Promise<{
  shift: PosShift;
  sales: number;
  total: number;
  byMethod: Array<{ method: string; sales: number; total: number }>;
  cashRefunds: number;
  cashMovements: { payIn: number; payOut: number; drop: number };
  expectedCash: number;
} | null> {
  const sql = SQL;
  await ensureShiftTables(sql);
  const shiftRows = (await sql`
    select * from pos_shifts where id = ${shiftId} and tenant_slug = ${tenantSlug}
  `) as any[];
  const shift = shiftRows[0];
  if (!shift) return null;

  // Tender-level totals (split tender is stored in the tenders jsonb; fall back
  // to payment_method for sales written before tenders existed).
  const totals = (await sql`
    select m.method, sum(m.amount)::numeric as total, count(*)::int as sales
    from (
      select (t.value ->> 'method') as method, (t.value ->> 'amount')::numeric as amount, s.id
      from pos_sales s cross join lateral jsonb_array_elements(s.tenders) t
      where s.tenant_slug = ${tenantSlug} and s.shift_id = ${shiftId}
        and s.status = 'completed' and s.tenders is not null
      union all
      select s.payment_method as method, s.total_amount as amount, s.id
      from pos_sales s
      where s.tenant_slug = ${tenantSlug} and s.shift_id = ${shiftId}
        and s.status = 'completed' and s.tenders is null
    ) m group by m.method
  `) as any[];
  const saleCount = (await sql`
    select count(*)::int as c from pos_sales
    where tenant_slug = ${tenantSlug} and shift_id = ${shiftId} and status = 'completed'
  `) as any[];

  const cashRefunds = (await sql`
    select coalesce(sum(refund_amount), 0)::numeric as amt from pos_returns
    where tenant_slug = ${tenantSlug} and refund_method = 'cash'
      and sale_id in (select id from pos_sales where tenant_slug = ${tenantSlug} and shift_id = ${shiftId})
  `) as any[];

  const movements = (await sql`
    select type, coalesce(sum(amount), 0)::numeric as amt
    from pos_cash_movements
    where tenant_slug = ${tenantSlug} and shift_id = ${shiftId}
    group by type
  `) as any[];
  const mv = (t: string) => Number(movements.find((m) => m.type === t)?.amt ?? 0);

  const cashTotal = totals.find((t) => t.method === "cash");
  const expectedCash =
    Number(shift.opening_float ?? 0) +
    Number(cashTotal?.total ?? 0) -
    Number(cashRefunds[0]?.amt ?? 0) +
    mv("pay_in") - mv("pay_out") - mv("drop");

  return {
    shift: normalize(shift),
    sales: Number(saleCount[0]?.c ?? 0),
    total: totals.reduce((s, t) => s + Number(t.total), 0),
    byMethod: totals.map((t) => ({ method: t.method, sales: t.sales, total: Number(t.total) })),
    cashRefunds: Number(cashRefunds[0]?.amt ?? 0),
    cashMovements: { payIn: mv("pay_in"), payOut: mv("pay_out"), drop: mv("drop") },
    expectedCash: Math.round(expectedCash * 100) / 100,
  };
}

export async function closeShift(
  tenantSlug: string,
  shiftId: string,
  input: { closingCounted: number; closedBy?: string; notes?: string; varianceReason?: string }
): Promise<PosShift | { error: string }> {
  const sql = SQL;
  await ensureShiftTables(sql);
  const summary = await getShiftSummary(tenantSlug, shiftId);
  if (!summary) return { error: "Shift not found" };
  if (summary.shift.status === "closed") return { error: "Shift is already closed" };

  const variance = Math.round((input.closingCounted - summary.expectedCash) * 100) / 100;
  const { varianceTolerance } = await getPosConfig(tenantSlug);
  const flagged = Math.abs(variance) > varianceTolerance;
  if (flagged && !input.varianceReason?.trim()) {
    return { error: `Variance ${variance > 0 ? "+" : ""}${variance} exceeds tolerance — a reason is required` };
  }

  const rows = (await sql`
    update pos_shifts
    set status = 'closed', closed_at = now(), closed_by = ${input.closedBy ?? null},
        closing_counted = ${input.closingCounted}, expected_cash = ${summary.expectedCash},
        variance = ${variance}, flagged = ${flagged},
        variance_reason = ${input.varianceReason ?? null},
        notes = coalesce(${input.notes ?? null}, notes)
    where id = ${shiftId} and tenant_slug = ${tenantSlug} and status = 'open'
    returning *
  `) as any[];
  if (!rows.length) return { error: "Shift was closed concurrently" };

  // Journal the cash difference so book cash matches the counted drawer:
  // overage → Dr Cash / Cr POS Overage income; shortage → Dr POS Shortage / Cr Cash.
  if (variance !== 0) {
    try {
      const { postGLEntry, GL_ACCOUNTS } = await import("../finance/gl");
      const over = variance > 0;
      const amount = Math.abs(variance);
      await postGLEntry({
        tenantSlug,
        entryDate: new Date().toISOString().split("T")[0],
        journalType: "SYSTEM",
        referenceType: "pos_shift",
        referenceId: shiftId,
        status: "POSTED",
        description: `POS shift close — cash ${over ? "overage" : "shortage"}${input.varianceReason ? ` (${input.varianceReason})` : ""}`,
        lines: over
          ? [
              { accountCode: GL_ACCOUNTS.CASH, debitAmount: amount, description: `Counted above expected — shift ${shiftId}` },
              { accountCode: GL_ACCOUNTS.POS_OVERAGE, creditAmount: amount, description: "POS cash overage" },
            ]
          : [
              { accountCode: GL_ACCOUNTS.POS_SHORTAGE, debitAmount: amount, description: "POS cash shortage" },
              { accountCode: GL_ACCOUNTS.CASH, creditAmount: amount, description: `Counted below expected — shift ${shiftId}` },
            ],
      });
    } catch (err) {
      console.error("POS shift variance JE failed:", err);
    }
  }

  await logPosAudit(tenantSlug, {
    action: "shift_close", actor: input.closedBy, entityType: "pos_shift", entityId: shiftId,
    detail: { expected: summary.expectedCash, counted: input.closingCounted, variance, flagged },
  });

  if (flagged) {
    try {
      const [reg] = (await sql`select code from pos_registers where id = ${rows[0].register_id} and tenant_slug = ${tenantSlug}`) as any[];
      const { emitEvent } = await import("@/lib/notify");
      void emitEvent({
        tenantSlug,
        eventType: "pos.shift_flagged",
        sourceModule: "pos",
        sourceRecordId: shiftId,
        dedupeKey: `shift:${shiftId}`,
        actorId: input.closedBy,
        payload: {
          registerCode: reg?.code ?? rows[0].register_id,
          expectedCash: summary.expectedCash,
          closingCounted: input.closingCounted,
          variance,
          varianceReason: input.varianceReason,
          closedBy: input.closedBy,
        },
      });
    } catch (err) {
      console.error("Failed to emit pos.shift_flagged:", err);
    }
  }

  return normalize(rows[0]);
}
