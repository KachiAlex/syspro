export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { customerStatement } from "@/lib/finance/credit-control";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  const customerCode = url.searchParams.get("customerCode");
  if (!customerCode)
    return NextResponse.json({ error: "customerCode required" }, { status: 400 });
  try {
    const statement = await customerStatement({
      tenantSlug: context.tenantSlug,
      customerCode,
      startDate: url.searchParams.get("startDate") ?? undefined,
      endDate: url.searchParams.get("endDate") ?? undefined,
    });
    return NextResponse.json({ statement });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
