import { NextRequest, NextResponse } from "next/server";

// Mock database
const mockPurchaseOrders: Array<{
  id: string;
  tenantSlug: string;
  poNumber: string;
  vendorId: string;
  items: string;
  quantity: number;
  amount: number;
  deliveryDate: string;
  status: "draft" | "sent" | "acknowledged" | "received" | "invoiced" | "paid";
  createdAt: string;
}> = [];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get("tenantSlug") || "default";
    const vendorId = searchParams.get("vendorId");
    const status = searchParams.get("status");

    let orders = mockPurchaseOrders.filter((o) => o.tenantSlug === tenantSlug);

    if (vendorId) {
      orders = orders.filter((o) => o.vendorId === vendorId);
    }

    if (status) {
      orders = orders.filter((o) => o.status === status);
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
    const body = await request.json();
    const { tenantSlug, vendorId, items, quantity, amount, deliveryDate } = body;

    if (!vendorId || !items || !quantity || !amount || !deliveryDate) {
      return NextResponse.json(
        { error: "Missing required fields: vendorId, items, quantity, amount, deliveryDate" },
        { status: 400 }
      );
    }

    const poNumber = `PO-${Date.now().toString().slice(-6)}`;

    const purchaseOrder = {
      id: `po_${Date.now()}`,
      tenantSlug: tenantSlug || "default",
      poNumber,
      vendorId,
      items,
      quantity: parseInt(quantity),
      amount: parseFloat(amount),
      deliveryDate,
      status: "sent" as const,
      createdAt: new Date().toISOString(),
    };

    mockPurchaseOrders.push(purchaseOrder);

    return NextResponse.json({ purchaseOrder }, { status: 201 });
  } catch (error) {
    console.error("Error creating purchase order:", error);
    return NextResponse.json(
      { error: "Failed to create purchase order", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
