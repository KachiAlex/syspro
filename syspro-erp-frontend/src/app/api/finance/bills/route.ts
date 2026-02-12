import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  listBills,
  getBill,
  createBill,
  updateBill,
  deleteBill,
  convertPOToBill,
  getAgingReport,
  updateBillStatuses,
} from "@/lib/finance/bills";

const billListSchema = z.object({
  tenantSlug: z.string().min(1),
  vendorId: z.string().uuid().optional(),
  status: z.enum(["draft", "open", "partially_paid", "paid", "overdue", "cancelled"]).optional(),
  branchId: z.string().uuid().optional(),
  overdueOnly: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
  offset: z.coerce.number().min(0).optional(),
});

const billCreateSchema = z.object({
  tenantSlug: z.string().min(1),
  vendorId: z.string().uuid(),
  poId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  billDate: z.string().datetime(),
  dueDate: z.string().datetime().optional(),
  currency: z.string().default("NGN"),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    taxRate: z.number().min(0).max(100).optional(),
    accountCode: z.string().optional(),
  })).min(1),
  metadata: z.record(z.any()).optional(),
});

const billUpdateSchema = z.object({
  status: z.enum(["draft", "open", "partially_paid", "paid", "overdue", "cancelled"]).optional(),
  dueDate: z.string().datetime().optional(),
  balanceDue: z.number().nonnegative().optional(),
  metadata: z.record(z.any()).optional(),
});

const convertPOSchema = z.object({
  billDate: z.string().datetime(),
  dueDate: z.string().datetime().optional(),
  currency: z.string().default("NGN"),
  metadata: z.record(z.any()).optional(),
});

export async function GET(request: NextRequest) {
  console.log('API: GET /api/finance/bills called');
  
  try {
    const url = new URL(request.url);
    
    // Get single bill by ID
    if (url.searchParams.get("id")) {
      const billId = url.searchParams.get("id")!;
      const bill = await getBill(billId);
      
      if (!bill) {
        return NextResponse.json(
          { error: "Bill not found" },
          { status: 404 }
        );
      }
      
      return NextResponse.json({ bill });
    }

    // Aging report endpoint
    if (url.searchParams.get("aging") === "true") {
      const tenantSlug = url.searchParams.get("tenantSlug");
      if (!tenantSlug) {
        return NextResponse.json(
          { error: "tenantSlug parameter required" },
          { status: 400 }
        );
      }
      
      const aging = await getAgingReport(tenantSlug);
      return NextResponse.json({ aging });
    }

    // List bills with filters
    const parsed = billListSchema.safeParse({
      tenantSlug: url.searchParams.get("tenantSlug"),
      vendorId: url.searchParams.get("vendorId"),
      status: url.searchParams.get("status"),
      branchId: url.searchParams.get("branchId"),
      overdueOnly: url.searchParams.get("overdueOnly"),
      limit: url.searchParams.get("limit"),
      offset: url.searchParams.get("offset"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const bills = await listBills(parsed.data);
    return NextResponse.json({ bills });

  } catch (error) {
    console.error("Bills GET error:", (error as any)?.stack || error);
    return NextResponse.json(
      { error: "Internal server error", details: String((error as any)?.message ?? error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log('API: POST /api/finance/bills called');
  
  try {
    const body = await request.json();
    
    // Convert PO to Bill
    if (body.action === "convert-po") {
      const poId = body.poId;
      if (!poId) {
        return NextResponse.json(
          { error: "poId required for PO conversion" },
          { status: 400 }
        );
      }

      const parsed = convertPOSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid conversion parameters", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const bill = await convertPOToBill(poId, parsed.data);
      if (!bill) {
        return NextResponse.json(
          { error: "Purchase Order not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ bill }, { status: 201 });
    }

    // Update bill statuses (maintenance endpoint)
    if (body.action === "update-statuses") {
      const tenantSlug = body.tenantSlug;
      if (!tenantSlug) {
        return NextResponse.json(
          { error: "tenantSlug required" },
          { status: 400 }
        );
      }

      const updated = await updateBillStatuses(tenantSlug);
      return NextResponse.json({ updated });
    }

    // Create new bill
    const parsed = billCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid bill data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const bill = await createBill(parsed.data);
    return NextResponse.json({ bill }, { status: 201 });

  } catch (error) {
    console.error("Bills POST error:", (error as any)?.stack || error);
    return NextResponse.json(
      { error: "Internal server error", details: String((error as any)?.message ?? error) },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  console.log('API: PUT /api/finance/bills called');
  
  try {
    const url = new URL(request.url);
    const billId = url.searchParams.get("id");
    
    if (!billId) {
      return NextResponse.json(
        { error: "Bill ID required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = billUpdateSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid update data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const bill = await updateBill(billId, parsed.data);
    
    if (!bill) {
      return NextResponse.json(
        { error: "Bill not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ bill });

  } catch (error) {
    console.error("Bills PUT error:", (error as any)?.stack || error);
    return NextResponse.json(
      { error: "Internal server error", details: String((error as any)?.message ?? error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  console.log('API: DELETE /api/finance/bills called');
  
  try {
    const url = new URL(request.url);
    const billId = url.searchParams.get("id");
    
    if (!billId) {
      return NextResponse.json(
        { error: "Bill ID required" },
        { status: 400 }
      );
    }

    const deleted = await deleteBill(billId);
    
    if (!deleted) {
      return NextResponse.json(
        { error: "Bill not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Bills DELETE error:", (error as any)?.stack || error);
    return NextResponse.json(
      { error: "Internal server error", details: String((error as any)?.message ?? error) },
      { status: 500 }
    );
  }
}
