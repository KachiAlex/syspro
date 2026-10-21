export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createPosReturn, listPosReturns } from "@/lib/pos/returns";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const gate = await requireModuleAccess(request, "sales", "read");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "read");
  const { searchParams } = new URL(request.url);
  return NextResponse.json({
    returns: await listPosReturns(context.tenantSlug, {
      saleId: searchParams.get("saleId") ?? undefined,
      limit: Number(searchParams.get("limit") ?? 100) || 100,
    }),
  });
}

const schema = z.object({
  saleId: z.string().optional(),
  receiptNo: z.string().optional(),
  items: z.array(z.object({
    sku: z.string().min(1),
    quantity: z.coerce.number().int().positive(),
    serialNos: z.array(z.string()).optional(),
    lotNo: z.string().optional(),
  })).min(1),
  refundMethod: z.enum(["cash", "pos", "bank_transfer", "mobile_money"]).default("cash"),
  restock: z.boolean().optional(),
  reason: z.string().max(300).optional(),
});

export async function POST(request: NextRequest) {
  const gate = await requireModuleAccess(request, "sales", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success || (!parsed.data.saleId && !parsed.data.receiptNo)) {
    return NextResponse.json({ error: "saleId or receiptNo plus at least one item are required" }, { status: 400 });
  }
  try {
    const result = await createPosReturn(context.tenantSlug, {
      ...parsed.data,
      createdBy: context.userId ?? undefined,
    });
    if ("error" in result) {
      return NextResponse.json(result, { status: /not found/i.test(result.error) ? 404 : 422 });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 422 });
  }
}
