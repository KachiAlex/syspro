import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import {
  createTask,
  getTasksForProject,
  getTasksForWorkstream,
  getAllTasksForTenant,
  updateTask,
} from "@/lib/projects/db";
import { suggestAssignments } from "@/lib/project-fit";
import { updateAttendanceSignals } from "@/lib/attendance";

type FrontendStatus = "todo" | "in-progress" | "done";

const statusToDb: Record<string, string> = {
  todo: "NOT_STARTED",
  "in-progress": "IN_PROGRESS",
  done: "COMPLETED",
};

const priorityToDb: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

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

async function sendPerformanceSignal(_params: { tenantSlug: string; taskId: string; contributionWeight: number; status: FrontendStatus }) {
  // TODO: connect to a real performance-tracking module.
}

const statusToPlanner: Record<string, string> = {
  NOT_STARTED: "Todo",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Review",
  COMPLETED: "Done",
  CANCELLED: "Done",
};

const priorityToPlanner = (n: number) => {
  if (n <= 1) return "Low";
  if (n >= 3) return "High";
  return "Medium";
};

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || undefined;
  const workstreamId = searchParams.get("workstreamId") || undefined;

  let rawTasks = [] as any[];
  if (workstreamId) {
    rawTasks = await getTasksForWorkstream(workstreamId, context.tenantSlug);
  } else if (projectId) {
    rawTasks = await getTasksForProject(projectId, context.tenantSlug);
  } else {
    rawTasks = await getAllTasksForTenant(context.tenantSlug);
  }

  const tasks = rawTasks.map((t: any) => ({
    id: t.id,
    projectId: t.project_id,
    workstreamId: t.workstream_id,
    department: "",
    title: t.title,
    status: statusToPlanner[t.status] ?? t.status,
    requiredSkills: t.required_skills || [],
    dueDate: t.planned_end_date ? new Date(t.planned_end_date).toISOString() : "",
    estimatedHours: Number(t.estimated_hours ?? 0),
    effortHours: Number(t.estimated_hours ?? 0),
    assignedTo: "Unassigned",
    assignedEmployees: [],
    assignedEmployeeIds: [],
    contributionWeight: 0,
    priority: priorityToPlanner(Number(t.priority ?? 2)),
  }));

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
  } = body as any;

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
  ].some((value) => value === undefined || value === null || value === "");

  if (missing) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const task = await createTask(context.tenantSlug, {
    projectId,
    workstreamId,
    code: `TASK-${Date.now()}`,
    title: title!,
    description: description!,
    requiredSkills,
    estimatedHours: Number(estimatedHours),
    priority: priorityToDb[priority as string] ?? 2,
    plannedEndDate: new Date(dueDate),
    status: "NOT_STARTED",
  } as any, context.userId);

  if (!task) {
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }

  const suggestions = suggestAssignments({
    tenantSlug: context.tenantSlug,
    department: department!,
    requiredSkills: requiredSkills!,
  });

  if (assignedEmployees.length > 0) {
    const workDate = new Date().toISOString().split("T")[0];
    await Promise.all(
      assignedEmployees.map((employeeId: string) =>
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
  const { taskId, status } = body as { taskId?: string; status?: FrontendStatus };

  if (!taskId || !status) {
    return NextResponse.json(
      { error: "taskId and status are required" },
      { status: 400 }
    );
  }

  const dbStatus = statusToDb[status] || status.toUpperCase().replace(/-/g, "_");
  const task = await updateTask(taskId, context.tenantSlug, { status: dbStatus as any });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  await sendPerformanceSignal({
    tenantSlug: context.tenantSlug,
    taskId: task.id,
    contributionWeight: 1,
    status,
  });

  return NextResponse.json({ task, message: "Task updated" });
}
