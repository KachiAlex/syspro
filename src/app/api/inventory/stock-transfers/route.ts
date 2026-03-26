import { NextRequest, NextResponse } from "next/server";

// Mock database
const mockTransfers: Array<{
  id: string;
  tenantSlug: string;
  productId: string;
  quantity: number;
  fromLocation: string;
  toLocation: string;
  status: "pending" | "completed" | "cancelled";
  createdAt: string;
}> = [];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get("tenantSlug") || "default";
    const productId = searchParams.get("productId");

    let transfers = mockTransfers.filter((t) => t.tenantSlug === tenantSlug);

    if (productId) {
      transfers = transfers.filter((t) => t.productId === productId);
    }

    return NextResponse.json({ transfers });
  } catch (error) {
    console.error("Error fetching transfers:", error);
    return NextResponse.json(
      { error: "Failed to fetch transfers", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantSlug, productId, quantity, fromLocation, toLocation } = body;

    if (!productId || !quantity || !fromLocation || !toLocation) {
      return NextResponse.json(
        { error: "Missing required fields: productId, quantity, fromLocation, toLocation" },
        { status: 400 }
      );
    }

    const transfer = {
      id: `transfer_${Date.now()}`,
      tenantSlug: tenantSlug || "default",
      productId,
      quantity: parseInt(quantity),
      fromLocation,
      toLocation,
      status: "pending" as const,
      createdAt: new Date().toISOString(),
    };

    mockTransfers.push(transfer);

    return NextResponse.json({ transfer }, { status: 201 });
  } catch (error) {
    console.error("Error creating transfer:", error);
    return NextResponse.json(
      { error: "Failed to create transfer", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
