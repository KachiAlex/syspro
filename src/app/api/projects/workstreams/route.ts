import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import {
  createWorkstream,
  getWorkstreamsForProject,
  getAllWorkstreamsForTenant,
  Workstream,
} from "@/lib/projects/db";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || undefined;

  const rawWorkstreams = projectId
    ? await getWorkstreamsForProject(projectId, context.tenantSlug)
    : await getAllWorkstreamsForTenant(context.tenantSlug);

  const workstreams = rawWorkstreams.map((ws: Workstream) => ({
    id: ws.id,
    projectId: ws.projectId,
    name: ws.name,
    description: ws.description ?? "",
    department: ws.ownerDepartmentId ?? "",
    lead: ws.workstreamLeadId ?? "",
    progress: 100 - (Number(ws.priority ?? 100)),
    startDate: ws.plannedStartDate ? new Date(ws.plannedStartDate).toISOString() : "",
    endDate: ws.plannedEndDate ? new Date(ws.plannedEndDate).toISOString() : "",
    dependencies: [],
    automationState: ws.status === "ACTIVE" ? "Monitoring" : ws.status === "ON_HOLD" ? "Escalating" : "Stable",
    status: ws.status,
    priority: ws.priority,
  }));

  return NextResponse.json({ workstreams });
}

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  const {
    projectId,
    name,
    description,
    department,
    lead,
    startDate,
    endDate,
    allocatedBudget,
    progress = 0,
    dependencies = [],
    automationState = "Monitoring",
  } = body as any;

  const missing = [projectId, name, description, department, lead, startDate, endDate].some(
    (value) => value === undefined || value === null || value === ""
  );

  if (missing) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const workstream = await createWorkstream(context.tenantSlug, {
    projectId,
    code: `WS-${Date.now()}`,
    name,
    description,
    plannedStartDate: startDate ? new Date(startDate) : null,
    plannedEndDate: endDate ? new Date(endDate) : null,
    allocatedBudget: allocatedBudget ? Number(allocatedBudget) : null,
    status: automationState === "Monitoring" ? "ACTIVE" : (automationState as Workstream["status"]),
    priority: 100 - Math.min(100, Math.max(0, Number(progress) || 0)),
    workstreamLeadId: lead,
    ownerDepartmentId: department,
  } as any, context.userId);

  if (!workstream) {
    return NextResponse.json({ error: "Failed to create workstream" }, { status: 500 });
  }

  return NextResponse.json(
    { workstream, message: "Workstream created" },
    { status: 201 }
  );
}
