export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { holdSale, listHeldSales, deleteHeldSale } from "@/lib/pos/held";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const gate = await requireModuleAccess(request, "sales", "read");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "read");
  const registerId = new URL(request.url).searchParams.get("registerId");
  return NextResponse.json({ held: await listHeldSales(context.tenantSlug, registerId) });
}

const schema = z.object({
  label: z.string().max(120).optional(),
  cart: z.unknown(),
  customerCode: z.string().optional(),
  registerId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const gate = await requireModuleAccess(request, "sales", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success || parsed.data.cart == null) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }
  const result = await holdSale(context.tenantSlug, {
    cart: parsed.data.cart,
    label: parsed.data.label,
    customerCode: parsed.data.customerCode,
    registerId: parsed.data.registerId,
    createdBy: context.userId ?? undefined,
  });
  return NextResponse.json(result, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const gate = await requireModuleAccess(request, "sales", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const deleted = await deleteHeldSale(context.tenantSlug, id);
  if (!deleted) return NextResponse.json({ error: "Held sale not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
