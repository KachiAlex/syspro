import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { db } from "@/lib/sql-client";
import { writeFinanceEvent } from "@/lib/finance/events";

export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");
    const { searchParams } = new URL(request.url);
    const tenantSlug = context.tenantSlug;
    const vendorId = searchParams.get("vendorId");
    const status = searchParams.get("status");

    const rows = (await db.query(
      `select * from procurement_purchase_orders where tenant_slug = $1`,
      [tenantSlug]
    )).rows;
    let orders = rows || [];

    if (vendorId) {
      orders = orders.filter((o: any) => o.vendor_id === vendorId);
    }

    if (status) {
      orders = orders.filter((o: any) => o.status === status);
    }

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Error fetching purchase orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase orders", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    const { vendorId, items, quantity, amount, deliveryDate } = body;
    const tenantSlug = context.tenantSlug;

    if (!vendorId || !items || !quantity || !amount || !deliveryDate) {
      return NextResponse.json(
        { error: "Missing required fields: vendorId, items, quantity, amount, deliveryDate" },
        { status: 400 }
      );
    }

    const poNumber = `PO-${Date.now().toString().slice(-6)}`;

    const purchaseOrder = {
      id: `po_${Date.now()}`,
      tenantSlug,
      poNumber,
      vendorId,
      items,
      quantity: parseInt(quantity),
      amount: parseFloat(amount),
      deliveryDate,
      status: "sent" as const,
      createdAt: new Date().toISOString(),
    };

    await db.query(
      `insert into procurement_purchase_orders (id, tenant_slug, po_number, vendor_id, items, quantity, amount, delivery_date, status, created_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [purchaseOrder.id, purchaseOrder.tenantSlug, purchaseOrder.poNumber, purchaseOrder.vendorId, purchaseOrder.items, purchaseOrder.quantity, purchaseOrder.amount, purchaseOrder.deliveryDate, purchaseOrder.status, purchaseOrder.createdAt]
    );

    // Publish finance event for procurement
    writeFinanceEvent({
      tenantSlug: purchaseOrder.tenantSlug,
      eventType: "po_approved",
      sourceModule: "procurement",
      sourceRecordId: purchaseOrder.id,
      userId: context.userId,
      amount: purchaseOrder.amount,
      currency: "NGN",
      metadata: { poNumber: purchaseOrder.poNumber, vendorId: purchaseOrder.vendorId, items: purchaseOrder.items },
    });

    return NextResponse.json({ purchaseOrder }, { status: 201 });
  } catch (error) {
    console.error("Error creating purchase order:", error);
    return NextResponse.json(
      { error: "Failed to create purchase order", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
