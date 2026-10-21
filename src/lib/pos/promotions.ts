import { randomUUID } from "crypto";

import { sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";

// ---------------------------------------------------------------------------
// Promotions: time-boxed rules evaluated against resolved sale lines.
// Types:
//   percent    — % off each matching line
//   amount     — fixed amount off each matching line
//   bogo       — buy `buyQty`, get `getQty` free on matching SKUs
//   bundle     — `minQty` items across the SKU set priced at `bundlePrice`
// `skus` empty/null => applies to every line.
// ---------------------------------------------------------------------------

export type Promotion = {
  id: string;
  code: string;
  name: string;
  type: "percent" | "amount" | "bogo" | "bundle";
  percent?: number | null;
  amount?: number | null;
  buyQty?: number | null;
  getQty?: number | null;
  minQty?: number | null;
  bundlePrice?: number | null;
  skus: string[] | null;
  activeFrom: string;
  activeTo: string;
};

export function ensurePromotionTables(...args: Parameters<typeof ensureRun>) {
  return ensureOnce("pos/promotions:ensureTables", () => ensureRun(...args));
}

async function ensureRun(sql = SQL) {
  await sql`
    create table if not exists pos_promotions (
      id text primary key,
      tenant_slug text not null,
      code text not null,
      name text not null,
      type text not null check (type in ('percent','amount','bogo','bundle')),
      percent numeric,
      amount numeric,
      buy_qty integer,
      get_qty integer,
      min_qty integer,
      bundle_price numeric,
      skus text[],
      active_from timestamptz not null,
      active_to timestamptz not null,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      unique (tenant_slug, code)
    )
  `;
}

export async function listPromotions(tenantSlug: string, includeInactive = false) {
  await ensurePromotionTables();
  const rows = (await SQL`
    select id, code, name, type, percent::float, amount::float,
           buy_qty, get_qty, min_qty, bundle_price::float,
           skus, active_from, active_to, is_active
    from pos_promotions
    where tenant_slug = ${tenantSlug}
      ${includeInactive ? SQL`` : SQL`and is_active`}
    order by code
  `) as any[];
  return rows;
}

export async function upsertPromotion(tenantSlug: string, p: Partial<Promotion> & { code: string; name: string; type: Promotion["type"] }) {
  await ensurePromotionTables();
  const id = p.id ?? `promo_${randomUUID().slice(0, 10)}`;
  await SQL`
    insert into pos_promotions (id, tenant_slug, code, name, type, percent, amount,
      buy_qty, get_qty, min_qty, bundle_price, skus, active_from, active_to, is_active)
    values (${id}, ${tenantSlug}, ${p.code}, ${p.name}, ${p.type}, ${p.percent ?? null},
      ${p.amount ?? null}, ${p.buyQty ?? null}, ${p.getQty ?? null}, ${p.minQty ?? null},
      ${p.bundlePrice ?? null}, ${p.skus ?? null}, ${p.activeFrom ?? "now"},
      ${p.activeTo ?? "2100-01-01"}, ${true})
    on conflict (tenant_slug, code) do update set
      name = excluded.name, type = excluded.type, percent = excluded.percent,
      amount = excluded.amount, buy_qty = excluded.buy_qty, get_qty = excluded.get_qty,
      min_qty = excluded.min_qty, bundle_price = excluded.bundle_price,
      skus = excluded.skus, active_from = excluded.active_from,
      active_to = excluded.active_to, is_active = true
  `;
  return { id };
}

export async function deactivatePromotion(tenantSlug: string, id: string) {
  await ensurePromotionTables();
  await SQL`update pos_promotions set is_active = false where id = ${id} and tenant_slug = ${tenantSlug}`;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Evaluates active promotions against resolved lines (each line needs
 * { sku, qty, price, discount }). Mutates `lines` by increasing
 * `discount` (capped at the line's remaining gross) and returns a list of
 * applied promotion codes for audit/metadata.
 */
export async function applyPromotions(
  tenantSlug: string,
  lines: Array<{ sku: string; qty: number; price: number; discount: number }>,
  at?: Date
): Promise<string[]> {
  await ensurePromotionTables();
  const now = at ?? new Date();
  const promos = (await SQL`
    select * from pos_promotions
    where tenant_slug = ${tenantSlug} and is_active
      and active_from <= ${now.toISOString()} and active_to >= ${now.toISOString()}
    order by created_at
  `) as any[];
  if (!promos.length) return [];

  const applied: string[] = [];
  const addDisc = (line: { qty: number; price: number; discount: number }, amount: number) => {
    const gross = line.qty * line.price;
    line.discount = r2(Math.min(gross, line.discount + amount));
  };

  for (const p of promos) {
    const matching = lines.filter((l) => !p.skus?.length || p.skus.includes(l.sku));
    if (!matching.length) continue;

    if (p.type === "percent" && p.percent > 0) {
      for (const l of matching) addDisc(l, (l.qty * l.price * Number(p.percent)) / 100);
      applied.push(p.code);
    } else if (p.type === "amount" && p.amount > 0) {
      for (const l of matching) addDisc(l, Number(p.amount));
      applied.push(p.code);
    } else if (p.type === "bogo" && p.buy_qty > 0 && p.get_qty > 0) {
      for (const l of matching) {
        const sets = Math.floor(l.qty / (Number(p.buy_qty) + Number(p.get_qty)));
        if (sets > 0) addDisc(l, sets * Number(p.get_qty) * l.price);
      }
      applied.push(p.code);
    } else if (p.type === "bundle" && p.min_qty > 0 && p.bundle_price != null) {
      // Price each complete group of min_qty items (cheapest-first) at bundlePrice.
      const pool: Array<{ line: (typeof matching)[number]; price: number }> = [];
      for (const l of matching) for (let i = 0; i < l.qty; i++) pool.push({ line: l, price: l.price });
      pool.sort((a, b) => b.price - a.price); // most expensive first → they enter bundles
      const sets = Math.floor(pool.length / Number(p.min_qty));
      for (let s = 0; s < sets; s++) {
        const group = pool.slice(s * Number(p.min_qty), (s + 1) * Number(p.min_qty));
        const groupValue = group.reduce((sum, g) => sum + g.price, 0);
        const saving = groupValue - Number(p.bundle_price);
        if (saving > 0) {
          // Discount lands on the cheapest line in the group.
          const cheapest = group.reduce((a, b) => (b.price < a.price ? b : a));
          addDisc(cheapest.line, saving);
        }
      }
      if (sets > 0) applied.push(p.code);
    }
  }
  return applied;
}
