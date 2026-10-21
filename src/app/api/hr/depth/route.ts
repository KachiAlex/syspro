export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import {
  completeLifecycleTask,
  createAdvance,
  createLifecycle,
  disburseAdvance,
  listAdvances,
  listCheckins,
  listLeaveAllocations,
  listLifecycles,
  recordCheckin,
  recordRepayment,
  runLeaveAccrual,
  updateAdvanceStatus,
  upsertLeaveAllocation,
} from "@/lib/hr/depth";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "people", "read");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "read");
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") ?? "checkins";

    switch (view) {
      case "checkins":
        return NextResponse.json({ checkins: await listCheckins(context.tenantSlug, searchParams.get("employeeId") ?? undefined, searchParams.get("from") ?? undefined, searchParams.get("to") ?? undefined) });
      case "allocations":
        return NextResponse.json({ allocations: await listLeaveAllocations(context.tenantSlug, searchParams.get("year") ? Number(searchParams.get("year")) : undefined, searchParams.get("employeeId") ?? undefined) });
      case "advances":
        return NextResponse.json({ advances: await listAdvances(context.tenantSlug, searchParams.get("employeeId") ?? undefined, searchParams.get("status") ?? undefined) });
      case "lifecycle":
        return NextResponse.json({ lifecycles: await listLifecycles(context.tenantSlug, searchParams.get("kind") ?? undefined, searchParams.get("status") ?? undefined) });
      default:
        return NextResponse.json({ error: "view must be checkins|allocations|advances|lifecycle" }, { status: 400 });
    }
  } catch (error) {
    console.error("HR depth read failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "people", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "write");
    const body = await request.json();

    switch (body.action) {
      case "checkin":
        return NextResponse.json({ checkin: await recordCheckin({
          tenantSlug: context.tenantSlug, employeeId: String(body.employeeId),
          logType: body.logType, timestamp: body.timestamp, source: body.source,
          deviceId: body.deviceId, shiftId: body.shiftId,
        }) }, { status: 201 });
      case "upsert-allocation":
        return NextResponse.json({ allocation: await upsertLeaveAllocation({
          tenantSlug: context.tenantSlug, employeeId: String(body.employeeId),
          leaveType: String(body.leaveType), year: Number(body.year),
          allocatedDays: Number(body.allocatedDays), carriedOverDays: body.carriedOverDays,
          expiresAt: body.expiresAt, notes: body.notes, createdBy: context.userId,
        }) });
      case "run-accrual":
        return NextResponse.json(await runLeaveAccrual(context.tenantSlug, body.period));
      case "create-advance":
        return NextResponse.json({ advance: await createAdvance({
          tenantSlug: context.tenantSlug, employeeId: String(body.employeeId),
          employeeName: body.employeeName, amount: Number(body.amount),
          purpose: body.purpose, createdBy: context.userId,
        }) }, { status: 201 });
      case "advance-status":
        return NextResponse.json({ advance: await updateAdvanceStatus(context.tenantSlug, String(body.advanceId), body.status, context.userId) });
      case "disburse-advance":
        return NextResponse.json(await disburseAdvance(context.tenantSlug, String(body.advanceId), context.userId));
      case "repay-advance":
        return NextResponse.json(await recordRepayment({
          tenantSlug: context.tenantSlug, advanceId: String(body.advanceId),
          amount: Number(body.amount), method: body.method, notes: body.notes, userId: context.userId,
        }));
      case "create-lifecycle":
        return NextResponse.json({ lifecycle: await createLifecycle({
          tenantSlug: context.tenantSlug, kind: body.kind,
          employeeId: String(body.employeeId), employeeName: body.employeeName,
          designation: body.designation, departmentId: body.departmentId,
          startDate: body.startDate, separationDate: body.separationDate,
          reason: body.reason, checklist: body.checklist, createdBy: context.userId,
        }) }, { status: 201 });
      case "complete-task":
        return NextResponse.json(await completeLifecycleTask(context.tenantSlug, String(body.lifecycleId), Number(body.taskIndex), Boolean(body.done)));
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const code = /not found|exceeds|Invalid|is \w+ state/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
