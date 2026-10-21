export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { lotStock, expiringLots } from "@/lib/inventory/lot-tracking";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "admin", "read");
  if (!_scope.ok) return _scope.response;

  try {
    const context = validateTenantContext(request, "read");
    const { searchParams } = new URL(request.url);

    const expiringWithin = searchParams.get("expiringWithin");
    if (expiringWithin) {
      const lots = await expiringLots(context.tenantSlug, parseInt(expiringWithin));
      return NextResponse.json({ lots });
    }

    const lots = await lotStock(context.tenantSlug, {
      sku: searchParams.get("sku") ?? undefined,
      warehouseId: searchParams.get("warehouseId") ?? undefined,
    });
    return NextResponse.json({ lots });
  } catch (error) {
    console.error("Error fetching lot stock:", error);
    return NextResponse.json(
      { error: "Failed to fetch lot stock", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
