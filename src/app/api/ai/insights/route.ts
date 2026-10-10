export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/ai/agent";
import { authenticateAgent } from "@/lib/ai/agent-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/ai/insights
 * Runs the proactive-insights capability on demand and returns the findings.
 * Used by the tenant-admin dashboard AI Insights card.
 * Query params: ?categories=appraisals,reports (optional filter)
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;
  if (!auth) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const categoriesParam = request.nextUrl.searchParams.get("categories");
  const categories = categoriesParam
    ? categoriesParam.split(",").map((c) => c.trim()).filter(Boolean)
    : undefined;

  const result = await runAgent({
    capability: "proactive_insights",
    payload: categories?.length ? { categories } : {},
    tenantSlug: auth.tenantSlug,
  });

  if (!result.success) {
    return NextResponse.json({ error: (result as any).error || "Insights failed" }, { status: 500 });
  }
  return NextResponse.json(result.result);
}
