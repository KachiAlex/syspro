import { randomUUID } from "crypto";

import { db, sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { cached, invalidatePrefix } from "@/lib/cache";

export function ensureItemMasterTables() {
  return ensureOnce("inventory/item-master:ensureTables", ensureItemMasterTablesRun);
}

async function ensureItemMasterTablesRun() {
  const sql = SQL;
  await sql`create table if not exists inventory_uom_categories (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    name text not null,
    unique (tenant_slug, name)
  )`;
  await sql`create table if not exists inventory_uoms (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    name text not null,
    category_id uuid references inventory_uom_categories(id),
    must_be_whole boolean not null default false,
    unique (tenant_slug, name)
  )`;
  await sql`create table if not exists inventory_uom_conversions (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    from_uom text not null,
    to_uom text not null,
    factor numeric not null check (factor > 0),
    unique (tenant_slug, from_uom, to_uom)
  )`;
  await sql`alter table if exists inventory_products add column if not exists stock_uom text default 'Unit'`;
  await sql`create table if not exists inventory_item_groups (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    name text not null,
    parent_id uuid references inventory_item_groups(id),
    is_group boolean not null default false,
    unique (tenant_slug, name, parent_id)
  )`;
  await sql`alter table if exists inventory_products add column if not exists item_group_id uuid`;
  await sql`create table if not exists inventory_item_attributes (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    name text not null,
    values text[] not null default '{}',
    unique (tenant_slug, name)
  )`;
  await sql`create table if not exists inventory_item_variants (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    template_product_id text not null,
    variant_sku text not null,
    attributes jsonb not null default '{}',
    sale_price numeric,
    unit_cost numeric,
    enabled boolean not null default true,
    created_at timestamptz not null default now(),
    unique (tenant_slug, variant_sku)
  )`;
  await sql`create index if not exists inventory_item_variants_template_idx
    on inventory_item_variants (tenant_slug, template_product_id)`;
  await sql`create table if not exists inventory_product_bundles (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    bundle_sku text not null,
    name text not null,
    description text,
    enabled boolean not null default true,
    created_at timestamptz not null default now(),
    unique (tenant_slug, bundle_sku)
  )`;
  await sql`create table if not exists inventory_product_bundle_items (
    id uuid primary key default gen_random_uuid(),
    bundle_id uuid not null references inventory_product_bundles(id) on delete cascade,
    product_sku text not null,
    quantity numeric not null check (quantity > 0)
  )`;
}

// ---------------------------------------------------------------------------
// UOM
// ---------------------------------------------------------------------------

export async function listUoms(tenantSlug: string) {
  await ensureItemMasterTables();
  return cached(`refdata:uoms:${tenantSlug}`, 300_000, async () => {
  const uoms = (await db.query(
    `SELECT u.*, c.name AS category_name FROM inventory_uoms u
     LEFT JOIN inventory_uom_categories c ON c.id = u.category_id
     WHERE u.tenant_slug = $1 ORDER BY u.name`, [tenantSlug])).rows;
  const conversions = (await db.query(
    `SELECT * FROM inventory_uom_conversions WHERE tenant_slug = $1`, [tenantSlug])).rows;
  return { uoms, conversions };
  });
}

export async function upsertUom(tenantSlug: string, name: string, opts?: { categoryId?: string; mustBeWhole?: boolean }) {
  await ensureItemMasterTables();
  invalidatePrefix(`refdata:uoms:${tenantSlug}`);
  return (await db.query(
    `INSERT INTO inventory_uoms (tenant_slug, name, category_id, must_be_whole)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (tenant_slug, name) DO UPDATE SET category_id = excluded.category_id, must_be_whole = excluded.must_be_whole
     RETURNING *`,
    [tenantSlug, name, opts?.categoryId ?? null, opts?.mustBeWhole ?? false])).rows[0];
}

export async function upsertUomConversion(tenantSlug: string, fromUom: string, toUom: string, factor: number) {
  await ensureItemMasterTables();
  invalidatePrefix(`refdata:uoms:${tenantSlug}`);
  invalidatePrefix(`refdata:uomconv:${tenantSlug}`);
  return (await db.query(
    `INSERT INTO inventory_uom_conversions (tenant_slug, from_uom, to_uom, factor)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (tenant_slug, from_uom, to_uom) DO UPDATE SET factor = excluded.factor
     RETURNING *`,
    [tenantSlug, fromUom, toUom, factor])).rows[0];
}

/**
 * Convert a quantity between UOMs using direct conversions first, then a
 * BFS through the conversion graph (e.g. Case→Pack→Unit).
 */
export async function convertUom(tenantSlug: string, quantity: number, fromUom: string, toUom: string): Promise<number> {
  await ensureItemMasterTables();
  if (fromUom === toUom) return quantity;
  const rows = await cached(`refdata:uomconv:${tenantSlug}`, 300_000, async () =>
    (await db.query(
      `SELECT from_uom, to_uom, factor FROM inventory_uom_conversions WHERE tenant_slug = $1`, [tenantSlug])).rows
  );
  const edges: { from: string; to: string; factor: number }[] = [];
  for (const r of rows) {
    edges.push({ from: r.from_uom, to: r.to_uom, factor: Number(r.factor) });
    edges.push({ from: r.to_uom, to: r.from_uom, factor: 1 / Number(r.factor) });
  }
  const queue: { uom: string; factor: number }[] = [{ uom: fromUom, factor: 1 }];
  const visited = new Set([fromUom]);
  while (queue.length) {
    const { uom, factor } = queue.shift()!;
    for (const e of edges.filter((x) => x.from === uom)) {
      if (e.to === toUom) return quantity * factor * e.factor;
      if (!visited.has(e.to)) { visited.add(e.to); queue.push({ uom: e.to, factor: factor * e.factor }); }
    }
  }
  throw new Error(`No UOM conversion path from ${fromUom} to ${toUom}`);
}

// ---------------------------------------------------------------------------
// Item groups (tree)
// ---------------------------------------------------------------------------

export async function listItemGroups(tenantSlug: string) {
  await ensureItemMasterTables();
  return cached(`refdata:itemgroups:${tenantSlug}`, 300_000, async () =>
    (await db.query(
    `SELECT g.*, p.name AS parent_name,
       (SELECT count(*) FROM inventory_products i WHERE i.item_group_id = g.id)::int AS product_count
     FROM inventory_item_groups g
     LEFT JOIN inventory_item_groups p ON p.id = g.parent_id
     WHERE g.tenant_slug = $1 ORDER BY g.name`, [tenantSlug])).rows
  );
}

export async function upsertItemGroup(tenantSlug: string, name: string, parentId?: string | null, isGroup?: boolean) {
  await ensureItemMasterTables();
  invalidatePrefix(`refdata:itemgroups:${tenantSlug}`);
  if (parentId) {
    const parent = (await db.query(
      `SELECT id FROM inventory_item_groups WHERE id = $1 AND tenant_slug = $2`, [parentId, tenantSlug])).rows[0];
    if (!parent) throw new Error("Parent group not found");
  }
  return (await db.query(
    `INSERT INTO inventory_item_groups (tenant_slug, name, parent_id, is_group)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (tenant_slug, name, parent_id) DO UPDATE SET is_group = excluded.is_group
     RETURNING *`,
    [tenantSlug, name, parentId ?? null, isGroup ?? false])).rows[0];
}

// ---------------------------------------------------------------------------
// Item variants
// ---------------------------------------------------------------------------

export async function upsertAttribute(tenantSlug: string, name: string, values: string[]) {
  await ensureItemMasterTables();
  return (await db.query(
    `INSERT INTO inventory_item_attributes (tenant_slug, name, values)
     VALUES ($1,$2,$3)
     ON CONFLICT (tenant_slug, name) DO UPDATE SET values = excluded.values
     RETURNING *`,
    [tenantSlug, name, values])).rows[0];
}

export async function listAttributes(tenantSlug: string) {
  await ensureItemMasterTables();
  return (await db.query(
    `SELECT * FROM inventory_item_attributes WHERE tenant_slug = $1 ORDER BY name`, [tenantSlug])).rows;
}

export async function createVariant(input: {
  tenantSlug: string;
  templateProductId: string;
  attributes: Record<string, string>;
  salePrice?: number | null;
  unitCost?: number | null;
}) {
  await ensureItemMasterTables();
  const suffix = Object.values(input.attributes).map((v) => v.replace(/\s+/g, "").toUpperCase()).join("-");
  const variantSku = `${input.templateProductId}-${suffix || randomUUID().slice(0, 6).toUpperCase()}`;
  return (await db.query(
    `INSERT INTO inventory_item_variants (tenant_slug, template_product_id, variant_sku, attributes, sale_price, unit_cost)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [input.tenantSlug, input.templateProductId, variantSku, JSON.stringify(input.attributes), input.salePrice ?? null, input.unitCost ?? null])).rows[0];
}

export async function listVariants(tenantSlug: string, templateProductId?: string) {
  await ensureItemMasterTables();
  return templateProductId
    ? (await db.query(
        `SELECT * FROM inventory_item_variants WHERE tenant_slug = $1 AND template_product_id = $2 AND enabled ORDER BY variant_sku`,
        [tenantSlug, templateProductId])).rows
    : (await db.query(
        `SELECT * FROM inventory_item_variants WHERE tenant_slug = $1 AND enabled ORDER BY template_product_id, variant_sku`,
        [tenantSlug])).rows;
}

// ---------------------------------------------------------------------------
// Product bundles (sales kits — explode on sale, no production)
// ---------------------------------------------------------------------------

export async function upsertBundle(input: {
  tenantSlug: string;
  bundleSku: string;
  name: string;
  description?: string | null;
  items: { productSku: string; quantity: number }[];
}) {
  await ensureItemMasterTables();
  const row = (await db.query(
    `INSERT INTO inventory_product_bundles (tenant_slug, bundle_sku, name, description)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (tenant_slug, bundle_sku) DO UPDATE SET name = excluded.name, description = excluded.description
     RETURNING *`,
    [input.tenantSlug, input.bundleSku, input.name, input.description ?? null])).rows[0];
  await db.query(`DELETE FROM inventory_product_bundle_items WHERE bundle_id = $1`, [row.id]);
  for (const item of input.items) {
    await db.query(
      `INSERT INTO inventory_product_bundle_items (bundle_id, product_sku, quantity) VALUES ($1,$2,$3)`,
      [row.id, item.productSku, item.quantity]);
  }
  return row;
}

export async function listBundles(tenantSlug: string) {
  await ensureItemMasterTables();
  const bundles = (await db.query(
    `SELECT * FROM inventory_product_bundles WHERE tenant_slug = $1 AND enabled ORDER BY bundle_sku`, [tenantSlug])).rows;
  if (!bundles.length) return [];
  const items = (await db.query(
    `SELECT * FROM inventory_product_bundle_items WHERE bundle_id = ANY($1::uuid[])`,
    [bundles.map((b: any) => b.id)])).rows;
  return bundles.map((b: any) => ({ ...b, items: items.filter((i: any) => i.bundle_id === b.id) }));
}

/** Resolve a bundle SKU into component lines (for SO/POS explosion). */
export async function explodeBundle(tenantSlug: string, bundleSku: string) {
  await ensureItemMasterTables();
  const bundle = (await db.query(
    `SELECT * FROM inventory_product_bundles WHERE tenant_slug = $1 AND bundle_sku = $2 AND enabled`,
    [tenantSlug, bundleSku])).rows[0];
  if (!bundle) return null;
  const items = (await db.query(
    `SELECT * FROM inventory_product_bundle_items WHERE bundle_id = $1`, [bundle.id])).rows;
  return { bundle, items };
}
