import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getContact, insertLead, updateContact, logActivity } from "@/lib/crm/db";
import { CRM_LEAD_STAGES, CRM_LEAD_SOURCES } from "@/lib/crm/types";
import { resolveCrmAuth } from "@/lib/crm/auth";
import { handleDatabaseError } from "@/lib/api-errors";

const convertSchema = z.object({
  tenantSlug: z.string().min(1),
  regionId: z.string().min(1).default("default"),
  branchId: z.string().min(1).default("default"),
  stage: z.enum(CRM_LEAD_STAGES).default("new"),
  source: z.enum(CRM_LEAD_SOURCES).default("website"),
  expectedValue: z.number().optional(),
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
    const contact = await getContact(params.id);
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }
    if (contact.tenantSlug !== parsed.data.tenantSlug) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const auth = await resolveCrmAuth(request);

    const lead = await insertLead({
      tenantSlug: parsed.data.tenantSlug,
      regionId: parsed.data.regionId,
      branchId: parsed.data.branchId,
      companyName: contact.company,
      contactName: contact.contactName,
      contactEmail: contact.contactEmail ?? undefined,
      contactPhone: contact.contactPhone ?? undefined,
      source: parsed.data.source,
      stage: parsed.data.stage,
      expectedValue: parsed.data.expectedValue,
      notes: parsed.data.notes,
      contactId: params.id,
      createdBy: auth?.employeeId,
    });

    // Mark contact as converted
    await updateContact(params.id, { status: "Converted to Lead" }).catch(() => {});

    // Log activity
    await logActivity({
      tenantSlug: parsed.data.tenantSlug,
      entityType: "contact",
      entityId: params.id,
      action: "converted_to_lead",
      description: `Contact "${contact.contactName}" converted to lead`,
      metadata: { leadId: lead.id, contactName: contact.contactName, company: contact.company },
    }).catch(() => {});

    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    return handleDatabaseError(error, "Contact to lead conversion");
  }
}
