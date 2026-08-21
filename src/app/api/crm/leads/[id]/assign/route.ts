import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLead, updateLead, logActivity } from "@/lib/crm/db";
import { resolveCrmAuth } from "@/lib/crm/auth";
import { handleDatabaseError } from "@/lib/api-errors";

const assignSchema = z.object({
  tenantSlug: z.string().min(1),
  assignedOfficerId: z.string().min(1),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
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
    // Only admin, HOD, or the lead owner can assign
    if (!auth.isAdmin && !auth.isHOD && existing.createdBy !== auth.employeeId && existing.assignedOfficerId !== auth.employeeId) {
      return NextResponse.json({ error: "You can only assign leads you own or are assigned to" }, { status: 403 });
    }

    const previousAssignee = existing.assignedOfficerId;
    const lead = await updateLead(params.id, {
      assignedOfficerId: parsed.data.assignedOfficerId,
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found after update" }, { status: 404 });
    }

    // Log the assignment activity
    await logActivity({
      tenantSlug: parsed.data.tenantSlug,
      entityType: "lead",
      entityId: params.id,
      action: "assigned",
      description: `Lead reassigned from ${previousAssignee ?? "unassigned"} to ${parsed.data.assignedOfficerId}`,
      metadata: { previousAssignee, newAssignee: parsed.data.assignedOfficerId },
    });

    return NextResponse.json({ lead });
  } catch (error) {
    return handleDatabaseError(error, "Lead assignment");
  }
}
