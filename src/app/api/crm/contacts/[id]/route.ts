import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateContact, getContact, deleteContact } from "@/lib/crm/db";
import { resolveCrmAuth } from "@/lib/crm/auth";
import { handleDatabaseError } from "@/lib/api-errors";

const patchSchema = z.object({
  tenantSlug: z.string().min(1),
  company: z.string().min(1).optional(),
  contactName: z.string().min(1).optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  tags: z.array(z.string().min(1)).optional(),
  contactEmail: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
  contactPhone: z.union([z.string(), z.literal(""), z.null()]).optional(),
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
    const existing = await getContact(params.id);
    if (!existing) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
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
      return NextResponse.json({ error: "You can only edit your own contacts" }, { status: 403 });
    }

    const payload = {
      company: parsed.data.company,
      contactName: parsed.data.contactName,
      status: parsed.data.status,
      source: parsed.data.source,
      tags: parsed.data.tags,
      contactEmail: parsed.data.contactEmail === "" ? null : parsed.data.contactEmail ?? undefined,
      contactPhone: parsed.data.contactPhone === "" ? null : parsed.data.contactPhone ?? undefined,
    } as const;

    const contact = await updateContact(params.id, payload);

    return NextResponse.json({ contact });
  } catch (error) {
    return handleDatabaseError(error, "Contact update");
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
    const existing = await getContact(params.id);
    if (!existing) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
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
      return NextResponse.json({ error: "You can only delete your own contacts" }, { status: 403 });
    }

    await deleteContact(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleDatabaseError(error, "Contact deletion");
  }
}
