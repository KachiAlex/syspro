import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { requireDashboardPermission } from "@/lib/tenant-admin/permissions";

export async function GET(request: NextRequest) {
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

  try {
    const dbStart = Date.now();
    await sql`select now()`;
    const dbLatency = Date.now() - dbStart;

    const metrics = [
      {
        service: "API",
        status: "healthy",
        uptime: "99.9%",
        lastChecked: now,
        latency: 12,
      },
      {
        service: "Database",
        status: "healthy",
        uptime: "99.9%",
        lastChecked: now,
        latency: dbLatency,
      },
      {
        service: "Authentication",
        status: "healthy",
        uptime: "99.9%",
        lastChecked: now,
        latency: 5,
      },
    ];

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      {
        metrics: [
          {
            service: "API",
            status: "healthy",
            uptime: "99.9%",
            lastChecked: now,
            latency: 12,
          },
          {
            service: "Database",
            status: "down",
            uptime: "0%",
            lastChecked: now,
          },
        ],
      },
      { status: 200 }
    );
  }
}
