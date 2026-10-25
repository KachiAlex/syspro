export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordStockMovement, listStockMovements, StockMovementType } from "@/lib/inventory/stock-movements";
import { requireModuleAccess } from "@/lib/api-auth";

const createMovementSchema = z.object({
  tenantSlug: z.string().min(1),
  productSku: z.string().min(1),
  productName: z.string().min(1),
  movementType: z.enum([
    "purchase_receipt",
    "work_order_issue",
    "work_order_receipt",
    "sale",
    "transfer",
    "adjustment",
    "return",
  ]),
  quantity: z.coerce.number().int().positive(),
  unitCost: z.coerce.number().min(0).default(0),
  referenceType: z.string().default("manual"),
  referenceId: z.string().default(""),
  warehouseId: z.string().optional(),
  lotNo: z.string().optional(),
  serialNos: z.array(z.string()).optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "admin", "read");
    if (!_scope.ok) return _scope.response;

  try {
    const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");
    if (!tenantSlug) {
      return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
    }

    const productSku = request.nextUrl.searchParams.get("productSku") ?? undefined;
    const movementType = request.nextUrl.searchParams.get("movementType") as StockMovementType | undefined;
    const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "100");

    const movements = await listStockMovements(tenantSlug, { productSku, movementType, limit });
    return NextResponse.json({ success: true, data: movements });
  } catch (error) {
    console.error("Error fetching stock movements:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "admin", "write");
    if (!_scope.ok) return _scope.response;

  try {
    const body = await request.json();
    const parsed = createMovementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
    }

    const movementInput = {
      productSku: parsed.data.productSku,
      productName: parsed.data.productName,
      movementType: parsed.data.movementType,
      quantity: parsed.data.quantity,
      unitCost: parsed.data.unitCost,
      referenceType: parsed.data.referenceType,
      referenceId: parsed.data.referenceId,
      warehouseId: parsed.data.warehouseId,
      lotNo: parsed.data.lotNo,
      serialNos: parsed.data.serialNos,
      expiryDate: parsed.data.expiryDate,
      notes: parsed.data.notes,
    };

    // Stock adjustments are shrinkage decisions — they route through the
    // approval workflow and only record on approval. Tenants can set
    // settings.approvals.stockAdjustmentMinAmount to let trivial
    // adjustments through without review.
    if (movementInput.movementType === "adjustment") {
      const value = movementInput.quantity * movementInput.unitCost;
      const { requiresApproval, initiateApproval } = await import("@/lib/finance/approvals");
      const gated = await requiresApproval(parsed.data.tenantSlug, "stock_adjustment", {
        amount: value,
        productSku: movementInput.productSku,
        warehouseId: movementInput.warehouseId,
      });
      if (gated) {
        const approval = await initiateApproval({
          tenantSlug: parsed.data.tenantSlug,
          entityType: "stock_adjustment",
          entityId: `sadj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          requestedBy: _scope.user?.id ?? "system",
          entityData: {
            amount: value,
            productSku: movementInput.productSku,
            reference: `Stock adjustment — ${movementInput.productSku} ×${movementInput.quantity}`,
            requestedByName: _scope.user?.name ?? _scope.user?.id,
            movement: movementInput,
          },
        });
        return NextResponse.json(
          { success: true, pendingApproval: true, approvalId: approval.id },
          { status: 202 }
        );
      }
    }

    const movement = await recordStockMovement(parsed.data.tenantSlug, movementInput);

    return NextResponse.json({ success: true, data: movement }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = /serial|lot|tracking|required|Insufficient|Duplicate/i.test(message) ? 422 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
