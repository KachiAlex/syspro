export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { db } from "@/lib/sql-client";

import { requireModuleAccess } from "@/lib/api-auth";
const MAX_ROWS = 500;

async function ensureInventoryTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS inventory_products (
      id text primary key,
      tenant_slug text not null,
      name text not null,
      sku text not null,
      category text not null,
      current_stock integer not null default 0,
      min_stock integer not null default 0,
      unit_cost numeric default 0,
      sale_price numeric default 0,
      supplier text,
      description text,
      location text,
      created_at timestamptz default now(),
      unique (tenant_slug, sku)
    )
  `);
}

export async function POST(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "admin", "write");
    if (!_scope.ok) return _scope.response;

  try {
    await ensureInventoryTable();
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    const items = body?.items;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items array is required" }, { status: 400 });
    }
    if (items.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Too many rows. Maximum ${MAX_ROWS} items per import.` },
        { status: 400 }
      );
    }

    let imported = 0;
    let updated = 0;
    const errors: { row: number; sku: string; error: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      const row = items[i] || {};
      const rowNum = i + 1;
      const name = String(row.name ?? "").trim();
      const sku = String(row.sku ?? "").trim();
      const category = String(row.category ?? "").trim();

      if (!name || !sku || !category) {
        errors.push({ row: rowNum, sku, error: "Missing required fields: name, sku, category" });
        continue;
      }

      const quantity = Math.max(0, Math.trunc(Number(row.quantity) || 0));
      const reorderLevel = Math.max(0, Math.trunc(Number(row.reorderLevel) || 0));
      const unitPrice = Math.max(0, Number(row.unitPrice) || 0);
      const salePrice = Math.max(0, Number(row.salePrice ?? row.unitPrice) || 0);
      const location = String(row.location ?? "").trim();
      const supplier = String(row.supplier ?? "").trim();
      const description = String(row.description ?? "").trim();

      try {
        const existing = await db.query(
          `SELECT id FROM inventory_products WHERE sku = $1 AND tenant_slug = $2`,
          [sku, context.tenantSlug]
        );
        const found = existing.rows[0];

        if (found) {
          await db.query(
            `UPDATE inventory_products SET name=$1, category=$2, current_stock=$3, min_stock=$4, unit_cost=$5, sale_price=$6, supplier=$7, description=$8, location=$9 WHERE id=$10 AND tenant_slug=$11`,
            [name, category, quantity, reorderLevel, unitPrice, salePrice, supplier, description, location, found.id, context.tenantSlug]
          );
          updated++;
        } else {
          const id = `prod_${Date.now()}_${i}`;
          await db.query(
            `INSERT INTO inventory_products (id, tenant_slug, name, sku, category, current_stock, min_stock, unit_cost, sale_price, supplier, description, location, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [id, context.tenantSlug, name, sku, category, quantity, reorderLevel, unitPrice, salePrice, supplier, description, location, new Date().toISOString()]
          );
          imported++;
        }
      } catch (err) {
        errors.push({ row: rowNum, sku, error: String((err as any)?.message ?? err) });
      }
    }

    return NextResponse.json({
      imported,
      updated,
      failed: errors.length,
      errors: errors.slice(0, 50),
      message: `Imported ${imported}, updated ${updated}, failed ${errors.length}`,
    });
  } catch (error) {
    console.error("Inventory bulk import failed:", error);
    return NextResponse.json(
      { error: "Bulk import failed", details: String((error as any)?.message ?? error) },
      { status: 500 }
    );
  }
}
