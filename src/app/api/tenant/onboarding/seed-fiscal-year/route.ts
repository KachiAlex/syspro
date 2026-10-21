export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getOnboardingState, seedFiscalYear } from "@/lib/tenant/onboarding";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

const schema = z.object({
  fiscalYear: z.number().int().min(2000).max(2100),
});

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const gate = await requireModuleAccess(request, "admin", "write");
  if (!gate.ok) return gate.response;
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "fiscalYear (2000–2100) is required", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const result = await seedFiscalYear(context.tenantSlug, parsed.data.fiscalYear);
    const state = await getOnboardingState(context.tenantSlug);
    return NextResponse.json({ ...result, state });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
