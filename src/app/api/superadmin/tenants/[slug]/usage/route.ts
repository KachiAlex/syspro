export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/api-auth";
import { getTenantUsageSummary } from "@/lib/tenant-usage";

/**
 * GET /api/superadmin/tenants/[slug]/usage
 * Superadmin view of a tenant's metering: seats, API-call counters,
 * per-module record counts, and AI-agent usage/quota.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) return auth.response;

  const { slug } = await params;
  try {
    const usage = await getTenantUsageSummary(slug);
    return NextResponse.json({ success: true, data: usage });
  } catch (error) {
    console.error("Tenant usage summary error:", error);
    return NextResponse.json({ error: "Failed to load tenant usage" }, { status: 500 });
  }
}
