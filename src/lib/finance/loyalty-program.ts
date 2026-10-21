/**
 * Loyalty programs (invoice side) — mirrors ERPNext's Loyalty Program /
 * Loyalty Point Entry. POS-side loyalty already exists (pos_loyalty_txns);
 * this adds program definitions, invoice-earn, and redemption-as-discount.
 *
 * Programs define earn rules (points per ₦ spent) and redemption terms
 * (value per point, max % of invoice payable by points, expense account).
 * Points post to the same pos_loyalty_txns ledger so POS + invoice balances
 * are unified — one wallet per customer.
 */

import { randomUUID } from "crypto";
import { sql as SQL } from "../sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { ensureLoyaltyTables, loyaltyBalance } from "@/lib/pos/loyalty";

export function ensureLoyaltyProgramTables() {
  return ensureOnce("finance/loyalty-program:tables", run);
}

async function run() {
  const sql = SQL;
  await ensureLoyaltyTables(sql);
  await sql`create table if not exists loyalty_programs (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    name text not null,
    earn_rate numeric not null,              -- points per 1 unit of invoice net total
    redeem_value numeric not null,           -- currency per point
    min_points_to_redeem integer not null default 0,
    max_redeem_pct numeric not null default 100,  -- max % of invoice payable in points
    expense_account_code text not null default '6100',
    expiry_days integer,                     -- points expiry (null = never)
    active boolean not null default true,
    created_at timestamptz not null default now(),
    unique (tenant_slug, name)
  )`;
  await sql`create table if not exists loyalty_point_entries (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    program_id uuid not null references loyalty_programs(id) on delete cascade,
    customer_code text not null,
    invoice_id text,
    type text not null check (type in ('earn','redeem')),
    points numeric not null,
    discount_amount numeric,
    expiry_date date,
    created_at timestamptz not null default now(),
    unique (tenant_slug, program_id, invoice_id, type)
  )`;
}

export async function upsertLoyaltyProgram(input: {
  tenantSlug: string; name: string; earnRate: number; redeemValue: number;
  minPointsToRedeem?: number; maxRedeemPct?: number; expenseAccountCode?: string;
  expiryDays?: number; active?: boolean;
}) {
  await ensureLoyaltyProgramTables();
  const rows = (await SQL`
    insert into loyalty_programs
      (tenant_slug, name, earn_rate, redeem_value, min_points_to_redeem,
       max_redeem_pct, expense_account_code, expiry_days, active)
    values (${input.tenantSlug}, ${input.name}, ${input.earnRate}, ${input.redeemValue},
            ${input.minPointsToRedeem ?? 0}, ${input.maxRedeemPct ?? 100},
            ${input.expenseAccountCode ?? "6100"}, ${input.expiryDays ?? null}, ${input.active ?? true})
    on conflict (tenant_slug, name) do update
      set earn_rate = excluded.earn_rate, redeem_value = excluded.redeem_value,
          min_points_to_redeem = excluded.min_points_to_redeem,
          max_redeem_pct = excluded.max_redeem_pct, active = excluded.active
    returning *
  `) as any[];
  return rows[0];
}

export async function listLoyaltyPrograms(tenantSlug: string) {
  await ensureLoyaltyProgramTables();
  return (await SQL`select * from loyalty_programs where tenant_slug = ${tenantSlug} order by name`) as any[];
}

/** Award points for a paid/issued invoice. Idempotent per (invoice, 'earn'). */
export async function earnOnInvoice(input: {
  tenantSlug: string; programId: string; customerCode: string;
  invoiceId: string; invoiceAmount: number;
}) {
  await ensureLoyaltyProgramTables();
  const prog = (await SQL`
    select * from loyalty_programs
    where id = ${input.programId} and tenant_slug = ${input.tenantSlug} and active
  `) as any[];
  if (!prog[0]) throw new Error("Loyalty program not found or inactive");

  const points = Math.floor(input.invoiceAmount * Number(prog[0].earn_rate));
  if (points <= 0) return { points: 0, note: "below earn threshold" };

  const expiry = prog[0].expiry_days
    ? new Date(Date.now() + Number(prog[0].expiry_days) * 864e5).toISOString().slice(0, 10)
    : null;

  const entry = (await SQL`
    insert into loyalty_point_entries
      (tenant_slug, program_id, customer_code, invoice_id, type, points, expiry_date)
    values (${input.tenantSlug}, ${input.programId}, ${input.customerCode},
            ${input.invoiceId}, 'earn', ${points}, ${expiry})
    on conflict (tenant_slug, program_id, invoice_id, type) do nothing
    returning *
  `) as any[];
  if (!entry[0]) return { points: 0, note: "already earned for this invoice" };

  // Mirror into the shared POS ledger so one wallet serves both channels
  await SQL`
    insert into pos_loyalty_txns (id, tenant_slug, customer_code, sale_id, type, points, note)
    values (${`lpe_${randomUUID().slice(0, 10)}`}, ${input.tenantSlug}, ${input.customerCode},
            ${input.invoiceId}, 'earn', ${points}, ${`program:${prog[0].name}`})
  `;
  return { points, expiry, balance: await loyaltyBalance(input.tenantSlug, input.customerCode) };
}

/** Redeem points as a discount amount against an invoice. */
export async function redeemOnInvoice(input: {
  tenantSlug: string; programId: string; customerCode: string;
  invoiceId: string; invoiceAmount: number; points?: number;
}) {
  await ensureLoyaltyProgramTables();
  const prog = (await SQL`
    select * from loyalty_programs
    where id = ${input.programId} and tenant_slug = ${input.tenantSlug} and active
  `) as any[];
  if (!prog[0]) throw new Error("Loyalty program not found or inactive");

  const bal = await loyaltyBalance(input.tenantSlug, input.customerCode);
  const maxByPct = Math.floor(input.invoiceAmount * Number(prog[0].max_redeem_pct) / 100 / Number(prog[0].redeem_value));
  const want = input.points ?? Math.min(Math.floor(bal.points), maxByPct);
  const usable = Math.min(want, Math.floor(bal.points), maxByPct);
  if (usable < Number(prog[0].min_points_to_redeem)) {
    throw new Error(`Below minimum redemption of ${prog[0].min_points_to_redeem} points`);
  }
  if (usable <= 0) throw new Error("No redeemable points");

  const discount = Math.round(usable * Number(prog[0].redeem_value) * 100) / 100;
  const entry = (await SQL`
    insert into loyalty_point_entries
      (tenant_slug, program_id, customer_code, invoice_id, type, points, discount_amount)
    values (${input.tenantSlug}, ${input.programId}, ${input.customerCode},
            ${input.invoiceId}, 'redeem', ${usable}, ${discount})
    on conflict (tenant_slug, program_id, invoice_id, type) do nothing
    returning *
  `) as any[];
  if (!entry[0]) throw new Error("Points already redeemed on this invoice");

  await SQL`
    insert into pos_loyalty_txns (id, tenant_slug, customer_code, sale_id, type, points, value, note)
    values (${`lpe_${randomUUID().slice(0, 10)}`}, ${input.tenantSlug}, ${input.customerCode},
            ${input.invoiceId}, 'redeem', ${usable}, ${discount}, ${`program:${prog[0].name}`})
  `;
  return { pointsRedeemed: usable, discountAmount: discount, balance: await loyaltyBalance(input.tenantSlug, input.customerCode) };
}
