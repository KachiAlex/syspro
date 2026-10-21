export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import { createRfq, listRfqs } from "@/lib/procurement/rfq";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "read");
    const rfqs = await listRfqs(context.tenantSlug);
    return NextResponse.json({ rfqs });
  } catch (error) {
    console.error("RFQ fetch failed:", error);
    return NextResponse.json({ error: "Failed to fetch RFQs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    if (!body.title || !Array.isArray(body.items) || !body.items.length || !Array.isArray(body.vendorIds) || !body.vendorIds.length) {
      return NextResponse.json({ error: "title, items[] and vendorIds[] are required" }, { status: 400 });
    }
    const rfq = await createRfq({
      tenantSlug: context.tenantSlug,
      title: String(body.title),
      requiredBy: body.requiredBy ?? null,
      items: body.items.map((i: any) => ({
        productId: i.productId ?? null,
        sku: i.sku ?? null,
        description: String(i.description ?? "Item"),
        quantity: Number(i.quantity ?? 1),
        uom: i.uom ?? null,
        targetPrice: i.targetPrice ?? null,
      })),
      vendorIds: body.vendorIds.map(String),
      createdBy: context.userId,
    });
    return NextResponse.json({ rfq }, { status: 201 });
  } catch (error) {
    console.error("RFQ create failed:", error);
    return NextResponse.json({ error: "Failed to create RFQ", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}
