export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import {
  completeJobCard,
  createJobCardsForWorkOrder,
  createProductionPlan,
  executeProductionPlan,
  getJobCard,
  getProductionPlan,
  listForecasts,
  listJobCards,
  listProductionPlans,
  listRoutings,
  listWorkstations,
  logJobCardTime,
  upsertForecast,
  upsertRouting,
  upsertWorkstation,
} from "@/lib/manufacturing/planning";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "manufacturing", "read");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "read");
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") ?? "workstations";

    switch (view) {
      case "workstations":
        return NextResponse.json({ workstations: await listWorkstations(context.tenantSlug) });
      case "routings":
        return NextResponse.json({ routings: await listRoutings(context.tenantSlug) });
      case "job-cards":
        return NextResponse.json({ jobCards: await listJobCards(context.tenantSlug, searchParams.get("workOrderId") ?? undefined) });
      case "job-card": {
        const card = await getJobCard(context.tenantSlug, String(searchParams.get("id")));
        return card ? NextResponse.json({ jobCard: card }) : NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      case "forecasts":
        return NextResponse.json({ forecasts: await listForecasts(context.tenantSlug, searchParams.get("from") ?? undefined, searchParams.get("to") ?? undefined) });
      case "production-plans":
        return NextResponse.json({ plans: await listProductionPlans(context.tenantSlug) });
      case "production-plan": {
        const plan = await getProductionPlan(context.tenantSlug, String(searchParams.get("id")));
        return plan ? NextResponse.json({ plan }) : NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      default:
        return NextResponse.json({ error: "view must be workstations|routings|job-cards|job-card|forecasts|production-plans|production-plan" }, { status: 400 });
    }
  } catch (error) {
    console.error("Manufacturing planning read failed:", error);
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
      case "upsert-workstation":
        return NextResponse.json({ workstation: await upsertWorkstation({
          tenantSlug: context.tenantSlug, name: String(body.name), code: String(body.code),
          workstationType: body.workstationType, laborRate: Number(body.laborRate ?? 0),
          overheadRate: Number(body.overheadRate ?? 0), capacityHoursPerDay: Number(body.capacityHoursPerDay ?? 8),
          workingHours: body.workingHours, enabled: body.enabled,
        }) });
      case "upsert-routing":
        return NextResponse.json({ routing: await upsertRouting({
          tenantSlug: context.tenantSlug, name: String(body.name), description: body.description ?? null,
          operations: (body.operations ?? []).map((o: any) => ({
            name: String(o.name), workstationId: o.workstationId ?? null, standardMinutes: Number(o.standardMinutes ?? 0),
          })),
        }) });
      case "create-job-cards":
        return NextResponse.json({ jobCards: await createJobCardsForWorkOrder(context.tenantSlug, String(body.workOrderId)) });
      case "log-time":
        return NextResponse.json({ jobCard: await logJobCardTime({
          tenantSlug: context.tenantSlug, jobCardId: String(body.jobCardId),
          employeeId: body.employeeId ?? null, startedAt: String(body.startedAt ?? new Date().toISOString()),
          endedAt: body.endedAt ?? null, minutes: body.minutes != null ? Number(body.minutes) : undefined,
          completedQuantity: Number(body.completedQuantity ?? 0), notes: body.notes ?? null,
        }) });
      case "complete-job-card":
        return NextResponse.json({ jobCard: await completeJobCard(context.tenantSlug, String(body.jobCardId)) });
      case "upsert-forecast":
        return NextResponse.json({ forecast: await upsertForecast({
          tenantSlug: context.tenantSlug, productSku: String(body.productSku),
          forecastDate: String(body.forecastDate), quantity: Number(body.quantity), notes: body.notes ?? null,
        }) });
      case "create-production-plan":
        return NextResponse.json({ plan: await createProductionPlan({
          tenantSlug: context.tenantSlug, planName: String(body.planName),
          periodStart: body.periodStart, periodEnd: body.periodEnd,
          includeSalesOrders: body.includeSalesOrders, includeForecasts: body.includeForecasts,
          createdBy: context.userId,
        }) }, { status: 201 });
      case "execute-production-plan":
        return NextResponse.json(await executeProductionPlan(context.tenantSlug, String(body.planId), context.userId));
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const code = /not found|already|cannot/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
