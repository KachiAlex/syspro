import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateContact, getContact } from "@/lib/crm/db";
import { handleDatabaseError } from "@/lib/api-errors";

const patchSchema = z.object({
  tenantSlug: z.string().min(1),
  company: z.string().min(1).optional(),
  contactName: z.string().min(1).optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  tags: z.array(z.string().min(1)).optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().min(3).optional().or(z.literal("")),
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
