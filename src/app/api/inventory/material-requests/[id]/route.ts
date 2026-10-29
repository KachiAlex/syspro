export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import {
  convertMaterialRequest,
  getMaterialRequest,
  updateMrStatus,
} from "@/lib/inventory/material-requests";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const _scope = await requireModuleAccess(request, "inventory", "read");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "read");
    const mr = await getMaterialRequest(context.tenantSlug, params.id);
    if (!mr) return NextResponse.json({ error: "Material request not found" }, { status: 404 });
    return NextResponse.json({ request: mr });
  } catch (error) {
    console.error("Material request fetch failed:", error);
    return NextResponse.json({ error: "Failed to fetch material request" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const _scope = await requireModuleAccess(request, "inventory", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "write");
    const body = await request.json();

    switch (body.action) {
      case "submit":
      case "open":
        return NextResponse.json(await updateMrStatus(context.tenantSlug, params.id, "open"));
      case "cancel":
        return NextResponse.json(await updateMrStatus(context.tenantSlug, params.id, "cancelled"));
      case "convert":
        return NextResponse.json(await convertMaterialRequest({
          tenantSlug: context.tenantSlug,
          mrId: params.id,
          supplierId: body.supplierId ?? null,
          sourceWarehouseId: body.sourceWarehouseId ?? null,
          itemIds: body.itemIds,
          userId: context.userId,
        }));
      default:
        return NextResponse.json({ error: "action must be one of open|cancel|convert" }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const code = /not found/i.test(msg) ? 404 : 400;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
