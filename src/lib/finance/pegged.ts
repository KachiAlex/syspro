/**
 * Pegged currencies — mirrors ERPNext's "Pegged Currencies" utility.
 * A peg means currency X is always converted to/from currency Y at a fixed
 * rate (e.g. AED pegged to USD at 3.6725). When resolving an exchange rate,
 * the engine: (1) tries a direct stored rate; (2) walks the peg chain —
 * rate(X) = rate(Y) × pegRate.
 */

import { db, sql as SQL } from "../sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { getExchangeRate } from "./currency";

export function ensurePeggedTables() {
  return ensureOnce("finance/pegged:tables", run);
}

async function run() {
  const sql = SQL;
  await sql`create table if not exists pegged_currencies (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    currency text not null,          -- the pegged currency (e.g. AED)
    pegged_to text not null,         -- the anchor currency (e.g. USD)
    rate numeric not null,           -- units of currency per 1 pegged_to
    active boolean not null default true,
    unique (tenant_slug, currency),
    check (currency <> pegged_to)
  )`;
}

export async function upsertPeggedCurrency(input: {
  tenantSlug: string; currency: string; peggedTo: string; rate: number; active?: boolean;
}) {
  await ensurePeggedTables();
  if (input.rate <= 0) throw new Error("Peg rate must be positive");
  if (input.currency.toUpperCase() === input.peggedTo.toUpperCase()) {
    throw new Error("A currency cannot be pegged to itself");
  }
  const rows = (await SQL`
    insert into pegged_currencies (tenant_slug, currency, pegged_to, rate, active)
    values (${input.tenantSlug}, ${input.currency.toUpperCase()}, ${input.peggedTo.toUpperCase()}, ${input.rate}, ${input.active ?? true})
    on conflict (tenant_slug, currency) do update
      set pegged_to = excluded.pegged_to, rate = excluded.rate, active = excluded.active
    returning *
  `) as any[];
  return rows[0];
}

export async function listPeggedCurrencies(tenantSlug: string) {
  await ensurePeggedTables();
  return (await SQL`select * from pegged_currencies where tenant_slug = ${tenantSlug} order by currency`) as any[];
}

/**
 * Resolve the effective rate (foreign units per base unit) for `currency`,
 * following peg chains when no direct rate is stored. Returns the rate and
 * the resolution path for transparency.
 */
export async function resolveRateWithPegs(input: {
  tenantSlug: string; currency: string; date?: string; maxDepth?: number;
}): Promise<{ rate: number; via: "direct" | "peg"; path: string[] } | null> {
  await ensurePeggedTables();
  const currency = input.currency.toUpperCase();
  const path: string[] = [currency];
  const visited = new Set([currency]);
  const date = input.date ?? new Date().toISOString().slice(0, 10);
  let current = currency;
  let product = 1;

  for (let depth = 0; depth < (input.maxDepth ?? 5); depth++) {
    const direct = await getExchangeRate(input.tenantSlug, current, date);
    if (direct != null) {
      return { rate: Math.round(direct * product * 1e8) / 1e8, via: depth === 0 ? "direct" : "peg", path };
    }
    const peg = (await SQL`
      select pegged_to, rate from pegged_currencies
      where tenant_slug = ${input.tenantSlug} and currency = ${current} and active
    `) as any[];
    if (!peg[0]) return null;
    const next = String(peg[0].pegged_to).toUpperCase();
    if (visited.has(next)) throw new Error(`Circular peg detected: ${[...path, next].join("→")}`);
    visited.add(next);
    // rate(X per anchor) — anchor is "more base-like", so multiply down the chain
    product *= Number(peg[0].rate);
    current = next;
    path.push(current);
  }
  throw new Error(`Peg chain too deep for ${currency} (>${input.maxDepth ?? 5} links)`);
}
