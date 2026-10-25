export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { listPosReturns } from "@/lib/pos/returns";
import { getPosSale } from "@/lib/pos/sales";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess, requireDocAccess } from "@/lib/api-auth";

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
  overrideBy: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const gate = await requireDocAccess(request, "pos_sale", "refund", "sales", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success || (!parsed.data.saleId && !parsed.data.receiptNo)) {
    return NextResponse.json({ error: "saleId or receiptNo plus at least one item are required" }, { status: 400 });
  }
  try {
    // Refunds above the tenant cap (settings.pos.refundCap) need a named
    // manager override — same real-time control as discount overrides.
    // Estimate the refund from the sale's allocated net so the cap check
    // happens before anything commits.
    let estimatedRefund = 0;
    const sale = await getPosSale(context.tenantSlug, {
      id: parsed.data.saleId,
      receiptNo: parsed.data.receiptNo,
    }).catch(() => null);
    if (sale?.items) {
      for (const item of parsed.data.items) {
        const line = (sale.items as any[]).find((l) => l.sku === item.sku);
        if (line) {
          const perUnit = Number(line.allocatedNet ?? line.taxableAmount ?? line.amount ?? 0) / Math.max(1, Number(line.qty));
          estimatedRefund += perUnit * Number(item.quantity);
        }
      }
    }
    const { gateOrRun } = await import("@/lib/finance/gated-actions");
    const outcome = await gateOrRun(
      context.tenantSlug,
      "pos_refund",
      { ...parsed.data, estimatedRefund, createdBy: context.userId ?? undefined },
      { requestedBy: context.userId ?? "unknown" }
    );
    if (outcome.status === "denied") {
      return NextResponse.json({ error: outcome.error }, { status: 403 });
    }
    if (outcome.status === "pending") {
      return NextResponse.json({ pendingApproval: true, approvalId: outcome.approvalId }, { status: 202 });
    }
    const result = outcome.result;
    if (result && "error" in result) {
      return NextResponse.json(result, { status: /not found/i.test(result.error) ? 404 : 422 });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 422 });
  }
}
