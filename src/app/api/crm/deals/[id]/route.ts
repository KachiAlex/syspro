import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CRM_PIPELINE_STAGES } from "@/lib/crm/types";
import { updateDeal } from "@/lib/crm/db";
import { handleDatabaseError } from "@/lib/api-errors";

const patchSchema = z.object({
  stage: z.enum(CRM_PIPELINE_STAGES).optional(),
  probability: z.number().min(0).max(100).optional(),
  assignedOfficerId: z.string().optional(),
  status: z.string().optional(),
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
    const deal = await updateDeal(params.id, parsed.data);
    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }
    return NextResponse.json({ deal });
  } catch (error) {
    return handleDatabaseError(error, "Deal update");
  }
}
