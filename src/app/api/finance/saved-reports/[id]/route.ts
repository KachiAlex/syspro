export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { updateSavedReport, deleteSavedReport } from "@/lib/finance/registers";
import { requireModuleAccess } from "@/lib/api-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const _scope = await requireModuleAccess(request, "finance", "write");
  if (!_scope.ok) return _scope.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const { tenantSlug, name, config, isShared } = body ?? {};
    if (!tenantSlug) {
      return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
    }
    const report = await updateSavedReport(id, tenantSlug, { name, config, isShared });
    if (!report) {
      return NextResponse.json({ success: false, error: "Saved report not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error("Error updating saved report:", error);
    return NextResponse.json(
      { success: false, error: (error as any)?.message ?? "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const _scope = await requireModuleAccess(request, "finance", "write");
  if (!_scope.ok) return _scope.response;

  try {
    const { id } = await params;
    const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");
    if (!tenantSlug) {
      return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
    }
    const deleted = await deleteSavedReport(id, tenantSlug);
    if (!deleted) {
      return NextResponse.json({ success: false, error: "Saved report not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting saved report:", error);
    return NextResponse.json(
      { success: false, error: (error as any)?.message ?? "Internal server error" },
      { status: 500 },
    );
  }
}
