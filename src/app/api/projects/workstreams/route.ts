import { NextRequest, NextResponse } from "next/server";

import { createWorkstream, listWorkstreams, WorkstreamEntity } from "@/lib/projects-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug") || "default";
  const projectId = searchParams.get("projectId") || undefined;

  const workstreams = listWorkstreams(tenantSlug, projectId);
  return NextResponse.json({ workstreams });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    tenantSlug = "default",
    projectId,
    name,
    description,
    department,
    lead,
    startDate,
    endDate,
    progress = 0,
    dependencies = [],
    automationState = "Monitoring",
    createdBy,
  } = body as Partial<WorkstreamEntity> & { dependencies?: string[] };

  const missing = [
    projectId,
    name,
    description,
    department,
    lead,
    startDate,
    endDate,
    createdBy,
  ].some((value) => value === undefined || value === null || value === "");

  if (missing) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const workstream = createWorkstream(tenantSlug, {
    projectId: projectId!,
    name: name!,
    description: description!,
    department: department!,
    lead: lead!,
    startDate: startDate!,
    endDate: endDate!,
    progress,
    dependencies,
    automationState,
    createdBy: createdBy!,
  });

  return NextResponse.json(
    { workstream, message: "Workstream created" },
    { status: 201 }
  );
}
