import { NextRequest, NextResponse } from "next/server";

import { getPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder } from "@/lib/finance/purchase-orders";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const po = await getPurchaseOrder(id);
    if (!po) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    return NextResponse.json({ purchaseOrder: po });
  } catch (err) {
    console.error("Get purchase order failed:", err);
    return NextResponse.json({ error: "Failed to get purchase order" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  try {
    const updated = await updatePurchaseOrder(id, body as any);
    if (!updated) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    return NextResponse.json({ purchaseOrder: updated });
  } catch (err) {
    console.error("Update purchase order failed:", err);
    return NextResponse.json({ error: "Failed to update purchase order" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const ok = await deletePurchaseOrder(id);
    if (!ok) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete purchase order failed:", err);
    return NextResponse.json({ error: "Failed to delete purchase order" }, { status: 500 });
  }
}
