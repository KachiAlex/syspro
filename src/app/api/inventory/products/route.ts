import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { db } from "@/lib/sql-client";

async function ensureInventoryTables() {
  await db.query(`
    create table if not exists inventory_products (
      id text primary key,
      tenant_slug text not null,
      name text not null,
      sku text not null unique,
      category text not null,
      current_stock integer not null default 0,
      min_stock integer not null default 0,
      unit_cost numeric not null default 0,
      sale_price numeric default 0,
      supplier text,
      description text,
      location text,
      created_at timestamptz default now()
    )
  `);
  await db.query(`create index if not exists idx_inventory_products_tenant on inventory_products (tenant_slug)`);
  await db.query(`create index if not exists idx_inventory_products_category on inventory_products (tenant_slug, category)`);
  await db.query(`ALTER TABLE inventory_products ADD COLUMN IF NOT EXISTS location text`);
}

export async function GET(request: NextRequest) {
  try {
    await ensureInventoryTables();
    const context = validateTenantContext(request, "read");
    const { searchParams } = new URL(request.url);
    const tenantSlug = context.tenantSlug;
    const category = searchParams.get("category");

    const rows = (await db.query(
      `select * from inventory_products where tenant_slug = $1`,
      [tenantSlug]
    )).rows;
    let products = rows || [];

    if (category) {
      products = products.filter((p: any) => p.category === category);
    }

    return NextResponse.json({ products });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureInventoryTables();
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    const { name, sku, category, currentStock, minStock, unitCost, salePrice, supplier, description, location } = body;
    const tenantSlug = context.tenantSlug;

    if (!name || !sku || !category) {
      return NextResponse.json(
        { error: "Missing required fields: name, sku, category" },
        { status: 400 }
      );
    }

    const product = {
      id: `prod_${Date.now()}`,
      tenantSlug,
      name,
      sku,
      category,
      currentStock: currentStock || 0,
      minStock: minStock || 0,
      unitCost: unitCost || 0,
      salePrice: salePrice || 0,
      supplier: supplier || "",
      description: description || "",
      location: location || "",
      createdAt: new Date().toISOString(),
    };

    await db.query(
      `insert into inventory_products (id, tenant_slug, name, sku, category, current_stock, min_stock, unit_cost, sale_price, supplier, description, location, created_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [product.id, product.tenantSlug, product.name, product.sku, product.category, product.currentStock, product.minStock, product.unitCost, product.salePrice, product.supplier, product.description, product.location, product.createdAt]
    );

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json(
      { error: "Failed to create product", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureInventoryTables();
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    const { id, name, sku, category, currentStock, minStock, unitCost, salePrice, supplier, description, location } = body;
    const tenantSlug = context.tenantSlug;

    if (!id) {
      return NextResponse.json({ error: "Product id is required" }, { status: 400 });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name); }
    if (sku !== undefined) { updates.push(`sku = $${idx++}`); values.push(sku); }
    if (category !== undefined) { updates.push(`category = $${idx++}`); values.push(category); }
    if (currentStock !== undefined) { updates.push(`current_stock = $${idx++}`); values.push(currentStock); }
    if (minStock !== undefined) { updates.push(`min_stock = $${idx++}`); values.push(minStock); }
    if (unitCost !== undefined) { updates.push(`unit_cost = $${idx++}`); values.push(unitCost); }
    if (salePrice !== undefined) { updates.push(`sale_price = $${idx++}`); values.push(salePrice); }
    if (supplier !== undefined) { updates.push(`supplier = $${idx++}`); values.push(supplier); }
    if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description); }
    if (location !== undefined) { updates.push(`location = $${idx++}`); values.push(location); }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(id, tenantSlug);
    const query = `update inventory_products set ${updates.join(", ")} where id = $${idx++} and tenant_slug = $${idx++} returning *`;
    const result = await db.query(query, values);

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ product: result.rows[0] });
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json(
      { error: "Failed to update product", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureInventoryTables();
    const context = validateTenantContext(request, "write");
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const tenantSlug = context.tenantSlug;

    if (!id) {
      return NextResponse.json({ error: "Product id is required" }, { status: 400 });
    }

    const result = await db.query(
      `delete from inventory_products where id = $1 and tenant_slug = $2`,
      [id, tenantSlug]
    );

    if (result.count === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting product:", error);
    return NextResponse.json(
      { error: "Failed to delete product", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
