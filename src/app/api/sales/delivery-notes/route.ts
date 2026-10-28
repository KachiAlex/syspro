export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { sql as SQL } from "@/lib/sql-client";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import {
  createDeliveryNote,
  listDeliveryNotes,
  getDeliveryNote,
} from "@/lib/sales/delivery-notes";
import { gateOrRun } from "@/lib/finance/gated-actions";

const postSchema = z.object({
  salesOrderId: z.string().optional(),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  warehouseId: z.string().optional(),
  deliveryDate: z.string(),
  driver: z.string().optional(),
  vehicle: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    soLineKey: z.string().optional(),
    productId: z.string().optional(),
    sku: z.string().optional(),
    description: z.string().optional(),
    deliveredQty: z.number().positive(),
    rejectedQty: z.number().optional(),
    unitPrice: z.number().optional(),
  })).min(1),
});

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "sales", "read");
  if (!gate.ok) return gate.response;
  const sp = request.nextUrl.searchParams;
  if (sp.get("id")) {
    const note = await getDeliveryNote(context.tenantSlug, sp.get("id")!);
    if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ note });
  }
  const notes = await listDeliveryNotes(context.tenantSlug, {
    status: sp.get("status") ?? undefined,
    salesOrderId: sp.get("salesOrderId") ?? undefined,
  });
  return NextResponse.json({ notes });
}

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const gate = await requireModuleAccess(request, "sales", "write");
  if (!gate.ok) return gate.response;
  const parsed = postSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 }
    );
  }
  const note = await createDeliveryNote({
    tenantSlug: context.tenantSlug,
    ...parsed.data,
    createdBy: context.userId ?? "unknown",
  });

  const gated = await gateOrRun(context.tenantSlug, "delivery_note", {
    noteId: note.id,
    noteNumber: note.noteNumber,
    totalAmount: note.totalAmount,
    salesOrderId: parsed.data.salesOrderId,
    customerId: parsed.data.customerId,
  }, { requestedBy: context.userId ?? "unknown" });

  if (gated.status === "pending") {
    const approvalId = (gated as any).approvalId as string | undefined;
    if (approvalId) {
      await SQL`update delivery_notes set approval_id = ${approvalId} where id = ${note.id}`;
    }
    return NextResponse.json({
      note: { ...note, status: "pending" },
      approvalId,
      pendingApproval: true,
    }, { status: 202 });
  }
  return NextResponse.json({ note: { ...note, status: "delivered" } }, { status: 201 });
}
