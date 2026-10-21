export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getOrderStatus, placeOrder } from "@/lib/storefront/orders";

type Params = { params: Promise<{ tenant: string }> };

const orderSchema = z.object({
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  items: z.array(z.object({
    sku: z.string().min(1),
    quantity: z.coerce.number().int().positive(),
  })).min(1).max(100),
  notes: z.string().max(2000).optional(),
});

/** PUBLIC — place an order; pricing is resolved server-side. */
export async function POST(request: NextRequest, { params }: Params) {
  const { tenant } = await params;
  const body = await request.json();
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await placeOrder(tenant, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    const message = err.message ?? String(err);
    const status = /Unknown product|Insufficient stock|Invalid quantity|requires/.test(message) ? 422 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/** PUBLIC — order status lookup requires the order number + customer email. */
export async function GET(request: NextRequest, { params }: Params) {
  const { tenant } = await params;
  const { searchParams } = new URL(request.url);
  const orderNumber = searchParams.get("orderNumber");
  const email = searchParams.get("email");
  if (!orderNumber) {
    return NextResponse.json({ error: "orderNumber is required" }, { status: 400 });
  }
  const order = await getOrderStatus(tenant, orderNumber, email ?? undefined);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  return NextResponse.json({ order }, { headers: { "Cache-Control": "private, no-store" } });
}
