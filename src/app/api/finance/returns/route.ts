export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSalesReturn, createPurchaseReturn, listReturns } from "@/lib/finance/returns";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

const itemSchema = z.object({
  description: z.string().min(1),
  sku: z.string().optional(),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).optional(),
});

const createSchema = z.object({
  direction: z.enum(["sales", "purchase"]),
  invoiceId: z.string().optional(),
  billId: z.string().optional(),
  items: z.array(itemSchema).min(1),
  reason: z.string().optional(),
  restock: z.boolean().optional(),
  destock: z.boolean().optional(),
  warehouseId: z.string().optional(),
  creditAccountCode: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "read");
  const { searchParams } = new URL(request.url);
  const returns = await listReturns(context.tenantSlug, {
    direction: searchParams.get("direction") as "sales" | "purchase" | null ?? undefined,
    sourceDocumentId: searchParams.get("sourceDocumentId") ?? undefined,
    limit: parseInt(searchParams.get("limit") ?? "100"),
  });
  return NextResponse.json({ returns });
}

export async function POST(request: NextRequest) {
  const gate = await requireModuleAccess(request, "finance", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  try {
    if (d.direction === "sales") {
      if (!d.invoiceId) return NextResponse.json({ error: "invoiceId is required for sales returns" }, { status: 400 });
      const ret = await createSalesReturn(context.tenantSlug, {
        invoiceId: d.invoiceId,
        items: d.items,
        reason: d.reason,
        restock: d.restock,
        warehouseId: d.warehouseId,
      });
      return NextResponse.json({ return: ret }, { status: 201 });
    }
    if (!d.billId) return NextResponse.json({ error: "billId is required for purchase returns" }, { status: 400 });
    const ret = await createPurchaseReturn(context.tenantSlug, {
      billId: d.billId,
      items: d.items,
      reason: d.reason,
      destock: d.destock,
      warehouseId: d.warehouseId,
      creditAccountCode: d.creditAccountCode,
    });
    return NextResponse.json({ return: ret }, { status: 201 });
  } catch (err: any) {
    const status = /not found/i.test(err.message) ? 404 : 422;
    return NextResponse.json({ error: err.message }, { status });
  }
}
