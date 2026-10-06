export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import { randomUUID } from "crypto";
import {
  validateTenantContext,
  errorResponse,
  checkRateLimit,
  handleTenantAdminError,
} from "@/lib/tenant-admin/utils";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalize(row: any) {
  return {
    id: row.id,
    name: row.name,
    startTime: row.start_time,
    endTime: row.end_time,
    daysOfWeek: row.days_of_week ?? [],
    graceMinutes: row.grace_minutes ?? 0,
    isActive: row.is_active,
    assignedCount: row.assigned_count != null ? Number(row.assigned_count) : undefined,
    createdAt: row.created_at,
  };
}

/** GET /api/tenant/shifts — shift definitions with live assignment counts */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");
    if (!checkRateLimit(`shifts-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }
    await ensureHrTables(sql);

    const rows = await sql`
      select s.*,
        (select count(*)::int from admin_shift_assignments a
         where a.tenant_slug = s.tenant_slug and a.shift_id = s.id
           and a.effective_from <= current_date
           and (a.effective_to is null or a.effective_to >= current_date)) as assigned_count
      from admin_shifts s
      where s.tenant_slug = ${context.tenantSlug}
      order by s.name asc
    `;
    return NextResponse.json({ success: true, data: (rows as any[]).map(normalize) });
  } catch (error) {
    console.error("Shifts GET error:", error);
    return errorResponse("Failed to load shifts", 500);
  }
}

/**
 * POST /api/tenant/shifts
 * Body: { name, startTime: 'HH:MM', endTime: 'HH:MM', daysOfWeek?: [0-6], graceMinutes? }
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    if (!checkRateLimit(`shifts-post-${context.tenantSlug}`, 20, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }
    await ensureHrTables(sql);

    const body = await request.json().catch(() => ({}));
    if (!body?.name || typeof body.name !== "string") {
      return errorResponse("name is required", 400);
    }
    if (!TIME_RE.test(body?.startTime) || !TIME_RE.test(body?.endTime)) {
      return errorResponse("startTime and endTime are required in HH:MM format", 400);
    }
    const days = Array.isArray(body?.daysOfWeek) ? body.daysOfWeek : [1, 2, 3, 4, 5];
    if (!days.every((d: any) => Number.isInteger(d) && d >= 0 && d <= 6)) {
      return errorResponse("daysOfWeek must be integers 0-6 (0 = Sunday)", 400);
    }
    const grace = typeof body?.graceMinutes === "number" && body.graceMinutes >= 0 ? body.graceMinutes : 0;

    const id = randomUUID();
    const [row] = await sql`
      insert into admin_shifts (id, tenant_slug, name, start_time, end_time, days_of_week, grace_minutes)
      values (${id}, ${context.tenantSlug}, ${body.name}, ${body.startTime}, ${body.endTime},
              ${days}::int[], ${grace})
      returning *
    ` as any[];
    return NextResponse.json({ success: true, data: normalize(row) }, { status: 201 });
  } catch (error) {
    console.error("Shifts POST error:", error);
    return handleTenantAdminError(error);
  }
}
