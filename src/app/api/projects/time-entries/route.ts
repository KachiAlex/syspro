export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext, handleTenantAdminError } from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";
import { sql as SQL } from "@/lib/sql-client";
import {
  getTimeLogsForProject,
  logTime,
  createTaskAssignment,
} from "@/lib/projects/db";

export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");
    const _gate1 = await requireModuleGate(request, "projects", "read");
    if (_gate1) return _gate1;
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId") || undefined;

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const timeEntries = await getTimeLogsForProject(projectId, context.tenantSlug);
    return NextResponse.json({ timeEntries });
  } catch (error) {
    return handleTenantAdminError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const _gate2 = await requireModuleGate(request, "projects", "write");
    if (_gate2) return _gate2;
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
  if (typeof hours !== "number" || hours <= 0 || hours > 24) {
    return NextResponse.json({ error: "hours must be a number between 0 and 24" }, { status: 400 });
  }
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const [field, value] of [["projectId", projectId], ["taskId", taskId], ["employeeId", employeeId]]) {
    if (!UUID_RE.test(String(value))) {
      return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
    }
  }

  // Task must belong to this tenant, the given project, and the given
  // workstream — otherwise the assignment/time-log writes could touch
  // another tenant's records or log time against the wrong structure.
  const taskRows = (await SQL`
    select id from tasks
    where id = ${taskId} and tenant_slug = ${context.tenantSlug}
      and project_id = ${projectId} and workstream_id = ${workstreamId}
    limit 1
  `) as any[];
  if (!taskRows[0]) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Employee must exist in this tenant; non-privileged callers may only log
  // their own time.
  const empRows = (await SQL`
    select id from admin_employees
    where id = ${employeeId} and tenant_slug = ${context.tenantSlug}
    limit 1
  `) as any[];
  if (!empRows[0]) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
  const role = (context.userRole || "").toLowerCase();
  const canLogForOthers = ["admin", "tenant_admin", "superadmin", "hr", "hr_admin", "hr_manager", "hod", "head_of_department", "manager", "executive"].includes(role);
  if (!canLogForOthers && String(employeeId) !== String(context.userId)) {
    return NextResponse.json({ error: "You can only log your own time" }, { status: 403 });
  }

  // Reuse an existing assignment for this task/employee; create only if none.
  const existing = (await SQL`
    select id from task_assignments
    where task_id = ${taskId} and employee_id = ${employeeId} and tenant_slug = ${context.tenantSlug}
    limit 1
  `) as any[];
  let taskAssignmentId = existing[0]?.id as string | undefined;
  if (!taskAssignmentId) {
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
    taskAssignmentId = assignment.id;
  }

  const entry = await logTime(
    context.tenantSlug,
    {
      taskAssignmentId,
      taskId,
      projectId,
      employeeId,
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
  } catch (error) {
    return handleTenantAdminError(error);
  }
}
