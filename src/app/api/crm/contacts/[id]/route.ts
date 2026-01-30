import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateContact } from "@/lib/crm/db";

const patchSchema = z.object({
  status: z.string().optional(),
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
    const contact = await updateContact(params.id, {
      status: parsed.data.status,
      tags: parsed.data.tags,
      contactEmail: parsed.data.contactEmail === "" ? null : parsed.data.contactEmail,
      contactPhone: parsed.data.contactPhone === "" ? null : parsed.data.contactPhone,
    });

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({ contact });
  } catch (error) {
    console.error("Contact update failed", error);
    return NextResponse.json({ error: "Failed to update contact" }, { status: 500 });
  }
}
