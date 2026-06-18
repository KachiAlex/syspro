import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateOnboardingTask, deleteOnboardingTask, getOnboardingTaskById } from "@/lib/hr/db-recruitment";

const updateSchema = z.object({
  tenantSlug: z.string().min(1),
  category: z.enum(["hr", "it", "admin", "manager", "compliance"]).optional(),
  task: z.string().min(1).optional(),
  assignedToUserId: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed", "overdue"]).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  completedAt: z.string().datetime().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "Missing tenantSlug" }, { status: 400 });
  }

  try {
    const task = await getOnboardingTaskById(id, tenantSlug);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ task });
  } catch (error) {
    console.error("Onboarding task get failed", error);
    return NextResponse.json({ error: "Failed to load onboarding task" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const task = await updateOnboardingTask(id, parsed.data.tenantSlug, parsed.data);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ task });
  } catch (error) {
    console.error("Onboarding task update failed", error);
    return NextResponse.json({ error: "Failed to update onboarding task" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "Missing tenantSlug" }, { status: 400 });
  }

  try {
    await deleteOnboardingTask(id, tenantSlug);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Onboarding task delete failed", error);
    return NextResponse.json({ error: "Failed to delete onboarding task" }, { status: 500 });
  }
}
