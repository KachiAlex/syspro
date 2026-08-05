import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createWorkOrder,
  listWorkOrders,
  getWorkOrder,
  getWorkOrderDetail,
  releaseWorkOrder,
  startWorkOrder,
  completeWorkOrder,
  closeWorkOrder,
  cancelWorkOrder,
  updateOperation,
  consumeMaterial,
} from "@/lib/manufacturing/work-orders";

const operationSchema = z.object({
  name: z.string().min(1),
  workCenter: z.string().optional(),
  standardMinutes: z.coerce.number().min(0).optional(),
  laborRate: z.coerce.number().min(0).optional(),
  overheadRate: z.coerce.number().min(0).optional(),
});

const createSchema = z.object({
  tenantSlug: z.string().min(1),
  productSku: z.string().min(1),
  productName: z.string().min(1),
  bomId: z.string().optional(),
  quantity: z.coerce.number().positive(),
  unit: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  scheduledStart: z.string().optional(),
  scheduledEnd: z.string().optional(),
  notes: z.string().optional(),
  createdBy: z.string().optional(),
  operations: z.array(operationSchema).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantSlug = searchParams.get("tenantSlug");
    if (!tenantSlug) {
      return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
    }

    const id = searchParams.get("id");
    if (id) {
      const detail = searchParams.get("detail") === "true";
      if (detail) {
        const wo = await getWorkOrderDetail(id, tenantSlug);
        if (!wo) return NextResponse.json({ success: false, error: "Work order not found" }, { status: 404 });
        return NextResponse.json({ success: true, data: wo });
      }
      const wo = await getWorkOrder(id, tenantSlug);
      if (!wo) return NextResponse.json({ success: false, error: "Work order not found" }, { status: 404 });
      return NextResponse.json({ success: true, data: wo });
    }

    const status = searchParams.get("status") ?? undefined;
    const limit = parseInt(searchParams.get("limit") ?? "50");
    const workOrders = await listWorkOrders(tenantSlug, status, limit);
    return NextResponse.json({ success: true, data: workOrders });
  } catch (error) {
    console.error("Error in work orders GET:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
    }

    const wo = await createWorkOrder(parsed.data);
    return NextResponse.json({ success: true, data: wo }, { status: 201 });
  } catch (error) {
    console.error("Error in work orders POST:", error);
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

    const body = await request.json().catch(() => ({}));

    if (action === "release") {
      const wo = await releaseWorkOrder(id, tenantSlug);
      return NextResponse.json({ success: !!wo, data: wo });
    }

    if (action === "start") {
      const wo = await startWorkOrder(id, tenantSlug);
      return NextResponse.json({ success: !!wo, data: wo });
    }

    if (action === "complete") {
      const wo = await completeWorkOrder(id, tenantSlug);
      return NextResponse.json({ success: !!wo, data: wo });
    }

    if (action === "close") {
      const wo = await closeWorkOrder(id, tenantSlug);
      return NextResponse.json({ success: !!wo, data: wo });
    }

    if (action === "cancel") {
      const wo = await cancelWorkOrder(id, tenantSlug);
      return NextResponse.json({ success: !!wo, data: wo });
    }

    if (action === "updateOperation") {
      const parsed = z.object({
        operationId: z.string().min(1),
        actualMinutes: z.coerce.number().min(0).optional(),
        status: z.enum(["pending", "in_progress", "completed"]).optional(),
        completedBy: z.string().optional(),
      }).safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
      }
      const op = await updateOperation(parsed.data.operationId, id, tenantSlug, parsed.data);
      return NextResponse.json({ success: !!op, data: op });
    }

    if (action === "consumeMaterial") {
      const parsed = z.object({
        materialId: z.string().min(1),
        consumedQuantity: z.coerce.number().min(0),
      }).safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
      }
      const mat = await consumeMaterial(parsed.data.materialId, id, tenantSlug, parsed.data.consumedQuantity);
      return NextResponse.json({ success: !!mat, data: mat });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Error in work orders PATCH:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
