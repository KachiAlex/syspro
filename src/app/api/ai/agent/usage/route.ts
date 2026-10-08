export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getUsageStats, getRecentLogs, checkQuota } from "@/lib/ai/usage-log";
import { resolveEmployeeSession } from "@/lib/hr/auth";
import { isTenantSuspended } from "@/lib/api-auth";
import { APIKeyService } from "@/lib/tenant-admin/service";
import { asTenantSlug } from "@/lib/tenant-admin/utils";

export const runtime = "nodejs";
export const maxDuration = 30;

// ─── Auth ───

async function authenticate(request: NextRequest): Promise<{ tenantSlug: string } | NextResponse | null> {
  const apiKey = request.headers.get("x-api-key") || request.headers.get("authorization")?.replace("Bearer ", "");
  const headerTenant = request.headers.get("x-tenant-slug");
  if (apiKey && headerTenant) {
    const isPlatform = apiKey === process.env.SYSPRO_AI_API_KEY;
    const tenantKey = isPlatform ? null : await new APIKeyService().authenticate(asTenantSlug(headerTenant), apiKey).catch(() => null);
    if (isPlatform || tenantKey) {
      if (await isTenantSuspended(headerTenant)) {
        return NextResponse.json({ error: "Tenant is suspended" }, { status: 403 });
      }
      return { tenantSlug: headerTenant };
    }
  }

  const session = resolveEmployeeSession(request);
  if (session && (await isTenantSuspended(session.tenantSlug))) {
    return NextResponse.json({ error: "Tenant is suspended" }, { status: 403 });
  }
  if (session) return { tenantSlug: session.tenantSlug };

  return null;
}

// ─── GET: Usage Stats / Quota / Recent Logs ───

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth instanceof NextResponse) return auth;
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
