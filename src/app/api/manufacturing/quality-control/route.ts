import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createInspection, listInspections } from "@/lib/manufacturing/quality-control";

const createSchema = z.object({
  tenantSlug: z.string().min(1),
  workOrderId: z.string().min(1),
  inspector: z.string().min(1),
  result: z.enum(["pass", "fail", "conditional"]),
  defectsFound: z.coerce.number().int().min(0).optional(),
  unitsInspected: z.coerce.number().int().min(0).optional(),
  unitsRejected: z.coerce.number().int().min(0).optional(),
  defectTypes: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantSlug = searchParams.get("tenantSlug");
    if (!tenantSlug) {
      return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
    }

    const workOrderId = searchParams.get("workOrderId") ?? undefined;
    const inspections = await listInspections(tenantSlug, workOrderId);
    return NextResponse.json({ success: true, data: inspections });
  } catch (error) {
    console.error("Error in quality inspections GET:", error);
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

    const inspection = await createInspection(parsed.data);
    return NextResponse.json({ success: true, data: inspection }, { status: 201 });
  } catch (error) {
    console.error("Error in quality inspections POST:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
