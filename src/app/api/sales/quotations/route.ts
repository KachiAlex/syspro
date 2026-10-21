export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import {
  createQuotation,
  expireStaleQuotations,
  listQuotations,
} from "@/lib/sales/quotations";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "sales", "read");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "read");
    const status = new URL(request.url).searchParams.get("status") ?? undefined;
    const quotations = await listQuotations(context.tenantSlug, status);
    return NextResponse.json({ quotations });
  } catch (error) {
    console.error("Quotations fetch failed:", error);
    return NextResponse.json({ error: "Failed to fetch quotations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "sales", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    if (body.action === "expire-stale") {
      return NextResponse.json(await expireStaleQuotations(context.tenantSlug));
    }
    if (!body.customerName || !Array.isArray(body.items) || !body.items.length) {
      return NextResponse.json({ error: "customerName and items[] are required" }, { status: 400 });
    }
    const quotation = await createQuotation({
      tenantSlug: context.tenantSlug,
      customerId: body.customerId ?? null,
      customerName: String(body.customerName),
      quotationDate: body.quotationDate,
      validUntil: body.validUntil ?? null,
      currency: body.currency,
      notes: body.notes ?? null,
      items: body.items.map((i: any) => ({
        productId: i.productId ?? null,
        sku: i.sku ?? null,
        description: String(i.description ?? "Item"),
        quantity: Number(i.quantity ?? 1),
        uom: i.uom ?? null,
        unitPrice: Number(i.unitPrice ?? 0),
        taxRate: i.taxRate ?? null,
      })),
      createdBy: context.userId,
    });
    return NextResponse.json({ quotation }, { status: 201 });
  } catch (error) {
    console.error("Quotation create failed:", error);
    return NextResponse.json({ error: "Failed to create quotation", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}
