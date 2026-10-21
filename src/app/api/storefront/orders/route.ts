export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { cancelOrder, confirmOrder, listOrders } from "@/lib/storefront/orders";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

/** ADMIN — manage incoming storefront orders. */
export async function GET(request: NextRequest) {
  const gate = await requireModuleAccess(request, "sales", "read");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "read");
  const { searchParams } = new URL(request.url);
  const orders = await listOrders(context.tenantSlug, {
    status: searchParams.get("status") ?? undefined,
    limit: Number(searchParams.get("limit") ?? 100) || 100,
  });
  return NextResponse.json({ orders });
}

const actionSchema = z.object({
  action: z.enum(["confirm", "cancel"]),
  orderId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const gate = await requireModuleAccess(request, "sales", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.action === "cancel") {
    const result = await cancelOrder(context.tenantSlug, parsed.data.orderId);
    if (result.error) return NextResponse.json(result, { status: 422 });
    return NextResponse.json({ ok: true });
  }
  try {
    const result = await confirmOrder(context.tenantSlug, parsed.data.orderId, context.userId);
    if (result.error) return NextResponse.json(result, { status: 422 });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
