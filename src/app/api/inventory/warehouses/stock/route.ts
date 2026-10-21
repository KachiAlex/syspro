export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { stockByWarehouse } from "@/lib/inventory/warehouses";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

// GET /api/inventory/warehouses/stock?warehouseId=... — per-warehouse stock
export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "admin", "read");
  if (!_scope.ok) return _scope.response;
  const context = validateTenantContext(request, "read");
  const warehouseId = request.nextUrl.searchParams.get("warehouseId") ?? undefined;
  try {
    const balances = await stockByWarehouse(context.tenantSlug, warehouseId);
    return NextResponse.json({ balances });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
