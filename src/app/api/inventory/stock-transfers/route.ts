export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { db } from "@/lib/sql-client";
import { getPagination } from "@/lib/pagination";

import { requireModuleAccess } from "@/lib/api-auth";

async function ensureTransferTable() {
  await db.query(`
    create table if not exists inventory_stock_transfers (
      id text primary key,
      tenant_slug text not null,
      product_id text not null,
      quantity integer not null,
      from_location text not null,
      to_location text not null,
      status text not null default 'pending' check (status in ('pending','completed','cancelled')),
      created_at timestamptz default now(),
      completed_at timestamptz
    )
  `);
  await db.query(`create index if not exists idx_stock_transfers_tenant on inventory_stock_transfers (tenant_slug)`);
}

export async function GET(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "admin", "read");
    if (!_scope.ok) return _scope.response;

  try {
    await ensureTransferTable();
    const context = validateTenantContext(request, "read");
    const { searchParams } = new URL(request.url);
    const tenantSlug = context.tenantSlug;
    const productId = searchParams.get("productId");
    const { limit, offset } = getPagination(request);

    const params: any[] = [tenantSlug];
    let where = `where tenant_slug = $1`;
    if (productId) {
      params.push(productId);
      where += ` and product_id = $${params.length}`;
    }

    const transfers = (await db.query(
      `select * from inventory_stock_transfers ${where} order by created_at desc limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, limit, offset]
    )).rows;

    return NextResponse.json({ transfers, limit, offset });
  } catch (error) {
    console.error("Error fetching transfers:", error);
    return NextResponse.json(
      { error: "Failed to fetch transfers", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "admin", "write");
    if (!_scope.ok) return _scope.response;

  try {
    await ensureTransferTable();
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    const { productId, quantity, fromLocation, toLocation } = body;
    const tenantSlug = context.tenantSlug;

    if (!productId || !quantity || !fromLocation || !toLocation) {
      return NextResponse.json(
        { error: "Missing required fields: productId, quantity, fromLocation, toLocation" },
        { status: 400 }
      );
    }
    const qty = parseInt(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      return NextResponse.json({ error: "quantity must be a positive integer" }, { status: 400 });
    }
    if (fromLocation === toLocation) {
      return NextResponse.json({ error: "fromLocation and toLocation must differ" }, { status: 400 });
    }

    const product = (await db.query(
      `select id, location, current_stock from inventory_products where id = $1 and tenant_slug = $2`,
      [productId, tenantSlug]
    )).rows[0];
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const transfer = {
      id: `transfer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tenantSlug,
      productId,
      quantity: qty,
      fromLocation,
      toLocation,
      status: "pending" as const,
      createdAt: new Date().toISOString(),
    };

    await db.query(
      `insert into inventory_stock_transfers (id, tenant_slug, product_id, quantity, from_location, to_location, status, created_at) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [transfer.id, transfer.tenantSlug, transfer.productId, transfer.quantity, transfer.fromLocation, transfer.toLocation, transfer.status, transfer.createdAt]
    );

    return NextResponse.json({ transfer }, { status: 201 });
  } catch (error) {
    console.error("Error creating transfer:", error);
    return NextResponse.json(
      { error: "Failed to create transfer", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "admin", "write");
    if (!_scope.ok) return _scope.response;

  try {
    await ensureTransferTable();
    const context = validateTenantContext(request, "write");
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const action = searchParams.get("action");
    const tenantSlug = context.tenantSlug;

    if (!id || (action !== "complete" && action !== "cancel")) {
      return NextResponse.json({ error: "id and action=complete|cancel are required" }, { status: 400 });
    }

    const transfer = (await db.query(
      `select * from inventory_stock_transfers where id = $1 and tenant_slug = $2`,
      [id, tenantSlug]
    )).rows[0];
    if (!transfer) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }
    if (transfer.status !== "pending") {
      return NextResponse.json({ error: `Transfer is already ${transfer.status}` }, { status: 409 });
    }

    const next = action === "complete" ? "completed" : "cancelled";
    const updated = (await db.query(
      `update inventory_stock_transfers set status = $1, completed_at = now() where id = $2 and tenant_slug = $3 returning *`,
      [next, id, tenantSlug]
    )).rows[0];

    // Products track a single location: completing a transfer whose
    // from_location matches the product's location moves the product.
    if (next === "completed") {
      await db.query(
        `update inventory_products set location = $1 where id = $2 and tenant_slug = $3 and location = $4`,
        [transfer.to_location, transfer.product_id, tenantSlug, transfer.from_location]
      );
    }

    return NextResponse.json({ transfer: updated });
  } catch (error) {
    console.error("Error updating transfer:", error);
    return NextResponse.json(
      { error: "Failed to update transfer", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
