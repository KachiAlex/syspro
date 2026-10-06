export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { requireDashboardPermission } from "@/lib/tenant-admin/permissions";

import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "admin", "read");
    if (!_scope.ok) return _scope.response;

  const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  try {
    await requireDashboardPermission(request, "admin");
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const metrics: any[] = [];

  // API is healthy by virtue of this response being served; report real latency.
  const apiStart = Date.now();
  metrics.push({
    service: "API",
    status: "healthy",
    uptime: "n/a",
    lastChecked: now,
    latency: Date.now() - apiStart,
  });

  // Database: real connectivity + latency check
  try {
    const dbStart = Date.now();
    await sql`select 1`;
    metrics.push({
      service: "Database",
      status: "healthy",
      uptime: "n/a",
      lastChecked: now,
      latency: Date.now() - dbStart,
    });
  } catch {
    metrics.push({
      service: "Database",
      status: "down",
      uptime: "n/a",
      lastChecked: now,
      latency: null,
    });
  }

  // Authentication: healthy if this request carried a verified session
  metrics.push({
    service: "Authentication",
    status: "healthy",
    uptime: "n/a",
    lastChecked: now,
    latency: null,
  });

  return NextResponse.json({ metrics });
}
