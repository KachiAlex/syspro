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

function normalize(row: any) {
  return {
    id: row.id,
    name: row.name,
    periodStart: row.period_start instanceof Date
      ? row.period_start.toISOString().split("T")[0]
      : row.period_start,
    periodEnd: row.period_end instanceof Date
      ? row.period_end.toISOString().split("T")[0]
      : row.period_end,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/**
 * PATCH /api/tenant/performance/cycles/[id]
 * { action: 'close' }  — close the cycle (no more reviews attach to it)
 * { action: 'reopen' } — reopen a closed cycle
 * { name, periodStart, periodEnd } — update while open
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = validateTenantContext(request, "write");
    const _gate1 = await requireModuleGate(request, "people", "write");
    if (_gate1) return _gate1;
    if (!checkRateLimit(`revcycle-patch-${context.tenantSlug}`, 30, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }
    await ensureHrTables(sql);

    const [row] = await sql`
      select * from admin_review_cycles
      where id = ${params.id} and tenant_slug = ${context.tenantSlug}
    ` as any[];
    if (!row) return errorResponse("Review cycle not found", 404);

    const body = await request.json().catch(() => ({}));

    if (body?.action === "close" || body?.action === "reopen") {
      const status = body.action === "close" ? "closed" : "open";
      const [updated] = await sql`
        update admin_review_cycles set status = ${status}, updated_at = now()
        where id = ${params.id} and tenant_slug = ${context.tenantSlug}
        returning *
      ` as any[];
      return NextResponse.json({ success: true, data: normalize(updated) });
    }

    if (row.status === "closed") {
      return errorResponse("Cannot edit a closed review cycle — reopen it first", 400);
    }

    const validDate = (v: any) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const periodStart = validDate(body?.periodStart) ? body.periodStart : null;
    const periodEnd = validDate(body?.periodEnd) ? body.periodEnd : null;
    const newStart = periodStart ?? (row.period_start instanceof Date ? row.period_start.toISOString().split("T")[0] : row.period_start);
    const newEnd = periodEnd ?? (row.period_end instanceof Date ? row.period_end.toISOString().split("T")[0] : row.period_end);
    if (newEnd < newStart) {
      return errorResponse("periodEnd must be on or after periodStart", 400);
    }

    const [updated] = await sql`
      update admin_review_cycles
      set name = coalesce(${body?.name ?? null}, name),
          period_start = ${newStart},
          period_end = ${newEnd},
          updated_at = now()
      where id = ${params.id} and tenant_slug = ${context.tenantSlug}
      returning *
    ` as any[];
    return NextResponse.json({ success: true, data: normalize(updated) });
  } catch (error) {
    console.error("Review cycle PATCH error:", error);
    return handleTenantAdminError(error);
  }
}
