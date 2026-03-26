import { NextRequest, NextResponse } from "next/server";

import { listTimeEntries, logTimeEntry } from "@/lib/projects-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug") || "default";
  const projectId = searchParams.get("projectId") || undefined;

  const timeEntries = listTimeEntries(tenantSlug, projectId);
  return NextResponse.json({ timeEntries });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    tenantSlug = "default",
    projectId,
    workstreamId,
    taskId,
    employeeId,
    hours,
    date,
    billable = false,
  } = body as {
    tenantSlug?: string;
    projectId?: string;
    workstreamId?: string;
    taskId?: string;
    employeeId?: string;
    hours?: number;
    date?: string;
    billable?: boolean;
  };

  if (!projectId || !workstreamId || !taskId || !employeeId || hours === undefined || !date) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const entry = logTimeEntry(tenantSlug, {
    projectId,
    workstreamId,
    taskId,
    employeeId,
    hours: Number(hours),
    date,
    billable,
  });

  return NextResponse.json(
    { timeEntry: entry, message: "Time entry logged successfully" },
    { status: 201 }
  );
}
