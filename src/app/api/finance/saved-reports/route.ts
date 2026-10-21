export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { listSavedReports, createSavedReport } from "@/lib/finance/registers";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantSlug = searchParams.get("tenantSlug");
    if (!tenantSlug) {
      return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
    }
    const reportKey = searchParams.get("reportKey") ?? undefined;
    const reports = await listSavedReports(tenantSlug, reportKey);
    return NextResponse.json({ success: true, data: reports });
  } catch (error) {
    console.error("Error listing saved reports:", error);
    return NextResponse.json(
      { success: false, error: (error as any)?.message ?? "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "write");
  if (!_scope.ok) return _scope.response;

  try {
    const body = await request.json();
    const { tenantSlug, name, reportKey, config, isShared } = body ?? {};
    if (!tenantSlug || !name?.trim() || !reportKey) {
      return NextResponse.json(
        { success: false, error: "tenantSlug, name and reportKey are required" },
        { status: 400 },
      );
    }
    const report = await createSavedReport({
      tenantSlug,
      name,
      reportKey,
      config: config ?? {},
      createdBy: (_scope as any).user?.id ? String((_scope as any).user.id) : undefined,
      isShared: Boolean(isShared),
    });
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error("Error creating saved report:", error);
    return NextResponse.json(
      { success: false, error: (error as any)?.message ?? "Internal server error" },
      { status: 500 },
    );
  }
}
