import { NextRequest, NextResponse } from "next/server";

// In-memory storage for project tasks
const tasks: Record<string, Array<{ id: string; projectId: string; title: string; assignee: string; status: "todo" | "in-progress" | "done"; dueDate: string }>> = {};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug") || "default";

  const tenantTasks = tasks[tenantSlug] || [];
  return NextResponse.json({ tasks: tenantTasks });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenantSlug = "default", projectId, title, assignee, dueDate } = body;

  if (!projectId || !title || !assignee || !dueDate) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (!tasks[tenantSlug]) {
    tasks[tenantSlug] = [];
  }

  const newTask = {
    id: `task-${Date.now()}`,
    projectId,
    title,
    assignee,
    status: "todo" as const,
    dueDate,
  };

  tasks[tenantSlug].push(newTask);

  return NextResponse.json(
    { task: newTask, message: "Task created successfully" },
    { status: 201 }
  );
}
