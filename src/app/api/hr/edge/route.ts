export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import {
  approveEncashment, approvedOvertimeForPeriod, completeTransfer,
  createEncashment, createGrievance, createOvertime, createStaffingPlan,
  createTrainingEvent, createTrainingProgram, createTransfer, findBySkill,
  listEncashments, listGrievances, listOvertime, listSkillMaps,
  listStaffingPlans, listTaxDeclarations, listTrainingEvents,
  listTrainingPrograms, listTransfers, resolveGrievance,
  setEncashmentStatus, setOvertimeStatus, setStaffingPlanStatus,
  setTaxDeclarationStatus, updateTrainingEvent, upsertSkill,
  upsertTaxDeclaration,
} from "@/lib/hr/edge";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "people", "read");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "read");
    const { searchParams } = new URL(request.url);
    const emp = searchParams.get("employeeId") ?? undefined;
    switch (searchParams.get("view") ?? "overtime") {
      case "encashments":
        return NextResponse.json({ encashments: await listEncashments(context.tenantSlug, emp) });
      case "overtime":
        return NextResponse.json({ overtime: await listOvertime(context.tenantSlug, emp, searchParams.get("status") ?? undefined) });
      case "overtime-summary":
        return NextResponse.json({ summary: await approvedOvertimeForPeriod(context.tenantSlug, String(searchParams.get("from")), String(searchParams.get("to"))) });
      case "grievances":
        return NextResponse.json({ grievances: await listGrievances(context.tenantSlug, searchParams.get("status") ?? undefined) });
      case "transfers":
        return NextResponse.json({ transfers: await listTransfers(context.tenantSlug, emp) });
      case "skills":
        return NextResponse.json({ skills: await listSkillMaps(context.tenantSlug, emp) });
      case "skill-search":
        return NextResponse.json({ employees: await findBySkill(context.tenantSlug, String(searchParams.get("skill")), Number(searchParams.get("min") ?? 1)) });
      case "training":
        return NextResponse.json({
          programs: await listTrainingPrograms(context.tenantSlug),
          events: await listTrainingEvents(context.tenantSlug, searchParams.get("status") ?? undefined),
        });
      case "staffing":
        return NextResponse.json({ plans: await listStaffingPlans(context.tenantSlug) });
      case "tax-declarations":
        return NextResponse.json({ declarations: await listTaxDeclarations(context.tenantSlug, emp, searchParams.get("year") ? Number(searchParams.get("year")) : undefined) });
      default:
        return NextResponse.json({ error: "Unknown view" }, { status: 400 });
    }
  } catch (error) {
    console.error("HR edge read failed:", error);
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
      case "create-encashment":
        return NextResponse.json({ encashment: await createEncashment({
          tenantSlug: context.tenantSlug, employeeId: String(body.employeeId),
          leaveType: String(body.leaveType), encashableDays: Number(body.encashableDays),
          ratePerDay: Number(body.ratePerDay), createdBy: context.userId,
        }) }, { status: 201 });
      case "approve-encashment":
        return NextResponse.json({ encashment: await approveEncashment(context.tenantSlug, String(body.id), context.userId) });
      case "encashment-status":
        return NextResponse.json({ encashment: await setEncashmentStatus(context.tenantSlug, String(body.id), body.status, body.payrollRunId) });
      case "create-overtime":
        return NextResponse.json({ overtime: await createOvertime({
          tenantSlug: context.tenantSlug, employeeId: String(body.employeeId),
          workDate: String(body.workDate), hours: Number(body.hours),
          rateMultiplier: body.rateMultiplier, reason: body.reason,
        }) }, { status: 201 });
      case "overtime-status":
        return NextResponse.json({ overtime: await setOvertimeStatus(context.tenantSlug, String(body.id), body.status, context.userId) });
      case "create-grievance":
        return NextResponse.json({ grievance: await createGrievance({
          tenantSlug: context.tenantSlug, employeeId: String(body.employeeId),
          grievanceType: String(body.grievanceType), subject: String(body.subject),
          description: body.description, assignedTo: body.assignedTo,
        }) }, { status: 201 });
      case "resolve-grievance":
        return NextResponse.json({ grievance: await resolveGrievance({
          tenantSlug: context.tenantSlug, id: String(body.id),
          status: body.status, resolution: body.resolution,
        }) });
      case "create-transfer":
        return NextResponse.json({ transfer: await createTransfer({
          tenantSlug: context.tenantSlug, employeeId: String(body.employeeId),
          transferDate: String(body.transferDate), fromDepartmentId: body.fromDepartmentId,
          toDepartmentId: body.toDepartmentId, fromBranchId: body.fromBranchId,
          toBranchId: body.toBranchId, reason: body.reason, createdBy: context.userId,
        }) }, { status: 201 });
      case "complete-transfer":
        return NextResponse.json({ transfer: await completeTransfer(context.tenantSlug, String(body.id)) });
      case "upsert-skill":
        return NextResponse.json({ skill: await upsertSkill({
          tenantSlug: context.tenantSlug, employeeId: String(body.employeeId),
          skill: String(body.skill), proficiency: Number(body.proficiency),
          evaluator: context.userId,
        }) });
      case "create-program":
        return NextResponse.json({ program: await createTrainingProgram({
          tenantSlug: context.tenantSlug, name: String(body.name),
          description: body.description, supplier: body.supplier,
        }) }, { status: 201 });
      case "create-event":
        return NextResponse.json({ event: await createTrainingEvent({
          tenantSlug: context.tenantSlug, programId: body.programId,
          eventName: String(body.eventName), startDate: String(body.startDate),
          endDate: body.endDate, venue: body.venue, trainer: body.trainer,
          attendees: body.attendees,
        }) }, { status: 201 });
      case "update-event":
        return NextResponse.json({ event: await updateTrainingEvent({
          tenantSlug: context.tenantSlug, id: String(body.id),
          status: body.status, attendees: body.attendees,
        }) });
      case "create-staffing-plan":
        return NextResponse.json({ plan: await createStaffingPlan({
          tenantSlug: context.tenantSlug, name: String(body.name),
          departmentId: body.departmentId, periodFrom: body.periodFrom,
          periodTo: body.periodTo, designations: body.designations ?? [],
          createdBy: context.userId,
        }) }, { status: 201 });
      case "staffing-status":
        return NextResponse.json({ plan: await setStaffingPlanStatus(context.tenantSlug, String(body.id), body.status) });
      case "upsert-tax-declaration":
        return NextResponse.json({ declaration: await upsertTaxDeclaration({
          tenantSlug: context.tenantSlug, employeeId: String(body.employeeId),
          taxYear: Number(body.taxYear), reliefs: body.reliefs ?? {},
          proofDocument: body.proofDocument,
        }) });
      case "tax-declaration-status":
        return NextResponse.json({ declaration: await setTaxDeclarationStatus(context.tenantSlug, String(body.id), body.status) });
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: /not found|required|Invalid|must|hours/i.test(msg) ? 400 : 500 });
  }
}
