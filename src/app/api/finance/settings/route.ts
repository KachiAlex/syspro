export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFinanceSettings, updateFinanceSettings } from "@/lib/finance/settings";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;
  const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
  }
  const data = await getFinanceSettings(tenantSlug);
  return NextResponse.json({ success: true, data });
}

const updateSchema = z.object({
  tenantSlug: z.string().min(1),
  accountsFrozenUntil: z.string().nullable().optional(),
  creditCheckMode: z.enum(["block", "warn", "off"]).optional(),
  autoExchangeRevaluation: z.boolean().optional(),
  defaultPaymentTermsDays: z.coerce.number().int().min(0).max(3650).optional(),
});

export async function PUT(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const { tenantSlug, ...updates } = parsed.data;
    const data = await updateFinanceSettings(tenantSlug, updates);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
