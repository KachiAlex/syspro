export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { sql as SQL } from "@/lib/sql-client";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess, requireDocAccess } from "@/lib/api-auth";
import {
  createPurchaseReceipt,
  listPurchaseReceipts,
  getPurchaseReceipt,
} from "@/lib/finance/purchase-receipts";
import { gateOrRun } from "@/lib/finance/gated-actions";

const itemSchema = z.object({
  poItemId: z.string().optional(),
  productId: z.string().optional(),
  sku: z.string().optional(),
  description: z.string().optional(),
  orderedQty: z.number().optional(),
  receivedQty: z.number().positive(),
  rejectedQty: z.number().optional(),
  unitPrice: z.number().optional(),
  uom: z.string().optional(),
});

const postSchema = z.object({
  purchaseOrderId: z.string().optional(),
  vendorId: z.string().optional(),
  vendorName: z.string().optional(),
  warehouseId: z.string().optional(),
  location: z.string().optional(),
  receivedDate: z.string(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  const sp = request.nextUrl.searchParams;
  if (sp.get("id")) {
    const receipt = await getPurchaseReceipt(context.tenantSlug, sp.get("id")!);
    if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ receipt });
  }
  const receipts = await listPurchaseReceipts(context.tenantSlug, {
    status: sp.get("status") ?? undefined,
    purchaseOrderId: sp.get("purchaseOrderId") ?? undefined,
  });
  return NextResponse.json({ receipts });
}

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const gate = await requireDocAccess(request, "goods_receipt", "submit", "finance", "write");
  if (!gate.ok) return gate.response;
  const parsed = postSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 }
    );
  }
  const receipt = await createPurchaseReceipt({
    tenantSlug: context.tenantSlug,
    ...parsed.data,
    createdBy: context.userId ?? "unknown",
  });

  const gated = await gateOrRun(context.tenantSlug, "purchase_receipt", {
    receiptId: receipt.id,
    receiptNumber: receipt.receiptNumber,
    totalAmount: receipt.totalAmount,
    purchaseOrderId: parsed.data.purchaseOrderId,
    vendorId: parsed.data.vendorId,
  }, { requestedBy: context.userId ?? "unknown" });

  if (gated.status === "pending") {
    const approvalId = (gated as any).approvalId as string | undefined;
    if (approvalId) {
      await SQL`update purchase_receipts set approval_id = ${approvalId} where id = ${receipt.id}`;
    }
    return NextResponse.json({
      receipt: { ...receipt, status: "pending" },
      approvalId,
      pendingApproval: true,
    }, { status: 202 });
  }
  return NextResponse.json({ receipt: { ...receipt, status: "received" } }, { status: 201 });
}
