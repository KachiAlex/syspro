export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { getOnboardingState, seedChartOfAccounts } from "@/lib/tenant/onboarding";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const gate = await requireModuleAccess(request, "admin", "write");
  if (!gate.ok) return gate.response;
  try {
    const result = await seedChartOfAccounts(context.tenantSlug);
    const state = await getOnboardingState(context.tenantSlug);
    return NextResponse.json({ ...result, state });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
