import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CRM_PIPELINE_STAGES } from "@/lib/crm/types";
import { updateDeal, deleteDeal } from "@/lib/crm/db";
import { handleDatabaseError } from "@/lib/api-errors";

const patchSchema = z.object({
  stage: z.enum(CRM_PIPELINE_STAGES).optional(),
  probability: z.number().min(0).max(100).optional(),
  assignedOfficerId: z.string().optional(),
  status: z.string().optional(),
  value: z.number().min(0).optional(),
  currency: z.string().min(1).max(8).optional(),
  expectedClose: z.string().optional().or(z.literal("")),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const deal = await updateDeal(params.id, {
      stage: parsed.data.stage,
      probability: parsed.data.probability,
      assignedOfficerId: parsed.data.assignedOfficerId,
      status: parsed.data.status,
      value: parsed.data.value,
      currency: parsed.data.currency,
      expectedClose: parsed.data.expectedClose === "" ? null : parsed.data.expectedClose,
    });
    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }
    return NextResponse.json({ deal });
  } catch (error) {
    return handleDatabaseError(error, "Deal update");
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;

  try {
    const deleted = await deleteDeal(params.id);
    if (!deleted) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleDatabaseError(error, "Deal deletion");
  }
}
