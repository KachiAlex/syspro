export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { budgetVsActualReport } from "@/lib/finance/budget-report";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  try {
    const report = await budgetVsActualReport({
      tenantSlug: context.tenantSlug,
      fiscalYear: url.searchParams.get("fiscalYear")
        ? Number(url.searchParams.get("fiscalYear"))
        : undefined,
      budgetId: url.searchParams.get("budgetId") ?? undefined,
    });
    return NextResponse.json({ report });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
