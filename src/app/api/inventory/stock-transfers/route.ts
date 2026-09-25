import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { db } from "@/lib/sql-client";
import { getPagination } from "@/lib/pagination";

import { requireModuleAccess } from "@/lib/api-auth";
export async function GET(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "admin", "read");
    if (!_scope.ok) return _scope.response;

  try {
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

    const transfer = {
      id: `transfer_${Date.now()}`,
      tenantSlug,
      productId,
      quantity: parseInt(quantity),
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
