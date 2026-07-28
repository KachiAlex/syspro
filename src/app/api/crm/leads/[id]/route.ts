import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CRM_LEAD_STAGES, CRM_LEAD_SOURCES } from "@/lib/crm/types";
import { updateLead, getLead, deleteLead } from "@/lib/crm/db";
import { resolveCrmAuth } from "@/lib/crm/auth";
import { handleDatabaseError } from "@/lib/api-errors";

const patchSchema = z.object({
  tenantSlug: z.string().min(1),
  companyName: z.string().min(2).optional(),
  contactName: z.string().min(2).optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  stage: z.enum(CRM_LEAD_STAGES).optional(),
  source: z.enum(CRM_LEAD_SOURCES).optional(),
  expectedValue: z.number().nullable().optional(),
  currency: z.string().optional(),
  score: z.number().min(0).max(100).nullable().optional(),
  assignedOfficerId: z.string().nullable().optional(),
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
    // Verify lead exists and belongs to tenant
    const existing = await getLead(params.id);
    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (existing.tenantSlug !== parsed.data.tenantSlug) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const auth = await resolveCrmAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (auth.session.tenantSlug !== parsed.data.tenantSlug) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (!auth.isAdmin && !auth.isHOD && existing.createdBy !== auth.employeeId) {
      return NextResponse.json({ error: "You can only edit your own leads" }, { status: 403 });
    }

    const lead = await updateLead(params.id, {
      companyName: parsed.data.companyName,
      contactName: parsed.data.contactName,
      contactEmail: parsed.data.contactEmail,
      contactPhone: parsed.data.contactPhone,
      stage: parsed.data.stage as any,
      source: parsed.data.source as any,
      expectedValue: parsed.data.expectedValue,
      currency: parsed.data.currency,
      score: parsed.data.score as any,
      assignedOfficerId: parsed.data.assignedOfficerId,
      notes: parsed.data.notes,
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    return NextResponse.json({ lead });
  } catch (error) {
    return handleDatabaseError(error, "Lead update");
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const lead = await getLead(params.id);
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    return NextResponse.json({ lead });
  } catch (error) {
    return handleDatabaseError(error, "Get lead");
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug");

  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  try {
    // Verify lead exists and belongs to tenant
    const existing = await getLead(params.id);
    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (existing.tenantSlug !== tenantSlug) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const auth = await resolveCrmAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (auth.session.tenantSlug !== tenantSlug) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (!auth.isAdmin && !auth.isHOD && existing.createdBy !== auth.employeeId) {
      return NextResponse.json({ error: "You can only delete your own leads" }, { status: 403 });
    }

    const success = await deleteLead(params.id);
    if (!success) {
      return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleDatabaseError(error, "Lead deletion");
  }
}
