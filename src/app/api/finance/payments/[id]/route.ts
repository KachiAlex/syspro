import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updatePayment, deletePayment } from "@/lib/finance/db";

import { requireRecordTenant, requireModuleAccess } from "@/lib/api-auth";
const paymentUpdateSchema = z.object({
  status: z.enum(["pending", "successful", "failed", "reversed"]).optional(),
  settlementDate: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  linkedInvoices: z.array(z.string()).optional(),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const _scope = await requireModuleAccess(request, "finance", "write");
    if (!_scope.ok) return _scope.response;

  const params = await context.params;
  const _owned = await requireRecordTenant("finance_payments", params.id, _scope.user);
  if (!_owned.ok) return _owned.response;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = paymentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const payment = await updatePayment(params.id, parsed.data);
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }
    return NextResponse.json({ payment });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Payment update failed", errorMessage, error);
    return NextResponse.json({ error: "Failed to update payment", details: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const _scope = await requireModuleAccess(request, "finance", "write");
    if (!_scope.ok) return _scope.response;

  const params = await context.params;
  const _owned = await requireRecordTenant("finance_payments", params.id, _scope.user);
  if (!_owned.ok) return _owned.response;

  try {
    const deleted = await deletePayment(params.id);
    if (!deleted) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Payment deleted" }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Payment delete failed", errorMessage, error);
    return NextResponse.json({ error: "Failed to delete payment", details: errorMessage }, { status: 500 });
  }
}
