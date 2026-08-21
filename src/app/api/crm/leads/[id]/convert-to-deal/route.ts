import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CRM_PIPELINE_STAGES } from "@/lib/crm/types";
import { getLead, updateLead, insertDeal, insertCustomer, logActivity } from "@/lib/crm/db";
import { resolveCrmAuth } from "@/lib/crm/auth";
import { handleDatabaseError } from "@/lib/api-errors";

const convertSchema = z.object({
  tenantSlug: z.string().min(1),
  dealName: z.string().optional(),
  stage: z.enum(CRM_PIPELINE_STAGES).default("prospecting"),
  value: z.number().min(0).optional(),
  currency: z.string().default("₦"),
  probability: z.number().min(0).max(100).optional(),
  expectedClose: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = convertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const lead = await getLead(params.id);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if ((lead as any).tenantSlug !== parsed.data.tenantSlug) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const auth = await resolveCrmAuth(request);

    // Create a prospect customer from the lead if one doesn't exist yet
    const customer = await insertCustomer({
      tenantSlug: parsed.data.tenantSlug,
      regionId: (lead as any).regionId ?? "default",
      branchId: (lead as any).branchId ?? "default",
      name: (lead as any).companyName,
      primaryContact: {
        name: (lead as any).contactName ?? "",
        email: (lead as any).contactEmail ?? null,
        phone: (lead as any).contactPhone ?? null,
      },
      status: "prospect",
      convertedFromLeadId: params.id,
    }).catch(() => null);

    const dealName = parsed.data.dealName || `Deal - ${(lead as any).companyName}`;
    const dealValue = parsed.data.value ?? Number((lead as any).expectedValue ?? 0);

    const deal = await insertDeal({
      tenantSlug: parsed.data.tenantSlug,
      customerId: customer ? (customer as any).id : undefined,
      leadId: params.id,
      name: dealName,
      stage: parsed.data.stage,
      value: dealValue,
      currency: parsed.data.currency,
      probability: parsed.data.probability ?? 50,
      expectedClose: parsed.data.expectedClose,
      assignedOfficerId: (lead as any).assignedOfficerId ?? auth?.employeeId,
      createdBy: auth?.employeeId,
    });

    // Update lead stage to reflect progression
    await updateLead(params.id, { stage: "qualified" }).catch(() => {});

    // Log activity
    await logActivity({
      tenantSlug: parsed.data.tenantSlug,
      entityType: "lead",
      entityId: params.id,
      action: "converted_to_deal",
      description: `Lead "${(lead as any).companyName}" converted to deal "${dealName}"`,
      metadata: { leadId: params.id, dealId: deal.id, customerId: customer ? (customer as any).id : null },
    }).catch(() => {});

    return NextResponse.json({ deal, customer, leadId: params.id }, { status: 201 });
  } catch (error) {
    return handleDatabaseError(error, "Lead to deal conversion");
  }
}
