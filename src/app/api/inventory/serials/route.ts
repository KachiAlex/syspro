export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { listSerials, traceSerial } from "@/lib/inventory/lot-tracking";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "inventory", "read");
  if (!_scope.ok) return _scope.response;

  try {
    const context = validateTenantContext(request, "read");
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get("sku") ?? undefined;
    const serialNo = searchParams.get("serialNo") ?? undefined;

    if (sku && serialNo) {
      const trace = await traceSerial(context.tenantSlug, sku, serialNo);
      if (!trace.serial) {
        return NextResponse.json({ error: "Serial number not found" }, { status: 404 });
      }
      return NextResponse.json({ serial: trace.serial, movements: trace.movements });
    }

    const serials = await listSerials(context.tenantSlug, {
      sku,
      status: searchParams.get("status") ?? undefined,
      warehouseId: searchParams.get("warehouseId") ?? undefined,
      limit: parseInt(searchParams.get("limit") ?? "200"),
    });
    return NextResponse.json({ serials });
  } catch (error) {
    console.error("Error fetching serials:", error);
    return NextResponse.json(
      { error: "Failed to fetch serials", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
