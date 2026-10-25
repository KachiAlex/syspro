export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createPosSale, listPosSales, posDailySummary, getPosSale } from "@/lib/pos/sales";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

/**
 * Tenant discount cap: settings.pos.discountCapPct wins, then
 * settings.approvals.posDiscountCapPct. undefined = uncapped (legacy).
 */
async function posDiscountCap(tenantSlug: string): Promise<number | null> {
  const { sql } = await import("@/lib/sql-client");
  const [row] = await sql`select settings from tenants where slug = ${tenantSlug}` as any[];
  const cap = (row as any)?.settings?.pos?.discountCapPct
    ?? (row as any)?.settings?.approvals?.posDiscountCapPct;
  return cap === undefined || cap === null ? null : Number(cap);
}

/** Is this user allowed to override the POS discount cap? Delegates to the
 *  shared engine check — managers, department heads, executives, and
 *  configured company officers. */
async function posOverrideAuthorized(tenantSlug: string, userId: string): Promise<boolean> {
  const { canOverride } = await import("@/lib/finance/approvals");
  return canOverride(tenantSlug, userId);
}

/**
 * Enforce the discount cap. Order-level discount.pct, per-line discountPct,
 * or the computed amount share of the bill can each breach it; a breach
 * requires discount.overrideBy naming an authorized manager.
 */
async function checkDiscountCap(
  tenantSlug: string,
  data: z.infer<typeof saleSchema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cap = await posDiscountCap(tenantSlug);
  if (cap == null) return { ok: true };

  const orderPct = Number(data.discount?.pct ?? 0);
  const overByPct = orderPct > cap || data.items.some((i) => Number(i.discountPct ?? 0) > cap);

  // Amount-based share — best effort when line unit prices are known.
  const gross = data.items.reduce((s, i) => s + i.quantity * (i.unitPrice ?? 0), 0);
  let overByAmount = false;
  if (gross > 0) {
    const discountTotal =
      (data.discount?.amount ?? 0) +
      gross * (orderPct / 100) +
      data.items.reduce(
        (s, i) => s + (i.discountAmount ?? 0) + (i.unitPrice ? i.quantity * i.unitPrice * (i.discountPct ?? 0) / 100 : 0),
        0
      );
    overByAmount = (discountTotal / gross) * 100 > cap + 0.0001;
  }

  if (!overByPct && !overByAmount) return { ok: true };

  const overrideBy = data.discount?.overrideBy;
  if (!overrideBy) {
    return { ok: false, error: `Discount exceeds the ${cap}% cap — a manager override is required (discount.overrideBy)` };
  }
  if (!(await posOverrideAuthorized(tenantSlug, overrideBy))) {
    return { ok: false, error: "The override user is not authorized to approve discounts above the cap" };
  }
  try {
    const { emitEvent } = await import("@/lib/notify");
    void emitEvent({
      tenantSlug,
      eventType: "pos.discount_override",
      sourceModule: "pos",
      sourceRecordId: data.localInvoiceNo ?? data.registerId ?? "pos-sale",
      actorId: overrideBy,
      payload: { capPct: cap, orderPct, overrideBy, reason: data.discount?.reason },
    });
  } catch (err) {
    console.error("Failed to emit pos.discount_override:", err);
  }
  return { ok: true };
}

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
    /** Manager userId authorizing an above-cap discount at the till. */
    overrideBy: z.string().optional(),
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
    // Discount policy: above the tenant cap (settings.pos.discountCapPct, or
    // settings.approvals.posDiscountCapPct) a manager override is required —
    // validated server-side against admin/employee/officer authority.
    const capCheck = await checkDiscountCap(context.tenantSlug, parsed.data);
    if (!capCheck.ok) {
      return NextResponse.json({ error: capCheck.error }, { status: 403 });
    }

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
