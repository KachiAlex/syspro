import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import {
  getTimeLogsForProject,
  logTime,
  createTaskAssignment,
} from "@/lib/projects/db";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || undefined;

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const timeEntries = await getTimeLogsForProject(projectId, context.tenantSlug);
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
  } = body as any;

  if (!projectId || !workstreamId || !taskId || !employeeId || hours === undefined || !date) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Ensure a task assignment exists for this task/employee to satisfy the time_logs FK.
  const assignment = await createTaskAssignment(
    context.tenantSlug,
    {
      taskId,
      projectId,
      employeeId,
      assignedHours: undefined,
      assignedPercentage: undefined,
      assignmentStartDate: new Date(),
      status: "PROPOSED",
    },
    context.userId
  );
  if (!assignment) {
    return NextResponse.json({ error: "Failed to create assignment" }, { status: 500 });
  }
  const taskAssignmentId = assignment.id;

  const entry = await logTime(
    context.tenantSlug,
    {
      taskAssignmentId,
      taskId,
      projectId,
      logDate: new Date(date),
      hoursLogged: Number(hours),
      billable,
      description: undefined,
      activityType: undefined,
    },
    context.userId
  );

  if (!entry) {
    return NextResponse.json({ error: "Failed to log time" }, { status: 500 });
  }

  return NextResponse.json(
    { timeEntry: entry, message: "Time entry logged successfully" },
    { status: 201 }
  );
}
