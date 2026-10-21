export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import {
  availableQuantity,
  completeInspection,
  createInspection,
  createReconciliation,
  getReconciliation,
  listInspections,
  listReconciliations,
  listReservations,
  releaseReservation,
  reserveStock,
  setCountedQuantity,
  submitReconciliation,
} from "@/lib/inventory/stock-control";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "admin", "read");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "read");
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") ?? "reconciliations";

    switch (view) {
      case "reconciliations":
        return NextResponse.json({ reconciliations: await listReconciliations(context.tenantSlug) });
      case "reconciliation": {
        const rec = await getReconciliation(context.tenantSlug, String(searchParams.get("id")));
        return rec ? NextResponse.json({ reconciliation: rec }) : NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      case "reservations":
        return NextResponse.json({ reservations: await listReservations(context.tenantSlug, searchParams.get("status") ?? undefined) });
      case "available":
        return NextResponse.json(await availableQuantity(
          context.tenantSlug, String(searchParams.get("sku")), searchParams.get("warehouseId") ?? "main"));
      case "inspections":
        return NextResponse.json({ inspections: await listInspections(context.tenantSlug, searchParams.get("status") ?? undefined) });
      default:
        return NextResponse.json({ error: "view must be reconciliations|reconciliation|reservations|available|inspections" }, { status: 400 });
    }
  } catch (error) {
    console.error("Stock control read failed:", error);
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
      case "create-reconciliation":
        return NextResponse.json({ reconciliation: await createReconciliation({
          tenantSlug: context.tenantSlug,
          warehouseId: String(body.warehouseId ?? "main"),
          countDate: body.countDate,
          remarks: body.remarks,
        }) }, { status: 201 });
      case "set-count":
        await setCountedQuantity(context.tenantSlug, String(body.reconciliationId), String(body.itemId), Number(body.countedQuantity));
        return NextResponse.json({ ok: true });
      case "submit-reconciliation":
        return NextResponse.json(await submitReconciliation(context.tenantSlug, String(body.reconciliationId), context.userId));
      case "reserve":
        return NextResponse.json({ reservation: await reserveStock({
          tenantSlug: context.tenantSlug,
          productSku: String(body.productSku),
          warehouseId: body.warehouseId,
          quantity: Number(body.quantity),
          salesOrderId: body.salesOrderId ?? null,
          reservedBy: context.userId,
          notes: body.notes ?? null,
        }) }, { status: 201 });
      case "release-reservation":
        return NextResponse.json(await releaseReservation(context.tenantSlug, String(body.id), Boolean(body.consume)));
      case "create-inspection":
        return NextResponse.json({ inspection: await createInspection({
          tenantSlug: context.tenantSlug,
          referenceType: body.referenceType,
          referenceId: body.referenceId ?? null,
          productSku: String(body.productSku),
          warehouseId: body.warehouseId ?? null,
          inspectedQuantity: Number(body.inspectedQuantity),
          inspector: body.inspector ?? context.userId,
          readings: body.readings ?? null,
          remarks: body.remarks ?? null,
        }) }, { status: 201 });
      case "complete-inspection":
        return NextResponse.json({ inspection: await completeInspection({
          tenantSlug: context.tenantSlug,
          inspectionId: String(body.inspectionId),
          acceptedQuantity: Number(body.acceptedQuantity),
          rejectedQuantity: Number(body.rejectedQuantity),
          remarks: body.remarks ?? null,
        }) });
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const code = /not found|already|Cannot reserve|exceeds/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
