export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { getPosConfig } from "@/lib/pos/config";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const gate = await requireModuleAccess(request, "sales", "read");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "read");
  return NextResponse.json(await getPosConfig(context.tenantSlug));
}
