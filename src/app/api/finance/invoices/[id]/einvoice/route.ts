export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { generateEInvoice } from "@/lib/finance/gateway";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  const { id } = await params;
  try {
    const doc = await generateEInvoice(context.tenantSlug, id);
    return NextResponse.json({ einvoice: doc });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
}
