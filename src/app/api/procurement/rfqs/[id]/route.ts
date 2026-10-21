export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import {
  awardQuotation,
  compareQuotations,
  getRfq,
  recordSupplierQuotation,
  sendRfq,
} from "@/lib/procurement/rfq";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "read");
    const view = new URL(request.url).searchParams.get("view");
    if (view === "compare") {
      return NextResponse.json(await compareQuotations(context.tenantSlug, params.id));
    }
    const rfq = await getRfq(context.tenantSlug, params.id);
    if (!rfq) return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
    return NextResponse.json({ rfq });
  } catch (error) {
    console.error("RFQ fetch failed:", error);
    return NextResponse.json({ error: "Failed to fetch RFQ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const _scope = await requireModuleAccess(request, "finance", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "write");
    const body = await request.json();

    switch (body.action) {
      case "send":
        return NextResponse.json(await sendRfq(context.tenantSlug, params.id));
      case "award":
        if (!body.quotationId) {
          return NextResponse.json({ error: "quotationId is required" }, { status: 400 });
        }
        return NextResponse.json(await awardQuotation({
          tenantSlug: context.tenantSlug,
          rfqId: params.id,
          quotationId: String(body.quotationId),
          userId: context.userId,
        }));
      case "submit-quote": {
        if (!body.vendorId || !body.vendorName || !Array.isArray(body.items) || !body.items.length) {
          return NextResponse.json({ error: "vendorId, vendorName and items[] are required" }, { status: 400 });
        }
        const quote = await recordSupplierQuotation({
          tenantSlug: context.tenantSlug,
          rfqId: params.id,
          vendorId: String(body.vendorId),
          vendorName: String(body.vendorName),
          currency: body.currency,
          validUntil: body.validUntil ?? null,
          notes: body.notes ?? null,
          items: body.items.map((i: any) => ({
            rfqItemId: i.rfqItemId ?? null,
            productId: i.productId ?? null,
            description: String(i.description ?? "Item"),
            quantity: Number(i.quantity ?? 1),
            uom: i.uom ?? null,
            unitPrice: Number(i.unitPrice ?? 0),
          })),
        });
        return NextResponse.json({ quotation: quote }, { status: 201 });
      }
      default:
        return NextResponse.json({ error: "action must be one of send|submit-quote|award" }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const code = /not found/i.test(msg) ? 404 : 400;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
