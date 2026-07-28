import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLead, updateLead, insertCustomer, insertDeal, recordConversion, logActivity } from "@/lib/crm/db";
import { resolveCrmAuth } from "@/lib/crm/auth";
import { handleDatabaseError } from "@/lib/api-errors";

const convertSchema = z.object({
  tenantSlug: z.string().min(1),
  regionId: z.string().min(1).default("default"),
  branchId: z.string().min(1).default("default"),
  customerName: z.string().min(1).optional(),
  status: z.string().optional(),
  createDeal: z.boolean().default(true),
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
    if ((lead as any).tenant_slug !== parsed.data.tenantSlug && (lead as any).tenantSlug !== parsed.data.tenantSlug) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const auth = await resolveCrmAuth(request);

    const customerName = parsed.data.customerName || (lead as any).companyName || (lead as any).company_name;
    const customer = await insertCustomer({
      tenantSlug: parsed.data.tenantSlug,
      regionId: parsed.data.regionId ?? (lead as any).regionId ?? (lead as any).region_id ?? "default",
      branchId: parsed.data.branchId ?? (lead as any).branchId ?? (lead as any).branch_id ?? "default",
      name: customerName,
      primaryContact: {
        name: (lead as any).contactName ?? (lead as any).contact_name ?? "",
        email: (lead as any).contactEmail ?? (lead as any).contact_email ?? null,
        phone: (lead as any).contactPhone ?? (lead as any).contact_phone ?? null,
      },
      status: parsed.data.status ?? "active",
      convertedFromLeadId: params.id,
    });

    await updateLead(params.id, { stage: "converted" });

    await recordConversion({
      tenantSlug: parsed.data.tenantSlug,
      leadId: params.id,
      customerId: (customer as any).id,
      sourceStage: (lead as any).stage ?? null,
    });

    // Auto-create deal from lead data if opted in
    let deal = null;
    if (parsed.data.createDeal) {
      const expectedValue = (lead as any).expectedValue ?? (lead as any).expected_value;
      deal = await insertDeal({
        tenantSlug: parsed.data.tenantSlug,
        customerId: (customer as any).id,
        leadId: params.id,
        name: `Deal - ${customerName}`,
        stage: "prospecting",
        value: expectedValue ? Number(expectedValue) : 0,
        currency: (lead as any).currency ?? "₦",
        probability: 50,
        createdBy: auth?.employeeId,
      }).catch(() => null);
    }

    // Log activity
    await logActivity({
      tenantSlug: parsed.data.tenantSlug,
      entityType: "lead",
      entityId: params.id,
      action: "converted_to_customer",
      description: `Lead converted to customer "${customerName}"`,
      metadata: {
        leadId: params.id,
        customerId: (customer as any).id,
        dealId: deal?.id ?? null,
        customerName,
      },
    }).catch(() => {});

    return NextResponse.json({ customer, leadId: params.id, deal }, { status: 201 });
  } catch (error) {
    return handleDatabaseError(error, "Lead to customer conversion");
  }
}
