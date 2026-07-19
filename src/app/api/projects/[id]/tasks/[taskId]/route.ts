import { NextResponse } from 'next/server';
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { updateTask, deleteTask } from "@/lib/projects/db";

const statusToDb: Record<string, string> = {
  todo: "NOT_STARTED",
  "in-progress": "IN_PROGRESS",
  done: "COMPLETED",
  blocked: "BLOCKED",
};

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
    if (body.status !== undefined) updates.status = statusToDb[body.status] || body.status.toUpperCase().replace(/-/g, "_");
    if (body.priority !== undefined) {
      const map: Record<string, number> = { low: 1, medium: 2, high: 3 };
      updates.priority = map[body.priority] ?? Number(body.priority) ?? 2;
    }
    if (body.dueDate !== undefined) updates.plannedEndDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.percentComplete !== undefined) updates.percentComplete = Number(body.percentComplete);

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
