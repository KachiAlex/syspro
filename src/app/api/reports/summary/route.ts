import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { db } from "@/lib/sql-client";
import { getCache as getRedisCache, setCache as setRedisCache, isRedisEnabled } from "@/lib/cache/redis";

// Simple in-memory cache for summary endpoint to reduce DB pressure.
// Uses a short TTL configurable via REPORTS_SUMMARY_CACHE_TTL (seconds).
const CACHE_TTL_MS = (Number(process.env.REPORTS_SUMMARY_CACHE_TTL) || 30) * 1000;
let cachedSummary: { value?: any; expiresAt?: number } = {};

export async function GET(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "read");

    const cacheKey = `reports:summary:${tenantSlug}`;

    // Prefer Redis when available (shared cache across instances), fall back to in-memory
    if (isRedisEnabled()) {
      try {
        const cached = await getRedisCache(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            return NextResponse.json(parsed);
          } catch (e) {
            // fall through to recompute
            console.error('Failed to parse cached summary', e);
          }
        }
      } catch (e) {
        console.error('Redis read failed, falling back', e);
      }
    } else {
      const now = Date.now();
      if (cachedSummary.value && cachedSummary.expiresAt && cachedSummary.expiresAt > now) {
        return NextResponse.json(cachedSummary.value);
      }
    }

    // Try materialized view first (faster on large datasets). If not present, fall back to live aggregation.
    let payload: any;
    try {
      const mv = await db.query("select total_reports, queued_jobs, runs_last_7, avg_run_secs from reports_summary_mv where tenant_slug = $1 limit 1", [tenantSlug]);
      if (mv.rows && mv.rows.length > 0) {
        const r = mv.rows[0];
        payload = { totalReports: r.total_reports ?? 0, queuedJobs: r.queued_jobs ?? 0, runsLast7: r.runs_last_7 ?? 0, avgRunSecs: r.avg_run_secs ?? null };
      }
    } catch (e) {
      // materialized view not present or query failed; we'll compute below
      console.error('Materialized view query failed:', e);
      payload = null;
    }

    if (!payload) {
      // Top-line aggregates for the Reports header (fallback)
      try {
        const totalRes = await db.query("select count(*)::int as count from reports where tenant_slug = $1", [tenantSlug]);
        const queuedRes = await db.query("select count(*)::int as count from report_jobs where tenant_slug = $1 and status = 'queued'", [tenantSlug]);
        const runsRes = await db.query("select count(*)::int as count from report_jobs where tenant_slug = $1 and created_at >= now() - interval '7 days'", [tenantSlug]);
        const avgRes = await db.query("select avg(extract(epoch from (completed_at - started_at))) as avg_secs from report_jobs where tenant_slug = $1 and completed_at is not null and completed_at >= now() - interval '7 days'", [tenantSlug]);

        const totalReports = totalRes.rows?.[0]?.count ?? 0;
        const queuedJobs = queuedRes.rows?.[0]?.count ?? 0;
        const runsLast7 = runsRes.rows?.[0]?.count ?? 0;
        const avgRunSecs = avgRes.rows?.[0]?.avg_secs ? Number(avgRes.rows[0].avg_secs) : null;

        payload = { totalReports, queuedJobs, runsLast7, avgRunSecs };
      } catch (e) {
        // Database is unavailable or tables don't exist - return empty defaults
        console.error('Database query failed, returning defaults:', e);
        payload = { totalReports: 0, queuedJobs: 0, runsLast7: 0, avgRunSecs: null };
      }
    }

    if (isRedisEnabled()) {
      try {
        await setRedisCache(cacheKey, JSON.stringify(payload), CACHE_TTL_MS / 1000);
      } catch (e) {
        console.error('Redis write failed', e);
      }
    } else {
      cachedSummary = { value: payload, expiresAt: Date.now() + CACHE_TTL_MS };
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Reports summary failed", error);
    const message = error instanceof Error ? error.message : "Unable to fetch report summary";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
