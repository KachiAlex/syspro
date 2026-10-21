export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import {
  convertToSalesOrder,
  getQuotation,
  updateQuotationStatus,
} from "@/lib/sales/quotations";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const _scope = await requireModuleAccess(request, "sales", "read");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "read");
    const quotation = await getQuotation(context.tenantSlug, params.id);
    if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    return NextResponse.json({ quotation });
  } catch (error) {
    console.error("Quotation fetch failed:", error);
    return NextResponse.json({ error: "Failed to fetch quotation" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const _scope = await requireModuleAccess(request, "sales", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    const status = String(body.status ?? "");
    if (!["sent", "accepted", "rejected", "expired", "lost"].includes(status)) {
      return NextResponse.json({ error: "status must be one of sent|accepted|rejected|expired|lost" }, { status: 400 });
    }
    const quotation = await updateQuotationStatus(
      context.tenantSlug, params.id, status as any, body.lostReason ?? null
    );
    return NextResponse.json({ quotation });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const code = /not found/i.test(msg) ? 404 : 400;
    return NextResponse.json({ error: msg }, { status: code });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const _scope = await requireModuleAccess(request, "sales", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "write");
    const body = await request.json().catch(() => ({}));
    if (body.action === "convert") {
      const result = await convertToSalesOrder(context.tenantSlug, params.id, context.userId);
      return NextResponse.json(result, { status: result.alreadyConverted ? 200 : 201 });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const code = /not found/i.test(msg) ? 404 : 400;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
