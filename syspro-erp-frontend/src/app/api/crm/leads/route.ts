import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CRM_LEAD_STAGES, CRM_LEAD_SOURCES } from "@/lib/crm/types";
import { insertLead } from "@/lib/crm/db";
import { handleDatabaseError } from "@/lib/api-errors";

const leadSchema = z.object({
  tenantSlug: z.string().min(1),
  regionId: z.string().min(1),
  branchId: z.string().min(1),
  companyName: z.string().min(2),
  contactName: z.string().min(2),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  owner: z.string().optional(),
  stage: z.enum(CRM_LEAD_STAGES),
  source: z.enum(CRM_LEAD_SOURCES).default("website"),
  expectedValue: z.number().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const lead = await insertLead({
      tenantSlug: parsed.data.tenantSlug,
      regionId: parsed.data.regionId,
      branchId: parsed.data.branchId,
      companyName: parsed.data.companyName,
      contactName: parsed.data.contactName,
      contactEmail: parsed.data.contactEmail,
      contactPhone: parsed.data.contactPhone,
      source: parsed.data.source,
      stage: parsed.data.stage,
      assignedOfficerId: parsed.data.owner,
      expectedValue: parsed.data.expectedValue,
      currency: parsed.data.currency,
      notes: parsed.data.notes,
    });

    return NextResponse.json({ lead });
  } catch (error) {
    return handleDatabaseError(error, "Lead creation");
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  const regionId = searchParams.get("regionId") || undefined;
  const branchId = searchParams.get("branchId") || undefined;
  const salesOfficerId = searchParams.get("salesOfficerId") || undefined;
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;
  const offset = searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined;

  try {
    const leads = await listLeads({ tenantSlug, regionId, branchId, salesOfficerId, limit, offset } as any);
    return NextResponse.json({ leads });
  } catch (error) {
    return handleDatabaseError(error, "List leads");
  }
}
