import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { db } from "@/lib/sql-client";

async function ensureInventoryTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS inventory_products (
      id text primary key,
      tenant_slug text not null,
      name text not null,
      sku text not null unique,
      category text not null,
      current_stock integer not null default 0,
      min_stock integer not null default 0,
      unit_cost numeric default 0,
      sale_price numeric default 0,
      supplier text,
      description text,
      location text,
      created_at timestamptz default now()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_inventory_products_tenant ON inventory_products (tenant_slug)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_inventory_products_category ON inventory_products (tenant_slug, category)`);
  await db.query(`ALTER TABLE inventory_products ADD COLUMN IF NOT EXISTS location text`);
}

function mapProductToItem(p: any) {
  const quantity = Number(p.current_stock ?? 0);
  const reorder = Number(p.min_stock ?? 0);
  const status = quantity === 0 ? "Out of Stock" : quantity <= reorder ? "Low Stock" : "In Stock";
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    quantity,
    reorderLevel: reorder,
    unitPrice: Number(p.sale_price ?? 0),
    location: p.location ?? "",
    status,
    category: p.category,
    supplier: p.supplier ?? "",
    description: p.description ?? "",
  };
}

export async function GET(request: NextRequest) {
  try {
    await ensureInventoryTable();
    const context = validateTenantContext(request, "read");
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    let rows = (await db.query(
      `SELECT * FROM inventory_products WHERE tenant_slug = $1 ORDER BY created_at DESC`,
      [context.tenantSlug]
    )).rows;
    if (category) rows = rows.filter((p: any) => p.category === category);

    const items = rows.map(mapProductToItem);
    const totalValue = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    return NextResponse.json({ items, totalValue });
  } catch (error) {
    console.error("Inventory fetch failed:", error);
    return NextResponse.json({ error: "Failed to fetch inventory", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureInventoryTable();
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    const {
      name,
      productName,
      sku,
      category,
      quantity,
      currentStock,
      unitPrice,
      salePrice,
      reorderLevel,
      minStock,
      location,
      supplier,
      description,
    } = body;

    const finalName = name ?? productName;
    const finalQuantity = Number(quantity ?? currentStock ?? 0);
    const finalUnitPrice = Number(unitPrice ?? salePrice ?? 0);
    const finalReorder = Number(reorderLevel ?? minStock ?? 0);

    if (!finalName || !sku || !category) {
      return NextResponse.json({ error: "Missing required fields: name, sku, category" }, { status: 400 });
    }

    const id = `prod_${Date.now()}`;
    const createdAt = new Date().toISOString();

    await db.query(
      `INSERT INTO inventory_products (id, tenant_slug, name, sku, category, current_stock, min_stock, unit_cost, sale_price, supplier, description, location, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [id, context.tenantSlug, finalName, sku, category, finalQuantity, finalReorder, finalUnitPrice, finalUnitPrice, supplier ?? "", description ?? "", location ?? "", createdAt]
    );

    const product = { id, tenant_slug: context.tenantSlug, name: finalName, sku, category, current_stock: finalQuantity, min_stock: finalReorder, sale_price: finalUnitPrice, supplier: supplier ?? "", description: description ?? "", location: location ?? "", created_at: createdAt };
    return NextResponse.json({ item: mapProductToItem(product), message: "Item added" }, { status: 201 });
  } catch (error) {
    console.error("Inventory create failed:", error);
    return NextResponse.json({ error: "Failed to create inventory item", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureInventoryTable();
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const fields = [
      { key: "name", col: "name", val: body.name ?? body.productName },
      { key: "sku", col: "sku", val: body.sku },
      { key: "category", col: "category", val: body.category },
      { key: "current_stock", col: "current_stock", val: body.quantity ?? body.currentStock },
      { key: "min_stock", col: "min_stock", val: body.reorderLevel ?? body.minStock },
      { key: "sale_price", col: "sale_price", val: body.unitPrice ?? body.salePrice },
      { key: "unit_cost", col: "unit_cost", val: body.unitCost ?? body.unitPrice ?? body.salePrice },
      { key: "location", col: "location", val: body.location },
      { key: "supplier", col: "supplier", val: body.supplier },
      { key: "description", col: "description", val: body.description },
    ];

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;
    for (const f of fields) {
      if (f.val !== undefined) {
        updates.push(`${f.col} = $${idx++}`);
        values.push(f.val);
      }
    }
    if (updates.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    values.push(id);
    values.push(context.tenantSlug);

    const result = await db.query(
      `UPDATE inventory_products SET ${updates.join(", ")} WHERE id = $${idx++} AND tenant_slug = $${idx++} RETURNING *`,
      values
    );
    const product = result.rows[0];
    if (!product) return NextResponse.json({ error: "Item not found" }, { status: 404 });
    return NextResponse.json({ item: mapProductToItem(product) });
  } catch (error) {
    console.error("Inventory update failed:", error);
    return NextResponse.json({ error: "Failed to update inventory item", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}
