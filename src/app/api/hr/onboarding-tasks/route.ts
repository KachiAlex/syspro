import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listOnboardingTasks, insertOnboardingTask } from "@/lib/hr/db-recruitment";

const listSchema = z.object({
  tenantSlug: z.string().min(1),
  employeeId: z.string().optional(),
  category: z.enum(["hr", "it", "admin", "manager", "compliance"]).optional(),
  status: z.enum(["pending", "in_progress", "completed", "overdue"]).optional(),
  assignedToUserId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

const createSchema = z.object({
  tenantSlug: z.string().min(1),
  employeeId: z.string().min(1),
  category: z.enum(["hr", "it", "admin", "manager", "compliance"]),
  task: z.string().min(1),
  assignedToUserId: z.string().min(1),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    tenantSlug: url.searchParams.get("tenantSlug") ?? undefined,
    employeeId: url.searchParams.get("employeeId") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    assignedToUserId: url.searchParams.get("assignedToUserId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const tasks = await listOnboardingTasks(parsed.data);
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("Onboarding task list failed", error);
    return NextResponse.json({ error: "Failed to load onboarding tasks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const task = await insertOnboardingTask(parsed.data);
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("Onboarding task create failed", error);
    return NextResponse.json({ error: "Failed to create onboarding task" }, { status: 500 });
  }
}
