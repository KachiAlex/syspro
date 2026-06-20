import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

import {
  createTask,
  listTasks,
  TaskEntity,
  updateTaskStatus,
} from "@/lib/projects-data";
import { suggestAssignments } from "@/lib/project-fit";
import { updateAttendanceSignals } from "@/lib/attendance";

async function sendAttendanceSignal(params: { tenantSlug: string; employeeId: string; workDate: string; taskId: string }) {
  try {
    await updateAttendanceSignals({
      tenantId: params.tenantSlug,
      employeeId: params.employeeId,
      workDate: params.workDate,
      signalType: "TASK_UPDATE",
      signalData: { taskId: params.taskId, count: 1 },
    });
  } catch (error) {
    console.error("Failed to forward attendance signal", error);
  }
}

async function sendPerformanceSignal(_params: { tenantSlug: string; taskId: string; contributionWeight: number; status: TaskEntity["status"] }) {
  // TODO: connect to a real performance-tracking module.
  // The previous localhost fetch payload did not match the staff-reports API schema.
}

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || undefined;
  const workstreamId = searchParams.get("workstreamId") || undefined;
  const status = (searchParams.get("status") as TaskEntity["status"]) || undefined;

  const tasks = listTasks({ tenantSlug: context.tenantSlug, projectId, workstreamId, status });
  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  const {
    projectId,
    workstreamId,
    department,
    title,
    description,
    requiredSkills,
    estimatedHours,
    priority,
    dueDate,
    assignedEmployees = [],
    contributionWeight,
    createdBy,
  } = body as Partial<TaskEntity> & { requiredSkills?: string[]; assignedEmployees?: string[] };

  const missing = [
    projectId,
    workstreamId,
    department,
    title,
    description,
    requiredSkills && requiredSkills.length > 0 ? requiredSkills.join() : undefined,
    estimatedHours,
    priority,
    dueDate,
    contributionWeight,
    createdBy,
  ].some((value) => value === undefined || value === null || value === "");

  if (missing) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const task = createTask(context.tenantSlug, {
    projectId: projectId!,
    workstreamId: workstreamId!,
    department: department!,
    title: title!,
    description: description!,
    requiredSkills: requiredSkills!,
    estimatedHours: Number(estimatedHours),
    priority: priority!,
    dependencyStatus: "unblocked",
    dueDate: dueDate!,
    assignedEmployees,
    contributionWeight: Number(contributionWeight),
    status: "Todo",
    createdBy: createdBy!,
  });

  const suggestions = suggestAssignments({
    tenantSlug: context.tenantSlug,
    department: department!,
    requiredSkills: requiredSkills!,
  });

  if (assignedEmployees.length > 0) {
    const workDate = new Date().toISOString().split("T")[0];
    await Promise.all(
      assignedEmployees.map((employeeId) =>
        sendAttendanceSignal({ tenantSlug: context.tenantSlug, employeeId, workDate, taskId: task.id })
      )
    );
  }

  return NextResponse.json(
    {
      task,
      suggestions,
      message: "Task created successfully",
    },
    { status: 201 }
  );
}

export async function PUT(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  const {
    taskId,
    status,
    dependencyStatus,
  } = body as { taskId?: string; status?: TaskEntity["status"]; dependencyStatus?: TaskEntity["dependencyStatus"]; };

  if (!taskId || !status) {
    return NextResponse.json(
      { error: "taskId and status are required" },
      { status: 400 }
    );
  }

  const task = updateTaskStatus(context.tenantSlug, taskId, status, dependencyStatus);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  await sendPerformanceSignal({
    tenantSlug: context.tenantSlug,
    taskId: task.id,
    contributionWeight: task.contributionWeight,
    status,
  });

  return NextResponse.json({ task, message: "Task updated" });
}
