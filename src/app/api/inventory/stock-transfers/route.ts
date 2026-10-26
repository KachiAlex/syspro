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
  await db.query(`alter table if exists inventory_stock_transfers add column if not exists from_warehouse_id text`);
  await db.query(`alter table if exists inventory_stock_transfers add column if not exists to_warehouse_id text`);
  await db.query(`alter table if exists inventory_stock_transfers add column if not exists product_sku text`);
  await db.query(`alter table if exists inventory_stock_transfers add column if not exists serial_nos jsonb`);
  await db.query(`alter table if exists inventory_stock_transfers add column if not exists lot_no text`);
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
    const { productId, quantity, fromLocation, toLocation, fromWarehouseId, toWarehouseId, serialNos, lotNo } = body;
    const tenantSlug = context.tenantSlug;

    if (!productId || !quantity || (!fromLocation && !fromWarehouseId) || (!toLocation && !toWarehouseId)) {
      return NextResponse.json(
        { error: "Missing required fields: productId, quantity, and from/to warehouse or location" },
        { status: 400 }
      );
    }
    const qty = parseInt(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      return NextResponse.json({ error: "quantity must be a positive integer" }, { status: 400 });
    }
    if (fromLocation && fromLocation === toLocation) {
      return NextResponse.json({ error: "fromLocation and toLocation must differ" }, { status: 400 });
    }
    if (fromWarehouseId && fromWarehouseId === toWarehouseId) {
      return NextResponse.json({ error: "fromWarehouseId and toWarehouseId must differ" }, { status: 400 });
    }

    const product = (await db.query(
      `select id, sku, location, current_stock from inventory_products where id = $1 and tenant_slug = $2`,
      [productId, tenantSlug]
    )).rows[0];
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Resolve warehouses when ids/codes are supplied
    let fromWh: string | null = null;
    let toWh: string | null = null;
    if (fromWarehouseId || toWarehouseId) {
      const { getWarehouse } = await import("@/lib/inventory/warehouses");
      if (fromWarehouseId) {
        const w = await getWarehouse(tenantSlug, fromWarehouseId);
        if (!w) return NextResponse.json({ error: `Source warehouse ${fromWarehouseId} not found` }, { status: 404 });
        fromWh = w.id;
      }
      if (toWarehouseId) {
        const w = await getWarehouse(tenantSlug, toWarehouseId);
        if (!w) return NextResponse.json({ error: `Destination warehouse ${toWarehouseId} not found` }, { status: 404 });
        toWh = w.id;
      }
    }

    const transfer = {
      id: `transfer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tenantSlug,
      productId,
      quantity: qty,
      fromLocation: fromLocation ?? null,
      toLocation: toLocation ?? null,
      fromWarehouseId: fromWh,
      toWarehouseId: toWh,
      serialNos: Array.isArray(serialNos) ? serialNos : null,
      lotNo: lotNo ?? null,
      status: "pending" as const,
      createdAt: new Date().toISOString(),
    };

    await db.query(
      `insert into inventory_stock_transfers (id, tenant_slug, product_id, product_sku, quantity, from_location, to_location, from_warehouse_id, to_warehouse_id, serial_nos, lot_no, status, created_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [transfer.id, transfer.tenantSlug, transfer.productId, product.sku ?? null, transfer.quantity, transfer.fromLocation, transfer.toLocation, transfer.fromWarehouseId, transfer.toWarehouseId, transfer.serialNos ? JSON.stringify(transfer.serialNos) : null, transfer.lotNo, transfer.status, transfer.createdAt]
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

    if (action === "complete") {
      // Goods only move at completion — gate it on value against
      // settings.approvals.stockTransferMinAmount or an inventory-matrix band.
      const product = (await db.query(
        `select sku, name, unit_cost from inventory_products where id = $1 and tenant_slug = $2`,
        [transfer.product_id, tenantSlug]
      )).rows[0];
      const value = Number(transfer.quantity) * Number(product?.unit_cost ?? 0);
      const { gateOrRun } = await import("@/lib/finance/gated-actions");
      const outcome = await gateOrRun(
        tenantSlug,
        "stock_transfer_completion",
        {
          transferId: id,
          productId: transfer.product_id,
          productSku: transfer.product_sku ?? product?.sku,
          quantity: Number(transfer.quantity),
          value,
          from: transfer.from_warehouse_id ?? transfer.from_location,
          to: transfer.to_warehouse_id ?? transfer.to_location,
        },
        { requestedBy: _scope.user.id ?? "unknown" }
      );
      if (outcome.status === "pending") {
        return NextResponse.json(
          { transfer, pendingApproval: true, approvalId: outcome.approvalId },
          { status: 202 }
        );
      }
      if (outcome.status === "denied") {
        return NextResponse.json({ error: outcome.error }, { status: 403 });
      }
      return NextResponse.json({ transfer: outcome.result });
    }

    const updated = (await db.query(
      `update inventory_stock_transfers set status = 'cancelled', completed_at = now() where id = $1 and tenant_slug = $2 returning *`,
      [id, tenantSlug]
    )).rows[0];

    return NextResponse.json({ transfer: updated });
  } catch (error) {
    console.error("Error updating transfer:", error);
    return NextResponse.json(
      { error: "Failed to update transfer", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
