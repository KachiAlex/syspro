export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { listPriceLists, upsertPriceList } from "@/lib/pos/price-lists";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const gate = await requireModuleAccess(request, "sales", "read");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "read");
  return NextResponse.json({ priceLists: await listPriceLists(context.tenantSlug) });
}

const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(120),
  isActive: z.boolean().optional(),
  items: z.array(z.object({ sku: z.string().min(1), price: z.coerce.number().min(0) })).default([]),
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
  const result = await upsertPriceList(context.tenantSlug, parsed.data);
  return NextResponse.json(result, { status: 201 });
}
