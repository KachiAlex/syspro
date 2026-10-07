export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { updateTask, deleteTask } from "@/lib/projects/db";

const statusToDb: Record<string, string> = {
  todo: "NOT_STARTED",
  "in-progress": "IN_PROGRESS",
  done: "COMPLETED",
  blocked: "BLOCKED",
};

const VALID_TASK_STATUSES = new Set(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "BLOCKED", "ON_HOLD", "CANCELLED"]);

function parseTaskStatus(input: string): string {
  const dbValue = statusToDb[input] ?? input.toUpperCase().replace(/[\s-]+/g, "_");
  if (!VALID_TASK_STATUSES.has(dbValue)) {
    throw new Error(`Invalid status "${input}"`);
  }
  return dbValue;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const context = validateTenantContext(request as any, "write");
    const body = await request.json();

    const updates: any = {};
    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.description !== undefined) updates.description = body.description;
    try {
      if (body.status !== undefined) updates.status = parseTaskStatus(body.status);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid value" },
        { status: 400 }
      );
    }
    if (body.priority !== undefined) {
      const map: Record<string, number> = { low: 1, medium: 2, high: 3 };
      const p = map[body.priority] ?? Number(body.priority);
      if (!Number.isFinite(p)) {
        return NextResponse.json({ error: `Invalid priority "${body.priority}"` }, { status: 400 });
      }
      updates.priority = p;
    }
    if (body.percentComplete !== undefined) {
      const pc = Number(body.percentComplete);
      if (!Number.isFinite(pc) || pc < 0 || pc > 100) {
        return NextResponse.json({ error: "percentComplete must be a number between 0 and 100" }, { status: 400 });
      }
      updates.percentComplete = pc;
    }
    if (body.dueDate !== undefined) updates.plannedEndDate = body.dueDate ? new Date(body.dueDate) : null;

    const task = await updateTask(params.taskId, context.tenantSlug, updates);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json({ task, message: 'Task updated successfully' });
  } catch (error) {
    console.error('Failed to update task:', error);
    const message = error instanceof Error ? error.message : 'Failed to update task';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const context = validateTenantContext(request as any, "delete");
    const deleted = await deleteTask(params.taskId, context.tenantSlug);
    if (!deleted) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Failed to delete task:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete task';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
