import { NextRequest, NextResponse } from "next/server";

import { financeInvoiceUpdateSchema } from "@/lib/finance/types";
import { updateFinanceInvoice } from "@/lib/finance/db";

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
    console.error("Finance invoice update failed", error);
    return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 });
  }
}
