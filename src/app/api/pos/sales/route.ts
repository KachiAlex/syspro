export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createPosSale, listPosSales, posDailySummary, getPosSale } from "@/lib/pos/sales";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

const itemSchema = z.object({
  sku: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().min(0).optional(),
  discountPct: z.coerce.number().min(0).max(100).optional(),
  discountAmount: z.coerce.number().min(0).optional(),
  taxExempt: z.boolean().optional(),
  serialNos: z.array(z.string()).optional(),
  lotNo: z.string().optional(),
});

const tenderSchema = z.object({
  method: z.enum(["cash", "pos", "bank_transfer", "mobile_money", "store_credit"]),
  amount: z.coerce.number().positive(),
  tendered: z.coerce.number().min(0).optional(),
  accountCode: z.string().optional(),
  reference: z.string().max(100).optional(),
});

const saleSchema = z.object({
  items: z.array(itemSchema).min(1),
  tenders: z.array(tenderSchema).min(1).optional(),
  paymentMethod: z.enum(["cash", "pos", "bank_transfer", "mobile_money"]).optional(),
  amountTendered: z.coerce.number().min(0).optional(),
  customerCode: z.string().optional(),
  customerName: z.string().optional(),
  warehouseId: z.string().optional(),
  registerId: z.string().optional(),
  branchId: z.string().optional(),
  localInvoiceNo: z.string().max(80).optional(),
  priceListId: z.string().optional(),
  discount: z.object({
    amount: z.coerce.number().min(0).optional(),
    pct: z.coerce.number().min(0).max(100).optional(),
    reason: z.string().min(1),
  }).optional(),
  loyaltyRedeemPoints: z.coerce.number().min(0).optional(),
  idempotencyKey: z.string().max(80).optional(),
  paymentAccountCode: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export async function GET(request: NextRequest) {
  const gate = await requireModuleAccess(request, "sales", "read");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "read");
  const { searchParams } = new URL(request.url);
  if (searchParams.get("summary") === "daily") {
    const summary = await posDailySummary(context.tenantSlug, searchParams.get("date") ?? undefined);
    return NextResponse.json(summary);
  }
  const id = searchParams.get("id") ?? undefined;
  const receiptNo = searchParams.get("receipt") ?? undefined;
  if (id || receiptNo) {
    const sale = await getPosSale(context.tenantSlug, { id, receiptNo });
    if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    return NextResponse.json({ sale });
  }
  const sales = await listPosSales(context.tenantSlug, {
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    shiftId: searchParams.get("shiftId") ?? undefined,
    registerId: searchParams.get("registerId") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    limit: Number(searchParams.get("limit") ?? 100) || 100,
  });
  return NextResponse.json({ sales });
}

export async function POST(request: NextRequest) {
  const gate = await requireModuleAccess(request, "sales", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  const parsed = saleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await createPosSale(context.tenantSlug, {
      ...parsed.data,
      createdBy: context.userId ?? undefined,
    });
    return NextResponse.json(result, { status: result.alreadyExisted ? 200 : 201 });
  } catch (err: any) {
    const message = err.message ?? String(err);
    const status = /Unknown SKU|requires|No price|Insufficient|not found|do not cover|cannot|No open shift|already in progress|not enabled/i.test(message) ? 422 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
