import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { db } from "@/lib/sql-client";

// Admin-only endpoint to refresh the reports materialized view.
// Intended to be called from a CI job or a schedule runner.
export async function POST(request: NextRequest) {
  try {
    // Allow internal service token to run the refresh (useful for cron jobs).
    const svcToken = request.headers.get("x-internal-refresh-token");
    if (svcToken && process.env.REPORTS_REFRESH_TOKEN && svcToken === process.env.REPORTS_REFRESH_TOKEN) {
      // token matched; proceed without user auth
    } else {
      const auth = extractAuthContext(request);
      const tenantSlug = validateTenant(auth.tenantSlug);
      // require an elevated permission — 'admin' or write on reports
      requirePermission(auth.userRole, "admin");
    }

    // Run a concurrent refresh where supported; fallback to non-concurrent
    try {
      await db.query("refresh materialized view concurrently reports_summary_mv");
    } catch (e) {
      // some Postgres setups don't allow concurrent refresh; fallback
      await db.query("refresh materialized view reports_summary_mv");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to refresh reports summary materialized view", error);
    const message = error instanceof Error ? error.message : "Unable to refresh reports summary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
