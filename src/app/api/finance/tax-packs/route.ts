export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listTaxPacks, applyTaxPack, listAppliedPacks } from "@/lib/finance/tax-packs";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;
  const sp = request.nextUrl.searchParams;
  if (sp.get("view") === "applied") {
    const tenantSlug = sp.get("tenantSlug");
    if (!tenantSlug) {
      return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: await listAppliedPacks(tenantSlug) });
  }
  return NextResponse.json({ success: true, data: listTaxPacks() });
}

const schema = z.object({
  tenantSlug: z.string().min(1), packCode: z.string().min(2).max(3),
});

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const data = await applyTaxPack({ ...parsed.data, userId: (_scope as any).user?.id });
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status ?? 500 });
  }
}
