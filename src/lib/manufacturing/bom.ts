import { randomUUID } from "crypto";
import { sql as SQL, SqlClient } from "../sql-client";

export interface BomHeader {
  id: string;
  tenantSlug: string;
  productSku: string;
  productName: string;
  revision: string;
  status: "draft" | "active" | "deprecated";
  quantity: number;
  unit: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BomLine {
  id: string;
  bomId: string;
  componentSku: string;
  componentName: string;
  quantity: number;
  unit: string;
  componentType: "raw_material" | "subassembly" | "finished_good";
  scrapPercentage: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BomWithLines extends BomHeader {
  lines: BomLine[];
}

export interface BomExplosionItem {
  componentSku: string;
  componentName: string;
  quantity: number;
  unit: string;
  level: number;
  componentType: string;
  path: string[];
}

export async function ensureBomTables(sql: SqlClient = SQL) {
  await sql`
    create table if not exists bom_headers (
      id text primary key,
      tenant_slug text not null,
      product_sku text not null,
      product_name text not null,
      revision text not null default '1',
      status text not null default 'draft' check (status in ('draft', 'active', 'deprecated')),
      quantity numeric not null default 1,
      unit text not null default 'pcs',
      description text,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      constraint unique_bom unique (tenant_slug, product_sku, revision)
    )
  `;

  await sql`
    create table if not exists bom_lines (
      id text primary key,
      bom_id text not null references bom_headers (id) on delete cascade,
      component_sku text not null,
      component_name text not null,
      quantity numeric not null,
      unit text not null default 'pcs',
      component_type text not null default 'raw_material' check (component_type in ('raw_material', 'subassembly', 'finished_good')),
      scrap_percentage numeric not null default 0,
      notes text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`create index if not exists bom_headers_tenant_idx on bom_headers (tenant_slug, status)`;
  await sql`create index if not exists bom_headers_product_idx on bom_headers (tenant_slug, product_sku)`;
  await sql`create index if not exists bom_lines_bom_idx on bom_lines (bom_id)`;
  await sql`create index if not exists bom_lines_component_idx on bom_lines (component_sku)`;
}

export async function createBom(data: {
  tenantSlug: string;
  productSku: string;
  productName: string;
  revision?: string;
  status?: string;
  quantity?: number;
  unit?: string;
  description?: string;
  lines: Array<{
    componentSku: string;
    componentName: string;
    quantity: number;
    unit?: string;
    componentType?: string;
    scrapPercentage?: number;
    notes?: string;
  }>;
}): Promise<BomWithLines> {
  const sql = SQL;
  await ensureBomTables(sql);

  const id = randomUUID();
  const now = new Date();

  await sql`
    insert into bom_headers (id, tenant_slug, product_sku, product_name, revision, status, quantity, unit, description, created_at, updated_at)
    values (${id}, ${data.tenantSlug}, ${data.productSku}, ${data.productName}, ${data.revision ?? "1"}, ${data.status ?? "draft"}, ${data.quantity ?? 1}, ${data.unit ?? "pcs"}, ${data.description ?? null}, ${now}, ${now})
  `;

  const lines: BomLine[] = [];
  for (const line of data.lines) {
    const lineId = randomUUID();
    await sql`
      insert into bom_lines (id, bom_id, component_sku, component_name, quantity, unit, component_type, scrap_percentage, notes, created_at, updated_at)
      values (${lineId}, ${id}, ${line.componentSku}, ${line.componentName}, ${line.quantity}, ${line.unit ?? "pcs"}, ${line.componentType ?? "raw_material"}, ${line.scrapPercentage ?? 0}, ${line.notes ?? null}, ${now}, ${now})
    `;
    lines.push({
      id: lineId,
      bomId: id,
      componentSku: line.componentSku,
      componentName: line.componentName,
      quantity: line.quantity,
      unit: line.unit ?? "pcs",
      componentType: (line.componentType ?? "raw_material") as BomLine["componentType"],
      scrapPercentage: line.scrapPercentage ?? 0,
      notes: line.notes ?? null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  }

  return {
    id,
    tenantSlug: data.tenantSlug,
    productSku: data.productSku,
    productName: data.productName,
    revision: data.revision ?? "1",
    status: (data.status ?? "draft") as BomHeader["status"],
    quantity: data.quantity ?? 1,
    unit: data.unit ?? "pcs",
    description: data.description ?? null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    lines,
  };
}

export async function listBoms(tenantSlug: string, status?: string): Promise<BomHeader[]> {
  const sql = SQL;
  await ensureBomTables(sql);

  const rows = status
    ? (await sql`select * from bom_headers where tenant_slug = ${tenantSlug} and status = ${status} order by product_name`)
    : (await sql`select * from bom_headers where tenant_slug = ${tenantSlug} order by product_name`);

  return (rows as any[]).map(normalizeBomHeader);
}

export async function getBom(id: string, tenantSlug: string): Promise<BomWithLines | null> {
  const sql = SQL;
  await ensureBomTables(sql);

  const [header] = (await sql`
    select * from bom_headers where id = ${id} and tenant_slug = ${tenantSlug}
  `) as any[];

  if (!header) return null;

  const lineRows = (await sql`
    select * from bom_lines where bom_id = ${id} order by created_at
  `) as any[];

  return {
    ...normalizeBomHeader(header),
    lines: lineRows.map(normalizeBomLine),
  };
}

export async function getBomByProductSku(productSku: string, tenantSlug: string): Promise<BomWithLines | null> {
  const sql = SQL;
  await ensureBomTables(sql);

  const [header] = (await sql`
    select * from bom_headers
    where tenant_slug = ${tenantSlug} and product_sku = ${productSku} and status = 'active'
    order by revision desc
    limit 1
  `) as any[];

  if (!header) return null;

  const lineRows = (await sql`
    select * from bom_lines where bom_id = ${header.id} order by created_at
  `) as any[];

  return {
    ...normalizeBomHeader(header),
    lines: lineRows.map(normalizeBomLine),
  };
}

export async function updateBom(
  id: string,
  tenantSlug: string,
  updates: {
    productName?: string;
    status?: string;
    quantity?: number;
    unit?: string;
    description?: string;
  }
): Promise<BomHeader | null> {
  const sql = SQL;
  await ensureBomTables(sql);

  const sets: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;

  if (updates.productName !== undefined) { sets.push(`product_name = $${paramIdx++}`); values.push(updates.productName); }
  if (updates.status !== undefined) { sets.push(`status = $${paramIdx++}`); values.push(updates.status); }
  if (updates.quantity !== undefined) { sets.push(`quantity = $${paramIdx++}`); values.push(updates.quantity); }
  if (updates.unit !== undefined) { sets.push(`unit = $${paramIdx++}`); values.push(updates.unit); }
  if (updates.description !== undefined) { sets.push(`description = $${paramIdx++}`); values.push(updates.description); }

  if (sets.length === 0) return null;

  sets.push(`updated_at = now()`);
  values.push(id, tenantSlug);

  const [row] = (await sql`
    update bom_headers
    set product_name = ${updates.productName ?? null}::text,
        status = ${updates.status ?? null}::text,
        quantity = ${updates.quantity ?? null}::numeric,
        unit = ${updates.unit ?? null}::text,
        description = ${updates.description ?? null}::text,
        updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug}
    returning *
  `) as any[];

  return row ? normalizeBomHeader(row) : null;
}

export async function deleteBom(id: string, tenantSlug: string): Promise<boolean> {
  const sql = SQL;
  await ensureBomTables(sql);

  const [row] = (await sql`
    delete from bom_headers where id = ${id} and tenant_slug = ${tenantSlug} returning id
  `) as any[];

  return !!row;
}

export async function addBomLine(
  bomId: string,
  tenantSlug: string,
  line: {
    componentSku: string;
    componentName: string;
    quantity: number;
    unit?: string;
    componentType?: string;
    scrapPercentage?: number;
    notes?: string;
  }
): Promise<BomLine | null> {
  const sql = SQL;
  await ensureBomTables(sql);

  const lineId = randomUUID();
  const now = new Date();

  const [row] = (await sql`
    insert into bom_lines (id, bom_id, component_sku, component_name, quantity, unit, component_type, scrap_percentage, notes, created_at, updated_at)
    values (${lineId}, ${bomId}, ${line.componentSku}, ${line.componentName}, ${line.quantity}, ${line.unit ?? "pcs"}, ${line.componentType ?? "raw_material"}, ${line.scrapPercentage ?? 0}, ${line.notes ?? null}, ${now}, ${now})
    returning *
  `) as any[];

  return row ? normalizeBomLine(row) : null;
}

export async function removeBomLine(lineId: string, bomId: string): Promise<boolean> {
  const sql = SQL;
  await ensureBomTables(sql);

  const [row] = (await sql`
    delete from bom_lines where id = ${lineId} and bom_id = ${bomId} returning id
  `) as any[];

  return !!row;
}

export async function explodeBom(
  productSku: string,
  tenantSlug: string,
  quantity: number = 1,
  level: number = 0,
  path: string[] = []
): Promise<BomExplosionItem[]> {
  const sql = SQL;
  await ensureBomTables(sql);

  const bom = await getBomByProductSku(productSku, tenantSlug);
  if (!bom) return [];

  const items: BomExplosionItem[] = [];
  const currentPath = [...path, productSku];

  for (const line of bom.lines) {
    const effectiveQty = line.quantity * quantity * (1 + line.scrapPercentage / 100);

    items.push({
      componentSku: line.componentSku,
      componentName: line.componentName,
      quantity: effectiveQty,
      unit: line.unit,
      level,
      componentType: line.componentType,
      path: currentPath,
    });

    if (line.componentType === "subassembly") {
      const childItems = await explodeBom(line.componentSku, tenantSlug, effectiveQty, level + 1, currentPath);
      items.push(...childItems);
    }
  }

  return items;
}

function normalizeBomHeader(row: any): BomHeader {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    productSku: row.product_sku,
    productName: row.product_name,
    revision: row.revision,
    status: row.status,
    quantity: Number(row.quantity),
    unit: row.unit,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeBomLine(row: any): BomLine {
  return {
    id: row.id,
    bomId: row.bom_id,
    componentSku: row.component_sku,
    componentName: row.component_name,
    quantity: Number(row.quantity),
    unit: row.unit,
    componentType: row.component_type,
    scrapPercentage: Number(row.scrap_percentage),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
