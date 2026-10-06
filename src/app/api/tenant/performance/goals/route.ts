export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import {
  validateTenantContext,
  getPaginationParams,
  errorResponse,
  handleTenantAdminError,
  checkRateLimit,
  parseJsonRequest,
} from "@/lib/tenant-admin/utils";
import { z } from "zod";

const CreateGoalSchema = z.object({
  employeeId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  targetValue: z.number().optional(),
  deadline: z.string().optional(),
  status: z.enum(["not-started", "in-progress", "completed", "on-hold"]).optional(),
});

const STATUS_TO_DB: Record<string, string> = {
  "not-started": "not_started",
  "in-progress": "in_progress",
  completed: "completed",
  "on-hold": "cancelled",
};

const STATUS_TO_UI: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  on_track: "In Progress",
  ahead: "In Progress",
  behind: "In Progress",
  achieved: "Completed",
  completed: "Completed",
  cancelled: "On Hold",
};

function mapGoal(r: any) {
  const target = Number(r.target_value) || 0;
  const actual = Number(r.actual_value) || 0;
  const targetDate = r.due_date ? new Date(r.due_date).toISOString().split("T")[0] : null;
  return {
    id: r.id,
    employeeId: r.employee_id,
    employeeName: r.employee_name ?? r.employee_id,
    title: r.title,
    description: r.description,
    targetValue: target || null,
    currentValue: actual,
    targetDate,
    deadline: targetDate,
    status: STATUS_TO_UI[r.status] ?? r.status,
    progress: target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : (["completed", "achieved"].includes(r.status) ? 100 : 0),
    createdDate: r.created_at ? new Date(r.created_at).toISOString().split("T")[0] : null,
  };
}

/**
 * GET /api/tenant/performance/goals
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`goals-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const pagination = getPaginationParams(request);
    await ensureHrTables(sql);

    const rows = await sql`
      select g.*, e.name as employee_name
      from admin_employee_goals g
      left join admin_employees e
        on e.tenant_slug = g.tenant_slug and e.id = g.employee_id
      where g.tenant_slug = ${context.tenantSlug}
      order by g.created_at desc
      limit ${pagination.limit} offset ${(pagination.page - 1) * pagination.limit}
    `;

    const goals = (rows as any[]).map(mapGoal);

    return NextResponse.json({
      success: true,
      data: goals,
      pagination: { page: pagination.page, limit: pagination.limit, total: goals.length },
    });
  } catch (error) {
    console.error("Performance goals GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/performance/goals
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");

    const parsed = await parseJsonRequest(request, CreateGoalSchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    await ensureHrTables(sql);
    const id = randomUUID();
    const [row] = await sql`
      insert into admin_employee_goals (
        id, tenant_slug, employee_id, title, description,
        target_value, actual_value, status, due_date, created_by,
        created_at, updated_at
      ) values (
        ${id}, ${context.tenantSlug}, ${parsed.data.employeeId}, ${parsed.data.title},
        ${parsed.data.description ?? null}, ${parsed.data.targetValue ?? null}, 0,
        ${STATUS_TO_DB[parsed.data.status ?? "not-started"]},
        ${parsed.data.deadline ?? null}, ${context.userId}, now(), now()
      )
      returning *
    `;

    const [emp] = await sql`
      select name from admin_employees
      where tenant_slug = ${context.tenantSlug} and id = ${parsed.data.employeeId}
      limit 1
    `;
    (row as any).employee_name = (emp as any)?.name ?? null;

    return NextResponse.json(
      { success: true, data: mapGoal(row), message: "Performance goal created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Performance goals POST error:", error);
    return handleTenantAdminError(error);
  }
}
