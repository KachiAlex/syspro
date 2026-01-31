import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CRM_LEAD_STAGES } from "@/lib/crm/types";
import { updateLead } from "@/lib/crm/db";
import { handleDatabaseError } from "@/lib/api-errors";

const patchSchema = z.object({
  stage: z.enum(CRM_LEAD_STAGES).optional(),
  assignedOfficerId: z.string().optional(),
  notes: z.string().optional(),
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
    const lead = await updateLead(params.id, parsed.data);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    return NextResponse.json({ lead });
  } catch (error) {
    return handleDatabaseError(error, "Lead update");
  }
}
