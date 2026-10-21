import { randomUUID } from "node:crypto";
import { sql as SQL } from "../sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { getPosConfig } from "./config";

export function ensureLoyaltyTables(...args: Parameters<typeof ensureRun>) {
  return ensureOnce("pos/loyalty:ensure", () => ensureRun(...args));
}

async function ensureRun(sql = SQL) {
  await sql`
    create table if not exists pos_loyalty_txns (
      id text primary key,
      tenant_slug text not null,
      customer_code text not null,
      sale_id text,
      type text not null check (type in ('earn','redeem','adjust')),
      points numeric not null,
      value numeric,
      note text,
      created_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists pos_loyalty_txns_customer on pos_loyalty_txns (tenant_slug, customer_code)`;
}

export async function loyaltyBalance(tenantSlug: string, customerCode: string) {
  const sql = SQL;
  await ensureLoyaltyTables(sql);
  const rows = (await sql`
    select coalesce(sum(case when type in ('earn','adjust') then points else -points end), 0)::numeric as points
    from pos_loyalty_txns
    where tenant_slug = ${tenantSlug} and customer_code = ${customerCode}
  `) as any[];
  const cfg = await getPosConfig(tenantSlug);
  const points = Number(rows[0]?.points ?? 0);
  return { customerCode, points, redeemValue: r2(points * cfg.loyalty.redeemValue), config: cfg.loyalty };
}

export async function adjustLoyalty(
  tenantSlug: string,
  input: { customerCode: string; points: number; note?: string }
) {
  const sql = SQL;
  await ensureLoyaltyTables(sql);
  await sql`
    insert into pos_loyalty_txns (id, tenant_slug, customer_code, type, points, note)
    values (${`plt_${randomUUID().slice(0, 10)}`}, ${tenantSlug}, ${input.customerCode},
            'adjust', ${input.points}, ${input.note ?? null})
  `;
  return loyaltyBalance(tenantSlug, input.customerCode);
}

const r2 = (n: number) => Math.round(n * 100) / 100;
