export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { canAccessEmployeeRecord, resolveEmployeeSession } from "@/lib/hr/auth";
import { ensureHrTables } from "@/lib/hr/db";
import { sql as SQL } from "@/lib/sql-client";
import {
  insertGoal,
  getEmployeeGoals,
  updateGoalStatus,
} from "@/lib/hr/db-appraisals";
import { isTenantSuspended } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const session = resolveEmployeeSession(request);
    if (session && (await isTenantSuspended(session.tenantSlug))) return NextResponse.json({ error: "Tenant is suspended" }, { status: 403 });
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const url = new URL(request.url);
  const employeeId = url.searchParams.get("employeeId") || session.id;

  try {
    await ensureHrTables();
    if (!(await canAccessEmployeeRecord(session, employeeId))) {
      return NextResponse.json({ error: "Not authorized to view these goals" }, { status: 403 });
    }
    const goals = await getEmployeeGoals(session.tenantSlug, employeeId);
    return NextResponse.json({ goals });
  } catch (error: any) {
    console.error("Goals GET error:", error?.message);
    return NextResponse.json({ error: "Failed to load goals" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = resolveEmployeeSession(request);
    if (session && (await isTenantSuspended(session.tenantSlug))) return NextResponse.json({ error: "Tenant is suspended" }, { status: 403 });
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

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

    if (!(await canAccessEmployeeRecord(session, employeeId))) {
      return NextResponse.json({ error: "Not authorized to create goals for this employee" }, { status: 403 });
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
    if (session && (await isTenantSuspended(session.tenantSlug))) return NextResponse.json({ error: "Tenant is suspended" }, { status: 403 });
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    await ensureHrTables();
    const body = await request.json();
    const { goalId, status, actualValue } = body;

    if (!goalId) {
      return NextResponse.json({ error: "goalId is required" }, { status: 400 });
    }

    const goalRows = (await SQL`
      select employee_id from admin_employee_goals
      where tenant_slug = ${session.tenantSlug} and id = ${goalId} limit 1
    `) as any[];
    const goal = goalRows[0];
    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }
    if (!(await canAccessEmployeeRecord(session, goal.employee_id))) {
      return NextResponse.json({ error: "Not authorized to update this goal" }, { status: 403 });
    }

    await updateGoalStatus(session.tenantSlug, goalId, status, actualValue);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Goals PATCH error:", error?.message);
    return NextResponse.json({ error: "Failed to update goal" }, { status: 500 });
  }
}
