export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { requireSuperAdmin } from "@/lib/api-auth";

const sql = getSql();

/**
 * Per-tenant usage monitoring across the platform.
 * Reads the metered counters in tenant_usage_daily (populated by
 * meterApiCall on every module-gated request), seat occupancy, and
 * tenant admin activity from admin_audit_logs.
 */
export async function GET(request: NextRequest) {
  const _auth = await requireSuperAdmin(request);
  if (!_auth.ok) return _auth.response;

  try {
    const apiRows = await sql`
      SELECT tenant_slug,
        SUM(value) FILTER (WHERE metric = 'api_call' AND usage_date = current_date)             AS calls_today,
        SUM(value) FILTER (WHERE metric = 'api_call' AND usage_date >= current_date - 6)        AS calls_7d,
        SUM(value) FILTER (WHERE metric = 'api_call' AND usage_date >= current_date - 29)       AS calls_30d,
        MAX(usage_date)                                                                       AS last_active
      FROM tenant_usage_daily
      WHERE metric LIKE 'api_call%'
      GROUP BY tenant_slug
    `;

    const moduleRows = await sql`
      SELECT tenant_slug,
             split_part(metric, ':', 2) AS module,
             SUM(value) AS v
      FROM tenant_usage_daily
      WHERE metric LIKE 'api_call:%' AND usage_date >= current_date - 29
      GROUP BY tenant_slug, split_part(metric, ':', 2)
    `;

    const seatRows = await sql`
      SELECT t.slug AS tenant_slug, t.name AS tenant_name,
             (SELECT COUNT(*) FROM tenant_admins ta WHERE ta.tenant_id = t.id) AS admins,
             (SELECT COUNT(*) FROM admin_employees e WHERE e.tenant_slug = t.slug) AS employees,
             (SELECT l.seats FROM licenses l WHERE l.tenant_id = t.id AND (l.expiry IS NULL OR l.expiry >= current_date) ORDER BY l.created_at DESC LIMIT 1) AS seat_limit
      FROM tenants t
      ORDER BY t.name
    `;

    const activityRows = await sql`
      SELECT tenant_slug, COUNT(*) AS audit_events_30d
      FROM admin_audit_logs
      WHERE created_at >= now() - interval '30 days'
      GROUP BY tenant_slug
    `;

    const topModuleByTenant = new Map<string, { module: string; value: number }>();
    const modulesByTenant = new Map<string, Record<string, number>>();
    for (const r of moduleRows as any[]) {
      const cur = modulesByTenant.get(r.tenant_slug) || {};
      cur[r.module] = Number(r.v);
      modulesByTenant.set(r.tenant_slug, cur);
      const top = topModuleByTenant.get(r.tenant_slug);
      if (!top || Number(r.v) > top.value) {
        topModuleByTenant.set(r.tenant_slug, { module: r.module, value: Number(r.v) });
      }
    }

    const apiByTenant = new Map<string, any>();
    for (const r of apiRows as any[]) apiByTenant.set(r.tenant_slug, r);
    const activityByTenant = new Map<string, number>();
    for (const r of activityRows as any[]) activityByTenant.set(r.tenant_slug, Number(r.audit_events_30d));

    const tenants = (seatRows as any[]).map((s) => {
      const api = apiByTenant.get(s.tenant_slug);
      const top = topModuleByTenant.get(s.tenant_slug);
      const seatsUsed = Number(s.admins) + Number(s.employees);
      return {
        tenantSlug: s.tenant_slug,
        tenantName: s.tenant_name,
        seats: { used: seatsUsed, limit: s.seat_limit != null ? Number(s.seat_limit) : null },
        apiCalls: {
          today: Number(api?.calls_today ?? 0),
          last7d: Number(api?.calls_7d ?? 0),
          last30d: Number(api?.calls_30d ?? 0),
        },
        topModule: top?.module ?? null,
        byModule: modulesByTenant.get(s.tenant_slug) || {},
        auditEvents30d: activityByTenant.get(s.tenant_slug) ?? 0,
        lastActive: api?.last_active ?? null,
      };
    });

    const totals = {
      tenants: tenants.length,
      activeTenants30d: tenants.filter((t) => t.apiCalls.last30d > 0 || t.auditEvents30d > 0).length,
      apiCallsToday: tenants.reduce((a, t) => a + t.apiCalls.today, 0),
      apiCalls7d: tenants.reduce((a, t) => a + t.apiCalls.last7d, 0),
      apiCalls30d: tenants.reduce((a, t) => a + t.apiCalls.last30d, 0),
      seatsUsed: tenants.reduce((a, t) => a + t.seats.used, 0),
      seatsLicensed: tenants.reduce((a, t) => a + (t.seats.limit ?? 0), 0),
    };

    tenants.sort((a, b) => b.apiCalls.last30d - a.apiCalls.last30d);

    return NextResponse.json({ totals, tenants });
  } catch (error) {
    console.error('Error fetching usage summary:', error);
    return NextResponse.json({ error: 'Failed to fetch usage summary' }, { status: 500 });
  }
}
