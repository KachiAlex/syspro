export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { loyaltyBalance, adjustLoyalty } from "@/lib/pos/loyalty";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const gate = await requireModuleAccess(request, "sales", "read");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "read");
  const customerCode = new URL(request.url).searchParams.get("customerCode");
  if (!customerCode) return NextResponse.json({ error: "customerCode is required" }, { status: 400 });
  return NextResponse.json(await loyaltyBalance(context.tenantSlug, customerCode));
}

const schema = z.object({
  customerCode: z.string().min(1),
  points: z.coerce.number(),
  note: z.string().max(200).optional(),
});

export async function POST(request: NextRequest) {
  const gate = await requireModuleAccess(request, "sales", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  return NextResponse.json(await adjustLoyalty(context.tenantSlug, parsed.data));
}
