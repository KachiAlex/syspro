import { randomUUID } from "crypto";
import { sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";

// ---------------------------------------------------------------------------
// Pricing engine (ERPNext: Pricing Rule, Promotional Scheme, Coupon Code).
// Best-match rule resolution for item pricing at document time.
// ---------------------------------------------------------------------------

export function ensurePricingTables() {
  return ensureOnce("finance/pricing:ensureTables", async () => {
    const sql = SQL;
    await sql`
      create table if not exists pricing_rules (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        name text not null,
        priority integer not null default 0,
        item text,
        item_category text,
        party_type text,
        party_id text,
        min_qty numeric,
        valid_from date,
        valid_to date,
        mode text not null default 'discount_pct' check (mode in ('price','discount_pct','margin')),
        value numeric not null,
        active boolean not null default true,
        created_at timestamptz not null default now()
      )`;
    await sql`create index if not exists pricing_rules_idx on pricing_rules (tenant_slug, priority)`;

    await sql`
      create table if not exists promotional_schemes (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        name text not null,
        rules jsonb not null default '[]'::jsonb,
        valid_from date,
        valid_to date,
        active boolean not null default true,
        created_at timestamptz not null default now(),
        unique (tenant_slug, name)
      )`;

    await sql`
      create table if not exists coupon_codes (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        code text not null,
        description text,
        discount_type text not null default 'percent' check (discount_type in ('percent','fixed')),
        discount_value numeric not null,
        min_order_value numeric,
        valid_from date,
        valid_to date,
        max_uses integer,
        used_count integer not null default 0,
        active boolean not null default true,
        created_at timestamptz not null default now(),
        unique (tenant_slug, code)
      )`;
  });
}

export async function upsertPricingRule(input: {
  tenantSlug: string; name: string; priority?: number;
  item?: string; itemCategory?: string;
  partyType?: "customer" | "customer_group"; partyId?: string;
  minQty?: number; validFrom?: string; validTo?: string;
  mode: "price" | "discount_pct" | "margin"; value: number; active?: boolean;
}) {
  await ensurePricingTables();
  const [row] = (await SQL`
    insert into pricing_rules (tenant_slug, name, priority, item, item_category, party_type, party_id,
                               min_qty, valid_from, valid_to, mode, value, active)
    values (${input.tenantSlug}, ${input.name.trim()}, ${input.priority ?? 0}, ${input.item ?? null},
            ${input.itemCategory ?? null}, ${input.partyType ?? null}, ${input.partyId ?? null},
            ${input.minQty ?? null}, ${input.validFrom ?? null}, ${input.validTo ?? null},
            ${input.mode}, ${input.value}, ${input.active ?? true})
    returning *
  `) as any[];
  return row;
}

export async function listPricingRules(tenantSlug: string) {
  await ensurePricingTables();
  return (await SQL`
    select * from pricing_rules where tenant_slug = ${tenantSlug} and active
    order by priority desc, created_at
  `) as any[];
}

/**
 * Resolves the best price for an item. Rule precedence: priority desc; then
 * item-specific > category > generic; party-specific > generic.
 *   - price: absolute unit price
 *   - discount_pct: basePrice × (1 − value/100)
 *   - margin: unitCost × (1 + value/100)
 */
export async function resolvePrice(input: {
  tenantSlug: string; item: string; itemCategory?: string;
  qty?: number; partyType?: string; partyId?: string;
  basePrice: number; unitCost?: number; date?: string;
}): Promise<{ price: number; rule: string | null; mode: string | null }> {
  await ensurePricingTables();
  const date = input.date ?? new Date().toISOString().slice(0, 10);
  const rules = (await SQL`
    select * from pricing_rules
    where tenant_slug = ${input.tenantSlug} and active
      and (item is null or item = ${input.item})
      and (item_category is null or item_category = ${input.itemCategory ?? null})
      and (party_type is null or party_type = ${input.partyType ?? null})
      and (party_id is null or party_id = ${input.partyId ?? null})
      and (min_qty is null or ${input.qty ?? 1} >= min_qty)
      and (valid_from is null or valid_from <= ${date})
      and (valid_to is null or valid_to >= ${date})
    order by priority desc,
         (item is not null)::int + (party_id is not null)::int desc,
         created_at
    limit 1
  `) as any[];
  const r = rules[0];
  if (!r) return { price: input.basePrice, rule: null, mode: null };
  let price = input.basePrice;
  if (r.mode === "price") price = Number(r.value);
  else if (r.mode === "discount_pct") price = input.basePrice * (1 - Number(r.value) / 100);
  else if (r.mode === "margin") price = (input.unitCost ?? input.basePrice) * (1 + Number(r.value) / 100);
  return { price: Math.round(price * 100) / 100, rule: r.name, mode: r.mode };
}

// ─── Promotional schemes & coupons ─────────────────────────────────────────

export async function upsertPromotionalScheme(input: {
  tenantSlug: string; name: string;
  rules: Array<{ item?: string; minQty?: number; discountPct?: number; freeItem?: string; freeQty?: number }>;
  validFrom?: string; validTo?: string; active?: boolean;
}) {
  await ensurePricingTables();
  const [row] = (await SQL`
    insert into promotional_schemes (tenant_slug, name, rules, valid_from, valid_to, active)
    values (${input.tenantSlug}, ${input.name.trim()}, ${JSON.stringify(input.rules)},
            ${input.validFrom ?? null}, ${input.validTo ?? null}, ${input.active ?? true})
    on conflict (tenant_slug, name) do update set
      rules = excluded.rules, valid_from = excluded.valid_from,
      valid_to = excluded.valid_to, active = excluded.active
    returning *
  `) as any[];
  return row;
}

export async function upsertCouponCode(input: {
  tenantSlug: string; code: string; description?: string;
  discountType: "percent" | "fixed"; discountValue: number;
  minOrderValue?: number; validFrom?: string; validTo?: string; maxUses?: number; active?: boolean;
}) {
  await ensurePricingTables();
  const [row] = (await SQL`
    insert into coupon_codes (tenant_slug, code, description, discount_type, discount_value, min_order_value, valid_from, valid_to, max_uses, active)
    values (${input.tenantSlug}, ${input.code.trim().toUpperCase()}, ${input.description ?? null},
            ${input.discountType}, ${input.discountValue}, ${input.minOrderValue ?? null},
            ${input.validFrom ?? null}, ${input.validTo ?? null}, ${input.maxUses ?? null}, ${input.active ?? true})
    on conflict (tenant_slug, code) do update set
      description = excluded.description, discount_type = excluded.discount_type,
      discount_value = excluded.discount_value, min_order_value = excluded.min_order_value,
      valid_from = excluded.valid_from, valid_to = excluded.valid_to,
      max_uses = excluded.max_uses, active = excluded.active
    returning *
  `) as any[];
  return row;
}

/** Validates and redeems a coupon against an order total. */
export async function redeemCoupon(input: {
  tenantSlug: string; code: string; orderValue: number; date?: string;
}): Promise<{ valid: boolean; discount: number; reason?: string }> {
  await ensurePricingTables();
  const [c] = (await SQL`
    select * from coupon_codes where tenant_slug = ${input.tenantSlug} and code = ${input.code.trim().toUpperCase()}
  `) as any[];
  if (!c || !c.active) return { valid: false, discount: 0, reason: "invalid code" };
  const date = input.date ?? new Date().toISOString().slice(0, 10);
  if (c.valid_from && date < c.valid_from) return { valid: false, discount: 0, reason: "not yet valid" };
  if (c.valid_to && date > c.valid_to) return { valid: false, discount: 0, reason: "expired" };
  if (c.max_uses && c.used_count >= c.max_uses) return { valid: false, discount: 0, reason: "usage limit reached" };
  if (c.min_order_value && input.orderValue < Number(c.min_order_value)) {
    return { valid: false, discount: 0, reason: `minimum order ${c.min_order_value}` };
  }
  const discount = c.discount_type === "percent"
    ? Math.round(input.orderValue * Number(c.discount_value)) / 100
    : Math.min(Number(c.discount_value), input.orderValue);
  await SQL`update coupon_codes set used_count = used_count + 1 where id = ${c.id}`;
  return { valid: true, discount: Math.round(discount * 100) / 100 };
}
