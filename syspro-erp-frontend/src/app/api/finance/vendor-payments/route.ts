import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  listVendorPayments,
  getVendorPayment,
  createVendorPayment,
  updateVendorPayment,
  deleteVendorPayment,
  applyPaymentToBill,
  getVendorPaymentSummary,
} from "@/lib/finance/vendor-payments";

const paymentListSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  vendorId: z.string().uuid().optional(),
  status: z.enum(["draft", "posted", "reconciled", "cancelled"]).optional(),
  method: z.enum(["bank_transfer", "cash", "corporate_card", "other"]).optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
  offset: z.coerce.number().min(0).optional(),
});

const paymentCreateSchema = z.object({
  tenantSlug: z.string().min(1),
  vendorId: z.string().uuid(),
  method: z.enum(["bank_transfer", "cash", "corporate_card", "other"]),
  amount: z.number().positive(),
  paymentDate: z.string().datetime(),
  currency: z.string().default("NGN"),
  bankDetails: z.record(z.any()).optional(),
  applications: z.array(z.object({
    billId: z.string().uuid(),
    appliedAmount: z.number().positive(),
  })).optional(),
  metadata: z.record(z.any()).optional(),
});

const paymentUpdateSchema = z.object({
  status: z.enum(["draft", "posted", "reconciled", "cancelled"]).optional(),
  metadata: z.record(z.any()).optional(),
});

const applyPaymentSchema = z.object({
  billId: z.string().uuid(),
  appliedAmount: z.number().positive(),
});

export async function GET(request: NextRequest) {
  console.log('API: GET /api/finance/vendor-payments called');
  
  try {
    const url = new URL(request.url);
    
    // Get single payment by ID
    if (url.searchParams.get("id")) {
      const paymentId = url.searchParams.get("id")!;
      const payment = await getVendorPayment(paymentId);
      
      if (!payment) {
        return NextResponse.json(
          { error: "Payment not found" },
          { status: 404 }
        );
      }
      
      return NextResponse.json({ payment });
    }

    // Payment summary endpoint
    if (url.searchParams.get("summary") === "true") {
      const tenantSlug = url.searchParams.get("tenantSlug");
      const vendorId = url.searchParams.get("vendorId");
      
      if (!tenantSlug) {
        return NextResponse.json(
          { error: "tenantSlug parameter required" },
          { status: 400 }
        );
      }
      
      const summary = await getVendorPaymentSummary(tenantSlug, vendorId || undefined);
      return NextResponse.json({ summary });
    }

    // List payments with filters
    const parsed = paymentListSchema.safeParse({
      tenantSlug: url.searchParams.get("tenantSlug") || undefined,
      vendorId: url.searchParams.get("vendorId") || undefined,
      status: url.searchParams.get("status") || undefined,
      method: url.searchParams.get("method") || undefined,
      limit: url.searchParams.get("limit") || undefined,
      offset: url.searchParams.get("offset") || undefined,
    });

    if (!parsed.success) {
      console.error("Vendor payments validation error:", parsed.error.flatten());
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (!parsed.data.tenantSlug) {
      return NextResponse.json({ error: "tenantSlug parameter required" }, { status: 400 });
    }

    const payments = await listVendorPayments({ ...parsed.data, tenantSlug: parsed.data.tenantSlug! }).catch((err) => {
      console.error("Database error in listVendorPayments:", err);
      return [];
    });
    return NextResponse.json({ data: payments, payments });

  } catch (error) {
    console.error("Vendor Payments GET error:", (error as any)?.stack || error);
    return NextResponse.json(
      { error: "Internal server error", details: String((error as any)?.message ?? error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log('API: POST /api/finance/vendor-payments called');
  
  try {
    const body = await request.json();
    
    // Apply payment to bill
    if (body.action === "apply") {
      const paymentId = body.paymentId;
      if (!paymentId) {
        return NextResponse.json(
          { error: "paymentId required for payment application" },
          { status: 400 }
        );
      }

      const parsed = applyPaymentSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid application parameters", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      try {
        const payment = await applyPaymentToBill(paymentId, parsed.data.billId, parsed.data.appliedAmount);
        return NextResponse.json({ payment });
      } catch (applyError) {
        return NextResponse.json(
          { error: "Payment application failed", details: String((applyError as any)?.message ?? applyError) },
          { status: 400 }
        );
      }
    }

    // Create new payment
    const parsed = paymentCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payment data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    try {
      const payment = await createVendorPayment(parsed.data);
      return NextResponse.json({ payment }, { status: 201 });
    } catch (createError) {
      return NextResponse.json(
        { error: "Payment creation failed", details: String((createError as any)?.message ?? createError) },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error("Vendor Payments POST error:", (error as any)?.stack || error);
    return NextResponse.json(
      { error: "Internal server error", details: String((error as any)?.message ?? error) },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  console.log('API: PUT /api/finance/vendor-payments called');
  
  try {
    const url = new URL(request.url);
    const paymentId = url.searchParams.get("id");
    
    if (!paymentId) {
      return NextResponse.json(
        { error: "Payment ID required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = paymentUpdateSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid update data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const payment = await updateVendorPayment(paymentId, parsed.data);
    
    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ payment });

  } catch (error) {
    console.error("Vendor Payments PUT error:", (error as any)?.stack || error);
    return NextResponse.json(
      { error: "Internal server error", details: String((error as any)?.message ?? error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  console.log('API: DELETE /api/finance/vendor-payments called');
  
  try {
    const url = new URL(request.url);
    const paymentId = url.searchParams.get("id");
    
    if (!paymentId) {
      return NextResponse.json(
        { error: "Payment ID required" },
        { status: 400 }
      );
    }

    const deleted = await deleteVendorPayment(paymentId);
    
    if (!deleted) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Vendor Payments DELETE error:", (error as any)?.stack || error);
    return NextResponse.json(
      { error: "Internal server error", details: String((error as any)?.message ?? error) },
      { status: 500 }
    );
  }
}
