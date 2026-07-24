import { NextRequest, NextResponse } from "next/server";
import { resolveEmployeeSession } from "@/lib/hr/auth";
import { ensureHrTables } from "@/lib/hr/db";
import {
  insertGoal,
  getEmployeeGoals,
  updateGoalStatus,
} from "@/lib/hr/db-appraisals";

export async function GET(request: NextRequest) {
  const session = resolveEmployeeSession(request);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const url = new URL(request.url);
  const employeeId = url.searchParams.get("employeeId") || session.id;

  try {
    await ensureHrTables();
    const goals = await getEmployeeGoals(session.tenantSlug, employeeId);
    return NextResponse.json({ goals });
  } catch (error: any) {
    console.error("Goals GET error:", error?.message);
    return NextResponse.json({ error: "Failed to load goals" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = resolveEmployeeSession(request);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const employeeRole = (session.role || "staff").toLowerCase();
  const isHR = employeeRole === "hr" || employeeRole === "hr_admin" || employeeRole === "hr_manager";
  const isHOD = employeeRole === "hod" || employeeRole === "head_of_department";

  try {
    await ensureHrTables();
    const body = await request.json();
    const {
      employeeId,
      title,
      description,
      targetMetric,
      targetValue,
      priority,
      startDate,
      dueDate,
      linkedTaskIds,
    } = body;

    if (!employeeId || !title) {
      return NextResponse.json({ error: "employeeId and title are required" }, { status: 400 });
    }

    if (!isHR && !isHOD && employeeId !== session.id) {
      return NextResponse.json({ error: "Not authorized to create goals for others" }, { status: 403 });
    }

    const id = await insertGoal({
      tenantSlug: session.tenantSlug,
      employeeId,
      title,
      description: description || "",
      targetMetric: targetMetric || "",
      targetValue: targetValue ? Number(targetValue) : 0,
      actualValue: 0,
      status: "not_started",
      priority: priority || "medium",
      startDate: startDate || new Date().toISOString(),
      dueDate: dueDate || null,
      linkedTaskIds: linkedTaskIds || [],
      completedAt: null,
      createdBy: session.id,
    });

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error("Goals POST error:", error?.message);
    return NextResponse.json({ error: "Failed to create goal" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = resolveEmployeeSession(request);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    await ensureHrTables();
    const body = await request.json();
    const { goalId, status, actualValue } = body;

    if (!goalId) {
      return NextResponse.json({ error: "goalId is required" }, { status: 400 });
    }

    await updateGoalStatus(session.tenantSlug, goalId, status, actualValue);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Goals PATCH error:", error?.message);
    return NextResponse.json({ error: "Failed to update goal" }, { status: 500 });
  }
}
