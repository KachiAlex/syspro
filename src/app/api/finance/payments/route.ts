import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPayment, listPayments } from "@/lib/finance/db";

const paymentCreateSchema = z.object({
  tenantSlug: z.string().min(1),
  customerId: z.string().optional(),
  invoiceId: z.string().optional(),
  reference: z.string().min(1),
  grossAmount: z.coerce.number().min(0),
  fees: z.coerce.number().min(0),
  method: z.enum(["bank_transfer", "check", "cash", "pos", "mobile_money", "wire", "paystack", "flutterwave", "stripe"]),
  gatewayReference: z.string().optional(),
  paymentDate: z.string(),
  confirmationDetails: z.string(),
});

const paymentListSchema = z.object({
  tenantSlug: z.string().min(1),
  status: z.enum(["pending", "successful", "failed", "reversed"]).optional(),
  method: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = paymentListSchema.safeParse({
    tenantSlug: url.searchParams.get("tenantSlug") ?? undefined,
    status: (url.searchParams.get("status") ?? undefined) as any,
    method: url.searchParams.get("method") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const payments = await listPayments({
      tenantSlug: parsed.data.tenantSlug,
      status: parsed.data.status,
      method: parsed.data.method,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    return NextResponse.json({ payments });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Payments list failed:", errorMessage, error);
    return NextResponse.json({ error: "Failed to load payments", details: errorMessage }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = paymentCreateSchema.safeParse(body);
  if (!parsed.success) {
    console.log("Validation errors:", parsed.error.flatten());
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const payment = await createPayment({
      tenantSlug: parsed.data.tenantSlug,
      customerId: parsed.data.customerId,
      invoiceId: parsed.data.invoiceId,
      reference: parsed.data.reference,
      grossAmount: parsed.data.grossAmount,
      fees: parsed.data.fees,
      method: parsed.data.method,
      gateway: parsed.data.method === "paystack" ? "paystack" : 
               parsed.data.method === "flutterwave" ? "flutterwave" :
               parsed.data.method === "stripe" ? "stripe" : "manual",
      gatewayReference: parsed.data.gatewayReference,
      paymentDate: parsed.data.paymentDate,
      confirmationDetails: parsed.data.confirmationDetails,
      status: "successful",
      linkedInvoices: parsed.data.invoiceId ? [parsed.data.invoiceId] : undefined,
    });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Payment creation failed:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to create payment", details: errorMessage },
      { status: 500 }
    );
  }
}
// Force rebuild
