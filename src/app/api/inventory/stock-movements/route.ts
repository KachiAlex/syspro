import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordStockMovement, listStockMovements, StockMovementType } from "@/lib/inventory/stock-movements";

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
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
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
  try {
    const body = await request.json();
    const parsed = createMovementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
    }

    const movement = await recordStockMovement(parsed.data.tenantSlug, {
      productSku: parsed.data.productSku,
      productName: parsed.data.productName,
      movementType: parsed.data.movementType,
      quantity: parsed.data.quantity,
      unitCost: parsed.data.unitCost,
      referenceType: parsed.data.referenceType,
      referenceId: parsed.data.referenceId,
      notes: parsed.data.notes,
    });

    return NextResponse.json({ success: true, data: movement }, { status: 201 });
  } catch (error) {
    console.error("Error recording stock movement:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
