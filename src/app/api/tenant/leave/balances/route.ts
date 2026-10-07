export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import {
  validateTenantContext,
  errorResponse,
  handleTenantAdminError,
  checkRateLimit,
  parseJsonRequest,
} from "@/lib/tenant-admin/utils";
import { z } from "zod";

// Statutory-style defaults; tenants override per employee via POST.
const DEFAULT_ENTITLEMENTS: Record<string, number> = {
  annual: 21,
  sick: 12,
  personal: 5,
  maternity: 90,
  paternity: 14,
  unpaid: 0,
};

const UpsertBalanceSchema = z.object({
  employeeId: z.string().min(1),
  leaveType: z.enum(["annual", "sick", "personal", "maternity", "paternity", "unpaid"]),
  year: z.number().int().optional(),
  entitled: z.number().min(0),
  carriedOver: z.number().min(0).optional(),
});

function mapBalance(r: any) {
  // Implicit tracking rows (entitlement_set=false) show the default
  // entitlement; explicit overrides show the configured value.
  const entitled = r.entitlement_set
    ? Number(r.entitled) || 0
    : (DEFAULT_ENTITLEMENTS[r.leave_type] ?? 0);
  const carried = Number(r.carried_over) || 0;
  const used = Number(r.used) || 0;
  const pending = Number(r.pending) || 0;
  return {
    id: r.id,
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    leaveType: r.leave_type,
    year: r.year,
    entitled,
    carriedOver: carried,
    used,
    pending,
    remaining: r.leave_type === "unpaid" ? null : Math.max(0, entitled + carried - used - pending),
  };
}

/**
 * GET /api/tenant/leave/balances?year=YYYY&employeeId=
 * Leave balances for every active employee (defaults applied where no row exists).
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`leave-bal-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    await ensureHrTables(sql);

    const url = new URL(request.url);
    const year = Number(url.searchParams.get("year")) || new Date().getUTCFullYear();
    const employeeId = url.searchParams.get("employeeId");

    const rows = await sql`
      select b.*, e.name as emp_name
      from admin_leave_balances b
      left join admin_employees e
        on e.tenant_slug = b.tenant_slug and e.id = b.employee_id
      where b.tenant_slug = ${context.tenantSlug} and b.year = ${year}
        ${employeeId ? sql`and b.employee_id = ${employeeId}` : sql``}
      order by e.name asc nulls last, b.leave_type asc
    `;

    // Fill in defaults for employees without balance rows
    const employees = await sql`
      select id, name from admin_employees
      where tenant_slug = ${context.tenantSlug} and status in ('active', 'invited')
      ${employeeId ? sql`and id = ${employeeId}` : sql``}
      order by name asc
    `;

    const existing = new Set((rows as any[]).map((r) => `${r.employee_id}:${r.leave_type}`));
    const balances = (rows as any[]).map((r) =>
      mapBalance({ ...r, employee_name: r.employee_name ?? r.emp_name })
    );

    for (const emp of employees as any[]) {
      for (const [leaveType, entitled] of Object.entries(DEFAULT_ENTITLEMENTS)) {
        if (entitled > 0 && !existing.has(`${emp.id}:${leaveType}`)) {
          balances.push({
            id: null,
            employeeId: emp.id,
            employeeName: emp.name,
            leaveType,
            year,
            entitled,
            carriedOver: 0,
            used: 0,
            pending: 0,
            remaining: entitled,
          });
        }
      }
    }

    return NextResponse.json({ success: true, data: balances, year });
  } catch (error) {
    console.error("Leave balances GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/leave/balances
 * Upsert an employee's entitlement for a leave type/year.
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");

    const parsed = await parseJsonRequest(request, UpsertBalanceSchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    await ensureHrTables(sql);
    const year = parsed.data.year ?? new Date().getUTCFullYear();

    const [emp] = await sql`
      select name from admin_employees
      where tenant_slug = ${context.tenantSlug} and id = ${parsed.data.employeeId}
      limit 1
    `;
    if (!emp) {
      return errorResponse("Employee not found", 404);
    }

    const [row] = await sql`
      insert into admin_leave_balances (
        id, tenant_slug, employee_id, employee_name, leave_type, year,
        entitled, carried_over, entitlement_set, created_at, updated_at
      ) values (
        ${randomUUID()}, ${context.tenantSlug}, ${parsed.data.employeeId},
        ${(emp as any).name}, ${parsed.data.leaveType}, ${year},
        ${parsed.data.entitled}, ${parsed.data.carriedOver ?? 0}, true, now(), now()
      )
      on conflict (tenant_slug, employee_id, leave_type, year)
      do update set
        entitled = excluded.entitled,
        carried_over = excluded.carried_over,
        entitlement_set = true,
        employee_name = excluded.employee_name,
        updated_at = now()
      returning *
    `;

    return NextResponse.json(
      { success: true, data: mapBalance(row), message: "Leave balance updated" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Leave balances POST error:", error);
    return handleTenantAdminError(error);
  }
}
