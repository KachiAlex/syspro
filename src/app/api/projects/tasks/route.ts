import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import {
  createTask,
  getTasksForProject,
  getTasksForWorkstream,
  getAllTasksForTenant,
  updateTask,
  createTaskAssignment,
  getAssignmentsForTasks,
  getHODsForEmployees,
} from "@/lib/projects/db";
import { insertNotification } from "@/lib/hr/db";
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

  const assignmentRows = await getAssignmentsForTasks(rawTasks.map((t: any) => t.id), context.tenantSlug);
  const assignmentsByTask = new Map<string, any[]>();
  for (const row of assignmentRows) {
    const list = assignmentsByTask.get(row.task_id) ?? [];
    list.push(row);
    assignmentsByTask.set(row.task_id, list);
  }

  const tasks = rawTasks.map((t: any) => {
    const assignments = assignmentsByTask.get(t.id) ?? [];
    return {
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
      assignedTo: assignments.length > 0 ? assignments.map((a) => a.employee_name).join(", ") : "Unassigned",
      assignedEmployees: assignments.map((a) => ({
        id: a.employee_id,
        name: a.employee_name,
        department: a.employee_department_name ?? "",
      })),
      assignedEmployeeIds: assignments.map((a) => a.employee_id),
      contributionWeight: 0,
      priority: priorityToPlanner(Number(t.priority ?? 2)),
    };
  });

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
    title,
    description,
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
    requiredSkills: requiredSkills ?? [],
    estimatedHours: Number(estimatedHours),
    priority: priorityToDb[priority as string] ?? 2,
    plannedEndDate: new Date(dueDate),
    status: "NOT_STARTED",
  } as any, context.userId);

  if (!task) {
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }

  // Smart suggestions are advisory only — department is optional and never
  // restricts which employees can actually be assigned below.
  const suggestions = department
    ? suggestAssignments({
        tenantSlug: context.tenantSlug,
        department,
        requiredSkills: requiredSkills ?? [],
      })
    : [];

  // Persist real assignments. Any employee, regardless of department, may
  // be assigned here — this list is not filtered by the suggestions above.
  if (assignedEmployees.length > 0) {
    const workDate = new Date().toISOString().split("T")[0];
    await Promise.all(
      assignedEmployees.map((employeeId: string) =>
        createTaskAssignment(
          context.tenantSlug,
          {
            taskId: task.id,
            projectId,
            employeeId,
            assignmentStartDate: new Date(),
            status: "ACCEPTED",
          } as any,
          context.userId
        ).then(() =>
          sendAttendanceSignal({ tenantSlug: context.tenantSlug, employeeId, workDate, taskId: task.id })
        )
      )
    );

    // Auto-tag HODs: notify each unique HOD whose department member was assigned
    try {
      const hodMap = await getHODsForEmployees(assignedEmployees, context.tenantSlug);
      const notifiedHODs = new Set<string>();
      for (const empId of assignedEmployees) {
        const hod = hodMap.get(empId);
        if (hod && !notifiedHODs.has(hod.hodId)) {
          notifiedHODs.add(hod.hodId);
          await insertNotification({
            tenantSlug: context.tenantSlug,
            employeeId: hod.hodId,
            type: 'info',
            category: 'projects',
            title: 'Task Assigned to Your Department Member',
            message: `Task "${task.title}" has been assigned to an employee in your department (${hod.departmentName}).`,
            actionUrl: `/tenant-admin/projects/tasks`,
          });
        }
      }
    } catch (notifErr) {
      console.error('Failed to notify HODs:', notifErr);
    }
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
