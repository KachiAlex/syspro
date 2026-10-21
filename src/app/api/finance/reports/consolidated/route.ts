export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { consolidatedTrialBalance, setConsolidationGroup } from "@/lib/finance/consolidation";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "read");
  const { searchParams } = new URL(request.url);
  try {
    const tb = await consolidatedTrialBalance(context.tenantSlug, {
      asOf: searchParams.get("asOf") ?? undefined,
    });
    return NextResponse.json(tb);
  } catch (err: any) {
    const status = /no consolidation_group/.test(err.message) ? 422 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

/** Assign this tenant to a consolidation group (admin-only). */
export async function POST(request: NextRequest) {
  const gate = await requireModuleAccess(request, "admin", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const body = await request.json().catch(() => ({}));
  const group = body.group ?? null;
  if (group !== null && typeof group !== "string") {
    return NextResponse.json({ error: "group must be a string or null" }, { status: 400 });
  }
  await setConsolidationGroup(context.tenantSlug, group);
  return NextResponse.json({ ok: true, group });
}
