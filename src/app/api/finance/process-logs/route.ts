export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { listProcessRuns } from "@/lib/finance/process-log";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;
  const sp = request.nextUrl.searchParams;
  const tenantSlug = sp.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
  }
  return NextResponse.json({
    success: true,
    data: await listProcessRuns({
      tenantSlug,
      process: sp.get("process") ?? undefined,
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    }),
  });
}
