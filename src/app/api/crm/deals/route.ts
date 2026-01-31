import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CRM_PIPELINE_STAGES } from "@/lib/crm/types";
import { insertDeal } from "@/lib/crm/db";
import { handleDatabaseError } from "@/lib/api-errors";

const dealSchema = z.object({
  tenantSlug: z.string().min(1),
  customerId: z.string().optional(),
  leadId: z.string().optional(),
  stage: z.enum(CRM_PIPELINE_STAGES),
  value: z.number().positive(),
  currency: z.string().optional(),
  probability: z.number().min(0).max(100).optional(),
  expectedClose: z.string().optional(),
  assignedOfficerId: z.string().optional(),
  status: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = dealSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const deal = await insertDeal({
      tenantSlug: parsed.data.tenantSlug,
      customerId: parsed.data.customerId,
      leadId: parsed.data.leadId,
      stage: parsed.data.stage,
      value: parsed.data.value,
      currency: parsed.data.currency,
      probability: parsed.data.probability,
      expectedClose: parsed.data.expectedClose,
      assignedOfficerId: parsed.data.assignedOfficerId,
      status: parsed.data.status,
    });
    return NextResponse.json({ deal });
  } catch (error) {
    return handleDatabaseError(error, "Deal creation");
  }
}
