export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { listPurchaseOrders, createPurchaseOrder, consolidatePurchaseOrders } from "@/lib/finance/purchase-orders";

import { requireModuleAccess } from "@/lib/api-auth";
const listSchema = z.object({
  tenantSlug: z.string().min(1),
  supplierId: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
  offset: z.coerce.number().min(0).optional(),
});

export async function GET(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "finance", "read");
    if (!_scope.ok) return _scope.response;

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
    const _scope = await requireModuleAccess(request, "finance", "write");
    if (!_scope.ok) return _scope.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  try {
    if ((body as any).action === "consolidate") {
      const tenantSlug = (body as any).tenantSlug;
      const poIds = (body as any).poIds;
      if (!tenantSlug || !Array.isArray(poIds) || poIds.length < 2) {
        return NextResponse.json({ error: "tenantSlug and at least two poIds are required" }, { status: 400 });
      }
      const result = await consolidatePurchaseOrders(tenantSlug, poIds, body as any);
      if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json(result, { status: 201 });
    }
    const po = await createPurchaseOrder(body as any);
    return NextResponse.json({ purchaseOrder: po }, { status: 201 });
  } catch (err) {
    console.error("Create purchase order failed:", err);
    return NextResponse.json({ error: "Failed to create purchase order" }, { status: 500 });
  }
}
