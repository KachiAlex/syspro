export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import {
  createPackingSlip, listPackingSlips, listPartyItemCodes,
  listPutawayRules, resolvePartyCode, setPackingSlipStatus,
  suggestPutaway, upsertPartyItemCode, upsertPutawayRule,
} from "@/lib/inventory/edge";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "admin", "read");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "read");
    const { searchParams } = new URL(request.url);
    switch (searchParams.get("view") ?? "packing-slips") {
      case "packing-slips":
        return NextResponse.json({ slips: await listPackingSlips(context.tenantSlug, searchParams.get("salesOrderId") ?? undefined) });
      case "putaway-rules":
        return NextResponse.json({ rules: await listPutawayRules(context.tenantSlug, searchParams.get("sku") ?? undefined) });
      case "putaway-suggest":
        return NextResponse.json({ suggestions: await suggestPutaway(context.tenantSlug, String(searchParams.get("sku")), Number(searchParams.get("qty") ?? 1)) });
      case "party-codes":
        return NextResponse.json({ codes: await listPartyItemCodes(context.tenantSlug, searchParams.get("sku") ?? undefined, searchParams.get("partyType") ?? undefined) });
      case "resolve-code":
        return NextResponse.json({ resolved: await resolvePartyCode(context.tenantSlug, String(searchParams.get("code")), searchParams.get("partyType") ?? undefined) });
      default:
        return NextResponse.json({ error: "Unknown view" }, { status: 400 });
    }
  } catch (error) {
    console.error("Inventory edge read failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "admin", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    switch (body.action) {
      case "create-slip":
        return NextResponse.json({ slip: await createPackingSlip({
          tenantSlug: context.tenantSlug, salesOrderId: body.salesOrderId,
          deliveryReference: body.deliveryReference, fromCaseNo: body.fromCaseNo,
          toCaseNo: body.toCaseNo, items: body.items, grossWeight: body.grossWeight,
          netWeight: body.netWeight, createdBy: context.userId,
        }) }, { status: 201 });
      case "slip-status":
        return NextResponse.json({ slip: await setPackingSlipStatus(context.tenantSlug, String(body.id), body.status) });
      case "upsert-rule":
        return NextResponse.json({ rule: await upsertPutawayRule({
          tenantSlug: context.tenantSlug, id: body.id,
          productSku: String(body.productSku), warehouseId: String(body.warehouseId),
          bin: body.bin, capacity: body.capacity, priority: body.priority,
          isActive: body.isActive,
        }) });
      case "upsert-party-code":
        return NextResponse.json({ code: await upsertPartyItemCode({
          tenantSlug: context.tenantSlug, productSku: String(body.productSku),
          partyType: body.partyType, partyCode: String(body.partyCode),
          partyId: body.partyId, partyName: body.partyName,
        }) });
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: /not found|required|Invalid/i.test(msg) ? 400 : 500 });
  }
}
