export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import {
  buildMps, completeSubOperation, createPlantFloor, createSubOperation,
  downtimeSummary, endDowntime, getMps, listDowntime, listMps,
  listPlantFloors, listSubOperations, recordDowntime, recomputeBomCosts,
  replaceBomComponent, setMpsStatus,
} from "@/lib/manufacturing/edge";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "manufacturing", "read");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "read");
    const { searchParams } = new URL(request.url);
    switch (searchParams.get("view") ?? "plant-floors") {
      case "plant-floors":
        return NextResponse.json({ plantFloors: await listPlantFloors(context.tenantSlug) });
      case "downtime":
        return NextResponse.json({ entries: await listDowntime(context.tenantSlug, searchParams.get("workstationId") ?? undefined, searchParams.get("workOrderId") ?? undefined) });
      case "downtime-summary":
        return NextResponse.json({ summary: await downtimeSummary(context.tenantSlug, searchParams.get("from") ?? undefined, searchParams.get("to") ?? undefined) });
      case "sub-operations":
        return NextResponse.json({ subOperations: await listSubOperations(context.tenantSlug, searchParams.get("workOrderId") ?? undefined, searchParams.get("operationId") ?? undefined) });
      case "mps":
        return NextResponse.json({ schedules: await listMps(context.tenantSlug) });
      case "mps-detail":
        return NextResponse.json({ mps: await getMps(context.tenantSlug, String(searchParams.get("id"))) });
      default:
        return NextResponse.json({ error: "Unknown view" }, { status: 400 });
    }
  } catch (error) {
    console.error("Manufacturing edge read failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "manufacturing", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    switch (body.action) {
      case "create-plant-floor":
        return NextResponse.json({ plantFloor: await createPlantFloor({
          tenantSlug: context.tenantSlug, name: String(body.name),
          code: body.code, warehouseId: body.warehouseId,
        }) }, { status: 201 });
      case "record-downtime":
        return NextResponse.json({ entry: await recordDowntime({
          tenantSlug: context.tenantSlug, workstationId: body.workstationId,
          workOrderId: body.workOrderId, plantFloorId: body.plantFloorId,
          fromTs: String(body.fromTs), toTs: body.toTs, reason: String(body.reason),
          category: body.category, operator: body.operator,
        }) }, { status: 201 });
      case "end-downtime":
        return NextResponse.json({ entry: await endDowntime(context.tenantSlug, String(body.id)) });
      case "create-sub-operation":
        return NextResponse.json({ subOperation: await createSubOperation({
          tenantSlug: context.tenantSlug, workOrderId: String(body.workOrderId),
          operationId: String(body.operationId), name: String(body.name),
          workstationId: body.workstationId, plannedMinutes: body.plannedMinutes,
        }) }, { status: 201 });
      case "complete-sub-operation":
        return NextResponse.json({ subOperation: await completeSubOperation(context.tenantSlug, String(body.id), body.actualMinutes) });
      case "build-mps":
        return NextResponse.json({ mps: await buildMps({
          tenantSlug: context.tenantSlug, name: String(body.name),
          periodFrom: String(body.periodFrom), periodTo: String(body.periodTo),
          createdBy: context.userId,
        }) }, { status: 201 });
      case "mps-status":
        return NextResponse.json({ mps: await setMpsStatus(context.tenantSlug, String(body.id), body.status) });
      case "replace-bom-component":
        return NextResponse.json(await replaceBomComponent({
          tenantSlug: context.tenantSlug, oldSku: String(body.oldSku),
          newSku: String(body.newSku),
        }));
      case "recompute-bom-costs":
        return NextResponse.json(await recomputeBomCosts(context.tenantSlug));
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: /not found|required|Invalid/i.test(msg) ? 400 : 500 });
  }
}
