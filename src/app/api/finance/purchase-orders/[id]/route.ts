export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { getPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder } from "@/lib/finance/purchase-orders";

import { requireRecordTenant, requireModuleAccess } from "@/lib/api-auth";
export async function GET(request: NextRequest, context: any) {
  const scope = await requireModuleAccess(request, "finance", "read");
  if (!scope.ok) return scope.response;

  const { params } = context;
  const { id } = params;
  const owned = await requireRecordTenant("purchase_orders", id, scope.user);
  if (!owned.ok) return owned.response;
  try {
    const po = await getPurchaseOrder(id, scope.user.tenantSlug ?? undefined);
    if (!po) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    return NextResponse.json({ purchaseOrder: po });
  } catch (err) {
    console.error("Get purchase order failed:", err);
    return NextResponse.json({ error: "Failed to get purchase order" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: any) {
    const _scope = await requireModuleAccess(request, "finance", "write");
    if (!_scope.ok) return _scope.response;

  const { params } = context;
  const { id } = params;
  const _owned = await requireRecordTenant("purchase_orders", id, _scope.user);
  if (!_owned.ok) return _owned.response;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  try {
    const updated = await updatePurchaseOrder(id, body as any, _scope.user.tenantSlug ?? undefined);
    if (!updated) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    return NextResponse.json({ purchaseOrder: updated });
  } catch (err) {
    console.error("Update purchase order failed:", err);
    return NextResponse.json({ error: "Failed to update purchase order" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: any) {
  const scope = await requireModuleAccess(request, "finance", "write");
  if (!scope.ok) return scope.response;

  const { params } = context;
  const { id } = params;
  const owned = await requireRecordTenant("purchase_orders", id, scope.user);
  if (!owned.ok) return owned.response;
  try {
    const ok = await deletePurchaseOrder(id, scope.user.tenantSlug ?? undefined);
    if (!ok) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete purchase order failed:", err);
    return NextResponse.json({ error: "Failed to delete purchase order" }, { status: 500 });
  }
}
