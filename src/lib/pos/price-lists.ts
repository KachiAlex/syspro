import { randomUUID } from "node:crypto";
import { sql as SQL } from "../sql-client";
import { ensureOnce } from "@/lib/ensure-once";

export function ensurePriceListTables(...args: Parameters<typeof ensureRun>) {
  return ensureOnce("pos/price-lists:ensure", () => ensureRun(...args));
}

async function ensureRun(sql = SQL) {
  await sql`
    create table if not exists pos_price_lists (
      id text primary key,
      tenant_slug text not null,
      name text not null,
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists pos_price_list_items (
      id text primary key,
      tenant_slug text not null,
      price_list_id text not null references pos_price_lists (id) on delete cascade,
      sku text not null,
      price numeric not null check (price >= 0),
      unique (price_list_id, sku)
    )
  `;
}

export async function listPriceLists(tenantSlug: string) {
  const sql = SQL;
  await ensurePriceListTables(sql);
  const rows = (await sql`
    select pl.*,
           coalesce(jsonb_agg(jsonb_build_object('sku', pli.sku, 'price', pli.price)
                              order by pli.sku) filter (where pli.id is not null), '[]'::jsonb) as items
    from pos_price_lists pl
    left join pos_price_list_items pli on pli.price_list_id = pl.id and pli.tenant_slug = pl.tenant_slug
    where pl.tenant_slug = ${tenantSlug}
    group by pl.id order by pl.name
  `) as any[];
  return rows.map((r) => ({
    id: r.id, name: r.name, isActive: r.is_active, createdAt: r.created_at, items: r.items,
  }));
}

export async function upsertPriceList(
  tenantSlug: string,
  input: { id?: string; name: string; isActive?: boolean; items: Array<{ sku: string; price: number }> }
) {
  const sql = SQL;
  await ensurePriceListTables(sql);
  const id = input.id ?? `pl_${randomUUID().slice(0, 10)}`;
  await sql`
    insert into pos_price_lists (id, tenant_slug, name, is_active)
    values (${id}, ${tenantSlug}, ${input.name}, ${input.isActive ?? true})
    on conflict (id) do update set name = excluded.name, is_active = excluded.is_active
  `;
  await sql`delete from pos_price_list_items where tenant_slug = ${tenantSlug} and price_list_id = ${id}`;
  for (const it of input.items ?? []) {
    if (!it.sku || !(it.price >= 0)) continue;
    await sql`
      insert into pos_price_list_items (id, tenant_slug, price_list_id, sku, price)
      values (${`pli_${randomUUID().slice(0, 10)}`}, ${tenantSlug}, ${id}, ${it.sku}, ${it.price})
      on conflict (price_list_id, sku) do update set price = excluded.price
    `;
  }
  return { id };
}
