export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { getPagination } from "@/lib/pagination";
import { writeFinanceEvent } from "@/lib/finance/events";
import {
  listPurchaseOrders,
  createPurchaseOrder,
  type PurchaseOrder,
} from "@/lib/finance/purchase-orders";

import { requireModuleAccess } from "@/lib/api-auth";

// Map the canonical finance-layer PO into the shape the procurement
// workspace renders (camelCase, poNumber/vendorId/deliveryDate).
function toProcurementShape(po: PurchaseOrder) {
  const quantity = po.items.reduce((sum, it) => sum + Number(it.quantity ?? 0), 0);
  return {
    id: po.id,
    poNumber: po.orderNumber,
    vendorId: po.supplierId ?? null,
    items: po.items,
    quantity,
    amount: po.totalAmount,
    deliveryDate: po.dueDate,
    status: po.status,
    createdAt: po.createdAt,
  };
}

function parseItems(raw: any): Array<{ description: string; quantity: number; unitPrice: number; sku?: string }> {
  const arr = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? (() => { try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; } })()
      : [];
  return arr
    .map((it: any) => ({
      description: String(it.description ?? it.name ?? it.componentName ?? it.sku ?? "Item"),
      quantity: Number(it.quantity ?? it.qty ?? 0),
      unitPrice: Number(it.unitPrice ?? it.unit_price ?? it.unitCost ?? it.unit_cost ?? it.price ?? 0),
      sku: it.sku ? String(it.sku) : undefined,
    }))
    .filter((it) => it.quantity > 0);
}

export async function GET(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "finance", "read");
    if (!_scope.ok) return _scope.response;

  try {
    const context = validateTenantContext(request, "read");
    const { searchParams } = new URL(request.url);
    const tenantSlug = context.tenantSlug;
    const vendorId = searchParams.get("vendorId");
    const status = searchParams.get("status");
    const { limit, offset } = getPagination(request);

    const orders = await listPurchaseOrders({
      tenantSlug,
      supplierId: vendorId || undefined,
      status: status || undefined,
      limit,
      offset,
    });

    return NextResponse.json({ orders: orders.map(toProcurementShape), limit, offset });
  } catch (error) {
    console.error("Error fetching purchase orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase orders", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "finance", "write");
    if (!_scope.ok) return _scope.response;

  try {
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    const { vendorId, quantity, amount, deliveryDate } = body;
    const tenantSlug = context.tenantSlug;

    if (!vendorId || !quantity || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: vendorId, quantity, amount" },
        { status: 400 }
      );
    }

    let items = parseItems(body.items);
    // Fall back to a single aggregate line when the caller didn't supply
    // per-line detail (the procurement form's JSON field is optional).
    if (items.length === 0) {
      const qty = Number(quantity);
      const amt = Number(amount);
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(amt) || amt <= 0) {
        return NextResponse.json(
          { error: "quantity and amount must be positive numbers" },
          { status: 400 }
        );
      }
      items = [{ description: "Purchase order items", quantity: qty, unitPrice: amt / qty }];
    }

    const poNumber = `PO-${Date.now().toString().slice(-6)}`;
    const today = new Date().toISOString().split("T")[0];

    const po = await createPurchaseOrder({
      tenantSlug,
      supplierId: vendorId,
      orderNumber: poNumber,
      issuedDate: today,
      dueDate: deliveryDate || today,
      currency: body.currency || "NGN",
      items,
    });

    // Publish finance event for procurement
    writeFinanceEvent({
      tenantSlug,
      eventType: "po_approved",
      sourceModule: "procurement",
      sourceRecordId: po.id,
      userId: context.userId,
      amount: po.totalAmount,
      currency: body.currency || "NGN",
      metadata: { poNumber, vendorId, items: body.items },
    });

    return NextResponse.json({ purchaseOrder: toProcurementShape(po) }, { status: 201 });
  } catch (error) {
    console.error("Error creating purchase order:", error);
    return NextResponse.json(
      { error: "Failed to create purchase order", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
