export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import {
  createActivityType, createInstallationNote, createProjectUpdate,
  createTaskType, listActivityTypes, listInstallationNotes,
  listProjectUpdates, listTaskTypes, setActivityCost,
  updateInstallationStatus,
} from "@/lib/projects/edge";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "projects", "read");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "read");
    const { searchParams } = new URL(request.url);
    switch (searchParams.get("view") ?? "task-types") {
      case "task-types":
        return NextResponse.json({ taskTypes: await listTaskTypes(context.tenantSlug) });
      case "activity-types":
        return NextResponse.json({ activityTypes: await listActivityTypes(context.tenantSlug) });
      case "updates":
        return NextResponse.json({ updates: await listProjectUpdates(context.tenantSlug, String(searchParams.get("projectId"))) });
      case "installation-notes":
        return NextResponse.json({ notes: await listInstallationNotes(context.tenantSlug, searchParams.get("customerId") ?? undefined) });
      default:
        return NextResponse.json({ error: "Unknown view" }, { status: 400 });
    }
  } catch (error) {
    console.error("Projects edge read failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "projects", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    switch (body.action) {
      case "create-task-type":
        return NextResponse.json({ taskType: await createTaskType({
          tenantSlug: context.tenantSlug, name: String(body.name),
          description: body.description, color: body.color,
        }) }, { status: 201 });
      case "create-activity-type":
        return NextResponse.json({ activityType: await createActivityType({
          tenantSlug: context.tenantSlug, name: String(body.name),
          defaultRate: body.defaultRate,
        }) }, { status: 201 });
      case "set-activity-cost":
        return NextResponse.json({ cost: await setActivityCost({
          tenantSlug: context.tenantSlug, activityTypeId: String(body.activityTypeId),
          employeeId: body.employeeId, billingRate: Number(body.billingRate),
          costRate: body.costRate, currency: body.currency,
        }) });
      case "create-update":
        return NextResponse.json({ update: await createProjectUpdate({
          tenantSlug: context.tenantSlug, projectId: String(body.projectId),
          summary: String(body.summary), status: body.status,
          blockers: body.blockers, percentComplete: body.percentComplete,
          sentTo: body.sentTo, createdBy: context.userId,
        }) }, { status: 201 });
      case "create-installation-note":
        return NextResponse.json({ note: await createInstallationNote({
          tenantSlug: context.tenantSlug, customerId: body.customerId,
          customerName: String(body.customerName), invoiceId: body.invoiceId,
          salesOrderId: body.salesOrderId, installationDate: body.installationDate,
          items: body.items, remarks: body.remarks, createdBy: context.userId,
        }) }, { status: 201 });
      case "installation-status":
        return NextResponse.json({ note: await updateInstallationStatus(context.tenantSlug, String(body.id), body.status) });
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: /not found|required|Invalid/i.test(msg) ? 400 : 500 });
  }
}
