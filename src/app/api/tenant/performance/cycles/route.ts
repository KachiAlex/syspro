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
    reviewCount: row.review_count != null ? Number(row.review_count) : undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/** GET /api/tenant/performance/cycles — list review cycles with review counts */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");
    const _gate1 = await requireModuleGate(request, "people", "read");
    if (_gate1) return _gate1;
    if (!checkRateLimit(`revcycles-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }
    await ensureHrTables(sql);
    try {
      await sql`alter table tenant_performance_reviews add column if not exists cycle_id text`;
    } catch {
      // tenant_performance_reviews may not exist yet
    }

    let rows: any;
    try {
      rows = await sql`
        select c.*,
          (select count(*)::int from tenant_performance_reviews r
           where r.tenant_slug = c.tenant_slug and r.cycle_id = c.id) as review_count
        from admin_review_cycles c
        where c.tenant_slug = ${context.tenantSlug}
        order by c.period_start desc
      `;
    } catch {
      // tenant_performance_reviews may not exist yet — list cycles without counts
      rows = await sql`
        select c.*, null::int as review_count from admin_review_cycles c
        where c.tenant_slug = ${context.tenantSlug} order by c.period_start desc
      `;
    }
    return NextResponse.json({ success: true, data: (rows as any[]).map(normalize) });
  } catch (error) {
    console.error("Review cycles GET error:", error);
    return errorResponse("Failed to load review cycles", 500);
  }
}

/**
 * POST /api/tenant/performance/cycles — open a new review cycle.
 * Body: { name, periodStart, periodEnd }
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const _gate2 = await requireModuleGate(request, "people", "write");
    if (_gate2) return _gate2;
    if (!checkRateLimit(`revcycles-post-${context.tenantSlug}`, 20, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }
    await ensureHrTables(sql);

    const body = await request.json().catch(() => ({}));
    if (!body?.name || typeof body.name !== "string") {
      return errorResponse("name is required", 400);
    }
    const validDate = (v: any) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
    if (!validDate(body?.periodStart) || !validDate(body?.periodEnd)) {
      return errorResponse("periodStart and periodEnd are required (YYYY-MM-DD)", 400);
    }
    if (body.periodEnd < body.periodStart) {
      return errorResponse("periodEnd must be on or after periodStart", 400);
    }

    const id = randomUUID();
    const [row] = await sql`
      insert into admin_review_cycles (id, tenant_slug, name, period_start, period_end, created_by)
      values (${id}, ${context.tenantSlug}, ${body.name}, ${body.periodStart}, ${body.periodEnd}, ${context.userId})
      returning *
    ` as any[];
    return NextResponse.json({ success: true, data: normalize(row) }, { status: 201 });
  } catch (error) {
    console.error("Review cycles POST error:", error);
    return errorResponse("Failed to create review cycle", 500);
  }
}
