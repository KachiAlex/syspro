export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { deleteDepartment } from "@/lib/hr/db";
import { requireModuleAccess } from "@/lib/api-auth";

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const scope = await requireModuleAccess(request, "people", "write");
  if (!scope.ok) return scope.response;

  const tenantSlug =
    scope.user.tenantSlug ?? request.nextUrl.searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  try {
    const result = await deleteDepartment(params.id, tenantSlug);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Department delete failed", error);
    return NextResponse.json({ error: "Failed to delete department" }, { status: 500 });
  }
}
