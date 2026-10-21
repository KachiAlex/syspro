export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { buildEscPosReceipt, sendEReceipt } from "@/lib/pos/receipts";
import { getPosSale } from "@/lib/pos/sales";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

/** GET ?saleId= or ?receiptNo= [&format=escpos] — receipt data / printer payload. */
export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "sales", "read");
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  try {
    const sale = await getPosSale(context.tenantSlug, {
      id: url.searchParams.get("saleId") ?? undefined,
      receiptNo: url.searchParams.get("receiptNo") ?? undefined,
    });
    if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

    if (url.searchParams.get("format") === "escpos") {
      const payload = buildEscPosReceipt({
        receiptNo: sale.receiptNo,
        createdAt: sale.createdAt,
        items: sale.items ?? [],
        tenders: sale.tenders ?? [{ method: sale.paymentMethod, amount: sale.totalAmount }],
        total: sale.totalAmount, tax: sale.taxAmount,
        discount: sale.discountAmount, change: sale.changeDue ?? 0,
        customerName: sale.customerName,
      });
      return new NextResponse(payload, {
        headers: { "Content-Type": "application/octet-stream" },
      });
    }
    return NextResponse.json({ sale });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const sendSchema = z.object({
  saleId: z.string().optional(),
  receiptNo: z.string().optional(),
  email: z.string().email().optional(),
  tenantName: z.string().optional(),
});

/** POST — send an e-receipt by email. */
export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const gate = await requireModuleAccess(request, "sales", "write");
  if (!gate.ok) return gate.response;
  try {
    const parsed = sendSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
    }
    const d = parsed.data;
    if (!d.saleId && !d.receiptNo) {
      return NextResponse.json({ error: "saleId or receiptNo is required" }, { status: 400 });
    }
    const result = await sendEReceipt({ tenantSlug: context.tenantSlug, ...d });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
