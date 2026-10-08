export const dynamic = "force-dynamic";
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
import { writeFinanceEvent } from "@/lib/finance/events";
import { getCurrentUser } from "@/lib/auth-helpers";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

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
    // enforce tenant context for bill read operations
    const _ctx = validateTenantContext(request, "read");
    const _gate = await requireModuleAccess(request, "finance", "read");
    if (!_gate.ok) return _gate.response;
    const url = new URL(request.url);
    
    // Get single bill by ID
    if (url.searchParams.get("id")) {
      const billId = url.searchParams.get("id")!;
      const bill = await getBill(billId, _ctx.tenantSlug);
      
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
      vendorId: url.searchParams.get("vendorId") || undefined,
      status: url.searchParams.get("status") || undefined,
      branchId: url.searchParams.get("branchId") || undefined,
      overdueOnly: url.searchParams.get("overdueOnly") || undefined,
      limit: url.searchParams.get("limit") || undefined,
      offset: url.searchParams.get("offset") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const bills = await listBills(parsed.data);

    // Calculate pagination metadata
    const limit = parsed.data.limit ?? 50;
    const offset = parsed.data.offset ?? 0;
    const page = Math.floor(offset / limit) + 1;
    const pageSize = limit;
    const hasMore = bills.length === pageSize;
    const total = hasMore ? offset + bills.length + 1 : offset + bills.length;
    const totalPages = Math.ceil(total / pageSize) || 1;

    return NextResponse.json({
      bills,
      pagination: { page, pageSize, total, totalPages, hasMore },
    });

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
    // enforce tenant context for bill create/maintenance
    const _ctx = validateTenantContext(request, "write");
    const _gate = await requireModuleAccess(request, "finance", "write");
    if (!_gate.ok) return _gate.response;
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

      const bill = await convertPOToBill(poId, parsed.data, _ctx.tenantSlug);
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
      // Session tenant is authoritative — ignore any caller-supplied tenantSlug.

      const updated = await updateBillStatuses(_ctx.tenantSlug);
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

    const bill = await createBill({ ...parsed.data, tenantSlug: _ctx.tenantSlug });

    // Publish finance event for reporting
    writeFinanceEvent({
      tenantSlug: _ctx.tenantSlug,
      eventType: "bill_created",
      sourceModule: "finance",
      sourceRecordId: bill.id,
      userId: getCurrentUser(request)?.id,
      amount: bill.total,
      currency: bill.currency,
      glAccountCode: bill.items?.[0]?.accountCode,
      metadata: { billNumber: bill.billNumber, vendorId: bill.vendorId },
    });

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
    // enforce tenant context for updates
    const _ctx = validateTenantContext(request, "write");
    const _gate = await requireModuleAccess(request, "finance", "write");
    if (!_gate.ok) return _gate.response;
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

    const bill = await updateBill(billId, parsed.data, _ctx.tenantSlug);
    
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
    // enforce tenant context for deletes
    const _ctx = validateTenantContext(request, "delete");
    const _gate = await requireModuleAccess(request, "finance", "write");
    if (!_gate.ok) return _gate.response;
    const url = new URL(request.url);
    const billId = url.searchParams.get("id");
    
    if (!billId) {
      return NextResponse.json(
        { error: "Bill ID required" },
        { status: 400 }
      );
    }

    const deleted = await deleteBill(billId, _ctx.tenantSlug);
    
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
