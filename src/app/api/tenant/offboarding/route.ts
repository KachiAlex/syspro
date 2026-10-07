export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import { randomUUID } from "crypto";
import {
  validateTenantContext,
  errorResponse,
  checkRateLimit,
} from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";

const DEFAULT_CHECKLIST = [
  { key: "exit_interview", label: "Exit interview conducted" },
  { key: "asset_return", label: "Company assets returned" },
  { key: "access_revoked", label: "System & portal access revoked" },
  { key: "final_pay", label: "Final pay processed" },
  { key: "documents_archived", label: "Documents archived" },
];

function normalize(row: any) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name ?? row.emp_name,
    reason: row.reason,
    lastWorkingDay: row.last_working_day instanceof Date
      ? row.last_working_day.toISOString().split("T")[0]
      : row.last_working_day,
    status: row.status,
    checklist: Array.isArray(row.checklist) ? row.checklist : [],
    notes: row.notes,
    initiatedBy: row.initiated_by,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

/** GET /api/tenant/offboarding — list offboarding records (optionally ?status=) */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");
    const _gate1 = await requireModuleGate(request, "people", "read");
    if (_gate1) return _gate1;
    if (!checkRateLimit(`offb-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }
    await ensureHrTables(sql);

    const status = new URL(request.url).searchParams.get("status");
    const rows = await sql`
      select o.*, e.name as emp_name
      from admin_offboarding o
      left join admin_employees e
        on e.tenant_slug = o.tenant_slug and e.id = o.employee_id
      where o.tenant_slug = ${context.tenantSlug}
        ${status ? sql`and o.status = ${status}` : sql``}
      order by o.created_at desc
    `;
    return NextResponse.json({ success: true, data: (rows as any[]).map(normalize) });
  } catch (error) {
    console.error("Offboarding GET error:", error);
    return errorResponse("Failed to load offboarding records", 500);
  }
}

/**
 * POST /api/tenant/offboarding — initiate offboarding for an employee.
 * Body: { employeeId, reason?, lastWorkingDay?, notes?, checklist? }
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const _gate2 = await requireModuleGate(request, "people", "write");
    if (_gate2) return _gate2;
    if (!checkRateLimit(`offb-post-${context.tenantSlug}`, 20, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }
    await ensureHrTables(sql);

    const body = await request.json().catch(() => ({}));
    if (!body?.employeeId) return errorResponse("employeeId is required", 400);

    const [emp] = await sql`
      select id, name, status from admin_employees
      where tenant_slug = ${context.tenantSlug} and id = ${body.employeeId}
    ` as any[];
    if (!emp) return errorResponse("Employee not found", 404);
    if (emp.status === "terminated") return errorResponse("Employee already terminated", 400);

    const [existing] = await sql`
      select id from admin_offboarding
      where tenant_slug = ${context.tenantSlug} and employee_id = ${body.employeeId}
        and status in ('initiated','in_progress')
    ` as any[];
    if (existing) return errorResponse("An active offboarding already exists for this employee", 409);

    const checklist = Array.isArray(body?.checklist) && body.checklist.length
      ? body.checklist.map((c: any) => ({
          key: String(c.key ?? c.label ?? "").toLowerCase().replace(/\s+/g, "_"),
          label: String(c.label ?? c.key ?? ""),
          done: false,
        }))
      : DEFAULT_CHECKLIST.map((c) => ({ ...c, done: false }));

    const lastWorkingDay = typeof body?.lastWorkingDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.lastWorkingDay)
      ? body.lastWorkingDay
      : null;

    const id = randomUUID();
    const [row] = await sql`
      insert into admin_offboarding
        (id, tenant_slug, employee_id, employee_name, reason, last_working_day, checklist, notes, initiated_by)
      values
        (${id}, ${context.tenantSlug}, ${emp.id}, ${emp.name}, ${body?.reason ?? null},
         ${lastWorkingDay}, ${JSON.stringify(checklist)}::jsonb, ${body?.notes ?? null}, ${context.userId})
      returning *
    ` as any[];

    return NextResponse.json({ success: true, data: normalize(row) }, { status: 201 });
  } catch (error) {
    console.error("Offboarding POST error:", error);
    return errorResponse("Failed to initiate offboarding", 500);
  }
}
