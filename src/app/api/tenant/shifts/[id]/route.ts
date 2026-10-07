export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import {
  validateTenantContext,
  errorResponse,
  checkRateLimit,
  handleTenantAdminError,
} from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";

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
    createdAt: row.created_at,
  };
}

/**
 * PATCH /api/tenant/shifts/[id]
 * { name?, startTime?, endTime?, daysOfWeek?, graceMinutes?, isActive? }
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = validateTenantContext(request, "write");
    const _gate1 = await requireModuleGate(request, "people", "write");
    if (_gate1) return _gate1;
    if (!checkRateLimit(`shifts-patch-${context.tenantSlug}`, 30, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }
    await ensureHrTables(sql);

    const [existing] = await sql`
      select * from admin_shifts where id = ${params.id} and tenant_slug = ${context.tenantSlug}
    ` as any[];
    if (!existing) return errorResponse("Shift not found", 404);

    const body = await request.json().catch(() => ({}));
    const startTime = body?.startTime != null ? String(body.startTime) : null;
    const endTime = body?.endTime != null ? String(body.endTime) : null;
    if ((startTime && !TIME_RE.test(startTime)) || (endTime && !TIME_RE.test(endTime))) {
      return errorResponse("Times must be HH:MM", 400);
    }
    const days = Array.isArray(body?.daysOfWeek)
      ? body.daysOfWeek
      : null;
    if (days && !days.every((d: any) => Number.isInteger(d) && d >= 0 && d <= 6)) {
      return errorResponse("daysOfWeek must be integers 0-6", 400);
    }

    const [row] = await sql`
      update admin_shifts
      set name = coalesce(${body?.name ?? null}, name),
          start_time = coalesce(${startTime}::time, start_time),
          end_time = coalesce(${endTime}::time, end_time),
          days_of_week = coalesce(${days}::int[], days_of_week),
          grace_minutes = coalesce(${typeof body?.graceMinutes === "number" ? body.graceMinutes : null}, grace_minutes),
          is_active = coalesce(${typeof body?.isActive === "boolean" ? body.isActive : null}, is_active),
          updated_at = now()
      where id = ${params.id} and tenant_slug = ${context.tenantSlug}
      returning *
    ` as any[];
    return NextResponse.json({ success: true, data: normalize(row) });
  } catch (error) {
    console.error("Shift PATCH error:", error);
    return handleTenantAdminError(error);
  }
}

/** DELETE /api/tenant/shifts/[id] — removes shift + its assignments */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = validateTenantContext(request, "write");
    const _gate2 = await requireModuleGate(request, "people", "write");
    if (_gate2) return _gate2;
    if (!checkRateLimit(`shifts-del-${context.tenantSlug}`, 20, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }
    await ensureHrTables(sql);

    const [existing] = await sql`
      select id from admin_shifts where id = ${params.id} and tenant_slug = ${context.tenantSlug}
    ` as any[];
    if (!existing) return errorResponse("Shift not found", 404);

    await sql`delete from admin_shift_assignments where shift_id = ${params.id} and tenant_slug = ${context.tenantSlug}`;
    await sql`delete from admin_shifts where id = ${params.id} and tenant_slug = ${context.tenantSlug}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Shift DELETE error:", error);
    return handleTenantAdminError(error);
  }
}
