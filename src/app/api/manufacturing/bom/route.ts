import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createBom,
  listBoms,
  getBom,
  updateBom,
  deleteBom,
  addBomLine,
  removeBomLine,
  explodeBom,
} from "@/lib/manufacturing/bom";

const bomLineSchema = z.object({
  componentSku: z.string().min(1),
  componentName: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unit: z.string().optional(),
  componentType: z.enum(["raw_material", "subassembly", "finished_good"]).optional(),
  scrapPercentage: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

const createBomSchema = z.object({
  tenantSlug: z.string().min(1),
  productSku: z.string().min(1),
  productName: z.string().min(1),
  revision: z.string().optional(),
  status: z.enum(["draft", "active", "deprecated"]).optional(),
  quantity: z.coerce.number().positive().optional(),
  unit: z.string().optional(),
  description: z.string().optional(),
  lines: z.array(bomLineSchema).min(1, "At least one BOM line is required"),
});

const updateBomSchema = z.object({
  productName: z.string().optional(),
  status: z.enum(["draft", "active", "deprecated"]).optional(),
  quantity: z.coerce.number().positive().optional(),
  unit: z.string().optional(),
  description: z.string().optional(),
});

const addLineSchema = bomLineSchema;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantSlug = searchParams.get("tenantSlug");
    if (!tenantSlug) {
      return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
    }

    const action = searchParams.get("action");

    if (action === "explode") {
      const productSku = searchParams.get("productSku");
      const quantity = parseFloat(searchParams.get("quantity") ?? "1");
      if (!productSku) {
        return NextResponse.json({ success: false, error: "productSku is required for explosion" }, { status: 400 });
      }
      const items = await explodeBom(productSku, tenantSlug, quantity);
      return NextResponse.json({ success: true, data: items });
    }

    const id = searchParams.get("id");
    if (id) {
      const bom = await getBom(id, tenantSlug);
      if (!bom) {
        return NextResponse.json({ success: false, error: "BOM not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: bom });
    }

    const status = searchParams.get("status") ?? undefined;
    const boms = await listBoms(tenantSlug, status);
    return NextResponse.json({ success: true, data: boms });
  } catch (error) {
    console.error("Error in BOM GET:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createBomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
    }

    const bom = await createBom(parsed.data);
    return NextResponse.json({ success: true, data: bom }, { status: 201 });
  } catch (error) {
    console.error("Error in BOM POST:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantSlug = searchParams.get("tenantSlug");
    const id = searchParams.get("id");
    const action = searchParams.get("action");

    if (!tenantSlug || !id) {
      return NextResponse.json({ success: false, error: "tenantSlug and id are required" }, { status: 400 });
    }

    const body = await request.json();

    if (action === "addLine") {
      const parsed = addLineSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: "Invalid line data", details: parsed.error.flatten() }, { status: 400 });
      }
      const line = await addBomLine(id, tenantSlug, parsed.data);
      return NextResponse.json({ success: true, data: line });
    }

    if (action === "removeLine") {
      const lineId = body.lineId;
      if (!lineId) {
        return NextResponse.json({ success: false, error: "lineId is required" }, { status: 400 });
      }
      const removed = await removeBomLine(lineId, id);
      return NextResponse.json({ success: removed });
    }

    const parsed = updateBomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
    }

    const updated = await updateBom(id, tenantSlug, parsed.data);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error in BOM PATCH:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantSlug = searchParams.get("tenantSlug");
    const id = searchParams.get("id");

    if (!tenantSlug || !id) {
      return NextResponse.json({ success: false, error: "tenantSlug and id are required" }, { status: 400 });
    }

    const deleted = await deleteBom(id, tenantSlug);
    return NextResponse.json({ success: deleted });
  } catch (error) {
    console.error("Error in BOM DELETE:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
