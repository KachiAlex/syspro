import { NextRequest, NextResponse } from "next/server";
import { getUsageStats, getRecentLogs, checkQuota } from "@/lib/ai/usage-log";
import { resolveEmployeeSession } from "@/lib/hr/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

// ─── Auth ───

function authenticate(request: NextRequest): { tenantSlug: string } | null {
  const apiKey = request.headers.get("x-api-key") || request.headers.get("authorization")?.replace("Bearer ", "");
  if (apiKey && apiKey === process.env.SYSPRO_AI_API_KEY) {
    const tenantSlug = request.headers.get("x-tenant-slug");
    if (tenantSlug) return { tenantSlug };
  }

  const session = resolveEmployeeSession(request);
  if (session) return { tenantSlug: session.tenantSlug };

  return null;
}

// ─── GET: Usage Stats / Quota / Recent Logs ───

export async function GET(request: NextRequest) {
  const auth = authenticate(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const view = request.nextUrl.searchParams.get("view") || "stats";
  const tenantSlug = auth.tenantSlug;

  switch (view) {
    case "quota": {
      const quota = await checkQuota(tenantSlug);
      return NextResponse.json(quota);
    }

    case "logs": {
      const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
      const logs = await getRecentLogs(tenantSlug, Math.min(limit, 200));
      return NextResponse.json({ logs });
    }

    case "stats":
    default: {
      const stats = await getUsageStats(tenantSlug);
      const quota = await checkQuota(tenantSlug);
      return NextResponse.json({ stats, quota });
    }
  }
}
