import { NextRequest, NextResponse } from "next/server";

import { financeInvoiceUpdateSchema } from "@/lib/finance/types";
import { updateFinanceInvoice, deleteFinanceInvoice } from "@/lib/finance/db";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = financeInvoiceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const invoice = await updateFinanceInvoice(params.id, parsed.data);
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    return NextResponse.json({ invoice });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Finance invoice update failed", errorMessage, error);
    return NextResponse.json({ error: "Failed to update invoice", details: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;

  try {
    const deleted = await deleteFinanceInvoice(params.id);
    if (!deleted) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Invoice deleted" }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Finance invoice delete failed", errorMessage, error);
    return NextResponse.json({ error: "Failed to delete invoice", details: errorMessage }, { status: 500 });
  }
}
