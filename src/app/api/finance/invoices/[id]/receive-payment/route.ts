import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { receiveInvoicePayment, getInvoicePayments } from "@/lib/finance/db";

const receivePaymentSchema = z.object({
  tenantSlug: z.string().min(1),
  invoiceId: z.string().min(1),
  amount: z.coerce.number().positive(),
  method: z.enum(["bank_transfer", "check", "cash", "pos", "mobile_money", "wire", "paystack", "flutterwave", "stripe"]),
  reference: z.string().optional(),
  paymentDate: z.string().min(1),
  gateway: z.string().optional(),
  gatewayReference: z.string().optional(),
  confirmationDetails: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = receivePaymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await receiveInvoicePayment(parsed.data);

    return NextResponse.json({
      success: true,
      data: {
        payment: result.payment,
        invoice: result.invoice,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("AR payment receipt failed:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantSlug = searchParams.get("tenantSlug");
    const invoiceId = searchParams.get("invoiceId");

    if (!tenantSlug || !invoiceId) {
      return NextResponse.json(
        { success: false, error: "tenantSlug and invoiceId are required" },
        { status: 400 }
      );
    }

    const payments = await getInvoicePayments(invoiceId, tenantSlug);

    return NextResponse.json({ success: true, data: payments });
  } catch (error) {
    console.error("Error fetching invoice payments:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
