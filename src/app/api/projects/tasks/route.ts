import { NextRequest, NextResponse } from "next/server";

import {
  createTask,
  listTasks,
  TaskEntity,
  updateTaskStatus,
} from "@/lib/projects-data";
import { suggestAssignments } from "@/lib/project-fit";

async function sendAttendanceSignal(params: { tenantSlug: string; employeeId: string; workDate: string; taskId: string }) {
  try {
    await fetch("http://localhost:3000/api/attendance", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantSlug: params.tenantSlug,
        employeeId: params.employeeId,
        workDate: params.workDate,
        signalType: "TASK_UPDATE",
        signalData: { taskId: params.taskId },
      }),
    });
  } catch (error) {
    console.error("Failed to forward attendance signal", error);
  }
}

async function sendPerformanceSignal(params: { tenantSlug: string; taskId: string; contributionWeight: number; status: TaskEntity["status"] }) {
  try {
    await fetch("http://localhost:3000/api/hr/staff-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantSlug: params.tenantSlug,
        taskId: params.taskId,
        contributionWeight: params.contributionWeight,
        status: params.status,
      }),
    });
  } catch (error) {
    console.error("Failed to forward performance signal", error);
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug") || "default";
  const projectId = searchParams.get("projectId") || undefined;
  const workstreamId = searchParams.get("workstreamId") || undefined;
  const status = (searchParams.get("status") as TaskEntity["status"]) || undefined;

  const tasks = listTasks({ tenantSlug, projectId, workstreamId, status });
  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    tenantSlug = "default",
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

  const task = createTask(tenantSlug, {
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
    tenantSlug,
    department: department!,
    requiredSkills: requiredSkills!,
  });

  if (assignedEmployees.length > 0) {
    const workDate = new Date().toISOString().split("T")[0];
    await Promise.all(
      assignedEmployees.map((employeeId) =>
        sendAttendanceSignal({ tenantSlug, employeeId, workDate, taskId: task.id })
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
  const body = await request.json();
  const {
    tenantSlug = "default",
    taskId,
    status,
    dependencyStatus,
  } = body as { tenantSlug?: string; taskId?: string; status?: TaskEntity["status"]; dependencyStatus?: TaskEntity["dependencyStatus"]; };

  if (!taskId || !status) {
    return NextResponse.json(
      { error: "taskId and status are required" },
      { status: 400 }
    );
  }

  const task = updateTaskStatus(tenantSlug, taskId, status, dependencyStatus);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  await sendPerformanceSignal({
    tenantSlug,
    taskId: task.id,
    contributionWeight: task.contributionWeight,
    status,
  });

  return NextResponse.json({ task, message: "Task updated" });
}
