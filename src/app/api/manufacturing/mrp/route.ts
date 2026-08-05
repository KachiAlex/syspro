import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runMrp, generateRequisitionsFromMrp, MrpDemandItem } from "@/lib/manufacturing/mrp";

const demandSchema = z.object({
  productSku: z.string().min(1),
  productName: z.string().min(1),
  quantity: z.coerce.number().positive(),
  dueDate: z.string().min(1),
  source: z.string().default("manual"),
});

const runMrpSchema = z.object({
  tenantSlug: z.string().min(1),
  demands: z.array(demandSchema).min(1, "At least one demand item is required"),
  autoGenerateRequisitions: z.boolean().optional().default(false),
  requestedBy: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = runMrpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
    }

    const plan = await runMrp(parsed.data.tenantSlug, parsed.data.demands as MrpDemandItem[]);

    let requisition = null;
    if (parsed.data.autoGenerateRequisitions) {
      requisition = await generateRequisitionsFromMrp(parsed.data.tenantSlug, plan, parsed.data.requestedBy);
    }

    return NextResponse.json({ success: true, data: plan, requisition });
  } catch (error) {
    console.error("Error running MRP:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
