import { NextResponse } from 'next/server';
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import {
  getTasksForProject,
  createTask,
  getOrCreateDefaultWorkstream,
  getAssignmentsForTasks,
} from "@/lib/projects/db";
import { Task } from "@/lib/projects/types";

const statusToDb: Record<string, string> = {
  todo: "NOT_STARTED",
  "in-progress": "IN_PROGRESS",
  done: "COMPLETED",
  blocked: "BLOCKED",
};

const dbToStatus: Record<string, string> = {
  NOT_STARTED: "todo",
  IN_PROGRESS: "in-progress",
  COMPLETED: "done",
  BLOCKED: "blocked",
  CANCELLED: "cancelled",
};

const priorityToDb: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const dbToPriority = (n: number) => {
  if (n <= 1) return "low";
  if (n >= 3) return "high";
  return "medium";
};

function toClientTask(task: Task, assignments: any[] = []) {
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    description: task.description ?? "",
    status: dbToStatus[task.status] ?? task.status,
    priority: dbToPriority(Number(task.priority ?? 2)),
    assignee: assignments.length > 0 ? assignments.map((a) => a.employee_name).join(", ") : "",
    assignedEmployees: assignments.map((a) => ({
      id: a.employee_id,
      name: a.employee_name,
      department: a.employee_department_name ?? "",
    })),
    dueDate: task.plannedEndDate ? new Date(task.plannedEndDate).toISOString() : "",
  };
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = validateTenantContext(request as any, "read");
    const tasks = await getTasksForProject(params.id, context.tenantSlug);
    const assignmentRows = await getAssignmentsForTasks(tasks.map((t) => t.id), context.tenantSlug);
    const assignmentsByTask = new Map<string, any[]>();
    for (const row of assignmentRows) {
      const list = assignmentsByTask.get(row.task_id) ?? [];
      list.push(row);
      assignmentsByTask.set(row.task_id, list);
    }
    return NextResponse.json({
      tasks: tasks.map((t) => toClientTask(t, assignmentsByTask.get(t.id) ?? [])),
    });
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch tasks';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = validateTenantContext(request as any, "write");
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "Task title is required" }, { status: 400 });
    }

    const workstream = await getOrCreateDefaultWorkstream(params.id, context.tenantSlug, context.userId);
    if (!workstream) {
      return NextResponse.json({ error: "Unable to create a default workstream" }, { status: 500 });
    }

    const task = await createTask(context.tenantSlug, {
      workstreamId: workstream.id,
      projectId: params.id,
      code: `TASK-${Date.now()}`,
      title,
      description: body.description ?? "",
      status: (body.status && statusToDb[body.status]) ? statusToDb[body.status] : "NOT_STARTED",
      priority: body.priority ? priorityToDb[body.priority] ?? 2 : 2,
    } as any, context.userId);

    if (!task) {
      return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
    }

    return NextResponse.json({ task: toClientTask(task) }, { status: 201 });
  } catch (error) {
    console.error('Failed to create task:', error);
    const message = error instanceof Error ? error.message : 'Failed to create task';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
