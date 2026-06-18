import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

import { listTimeEntries, logTimeEntry } from "@/lib/projects-data";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || undefined;

  const timeEntries = listTimeEntries(context.tenantSlug, projectId);
  return NextResponse.json({ timeEntries });
}

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  const {
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

  const entry = logTimeEntry(context.tenantSlug, {
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
