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

const CreateComponentSchema = z.object({
  employeeId: z.string().min(1),
  name: z.string().min(1),
  componentType: z.enum(["earning", "deduction"]),
  amountType: z.enum(["fixed", "percent_of_base"]).default("fixed"),
  amount: z.number().min(0),
  isRecurring: z.boolean().default(true),
  startPeriod: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  endPeriod: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  notes: z.string().optional(),
});

function mapComponent(r: any) {
  return {
    id: r.id,
    employeeId: r.employee_id,
    employeeName: r.employee_name ?? r.emp_name ?? r.employee_id,
    name: r.name,
    componentType: r.component_type,
    amountType: r.amount_type,
    amount: Number(r.amount) || 0,
    isRecurring: r.is_recurring,
    isActive: r.is_active,
    startPeriod: r.start_period,
    endPeriod: r.end_period,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

/**
 * GET /api/tenant/payroll/components?employeeId=
 * Recurring salary components (allowances, deductions, loans).
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`components-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const url = new URL(request.url);
    const employeeId = url.searchParams.get("employeeId");
    const activeOnly = url.searchParams.get("active") !== "false";
    const pagination = getPaginationParams(request);
    await ensureHrTables(sql);

    const rows = await sql`
      select c.*, e.name as emp_name
      from admin_employee_components c
      left join admin_employees e
        on e.tenant_slug = c.tenant_slug and e.id = c.employee_id
      where c.tenant_slug = ${context.tenantSlug}
        ${employeeId ? sql`and c.employee_id = ${employeeId}` : sql``}
        ${activeOnly ? sql`and c.is_active` : sql``}
      order by e.name asc nulls last, c.created_at desc
      limit ${pagination.limit} offset ${(pagination.page - 1) * pagination.limit}
    `;

    const data = (rows as any[]).map(mapComponent);
    return NextResponse.json({
      success: true,
      data,
      pagination: { page: pagination.page, limit: pagination.limit, total: data.length },
    });
  } catch (error) {
    console.error("Payroll components GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/payroll/components
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");

    const parsed = await parseJsonRequest(request, CreateComponentSchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    await ensureHrTables(sql);

    const [emp] = await sql`
      select name from admin_employees
      where tenant_slug = ${context.tenantSlug} and id = ${parsed.data.employeeId}
      limit 1
    `;
    if (!emp) {
      return errorResponse("Employee not found", 404);
    }

    const [row] = await sql`
      insert into admin_employee_components (
        id, tenant_slug, employee_id, employee_name, name, component_type,
        amount_type, amount, is_recurring, is_active, start_period, end_period,
        notes, created_by
      ) values (
        ${randomUUID()}, ${context.tenantSlug}, ${parsed.data.employeeId},
        ${(emp as any).name}, ${parsed.data.name}, ${parsed.data.componentType},
        ${parsed.data.amountType}, ${parsed.data.amount}, ${parsed.data.isRecurring},
        true, ${parsed.data.startPeriod ?? null}, ${parsed.data.endPeriod ?? null},
        ${parsed.data.notes ?? null}, ${context.userId}
      )
      returning *
    `;

    return NextResponse.json(
      { success: true, data: mapComponent(row), message: "Salary component created" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Payroll components POST error:", error);
    return handleTenantAdminError(error);
  }
}
