import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { listPurchaseOrders, createPurchaseOrder } from "@/lib/finance/purchase-orders";

const listSchema = z.object({
  tenantSlug: z.string().min(1),
  supplierId: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
  offset: z.coerce.number().min(0).optional(),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    tenantSlug: url.searchParams.get("tenantSlug") ?? undefined,
    supplierId: url.searchParams.get("supplierId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const orders = await listPurchaseOrders(parsed.data);
    return NextResponse.json({ orders });
  } catch (err) {
    console.error("List purchase orders failed:", err);
    return NextResponse.json({ error: "Failed to list purchase orders" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  try {
    const po = await createPurchaseOrder(body as any);
    return NextResponse.json({ purchaseOrder: po }, { status: 201 });
  } catch (err) {
    console.error("Create purchase order failed:", err);
    return NextResponse.json({ error: "Failed to create purchase order" }, { status: 500 });
  }
}
