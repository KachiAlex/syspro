import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { insertContact, insertContacts, listContacts, countContacts } from "@/lib/crm/db";
import { handleDatabaseError } from "@/lib/api-errors";

const contactPayloadSchema = z.object({
  company: z.string().min(1),
  contactName: z.string().min(1),
  contactEmail: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
  contactPhone: z.union([z.string(), z.literal(""), z.null()]).optional(),
  source: z.string().optional(),
  status: z.string().optional(),
  tags: z.array(z.string().min(1)).optional(),
  importedAt: z.string().datetime().optional(),
});

const importSchema = z.object({
  tenantSlug: z.string().min(1),
  contacts: z.array(contactPayloadSchema).min(1),
});

// Single contact creation (used by CRM dashboard form)
const singleContactSchema = z.object({
  tenantSlug: z.string().min(1),
  company: z.string().min(1),
  contactName: z.string().min(1),
  contactEmail: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
  contactPhone: z.union([z.string(), z.literal(""), z.null()]).optional(),
  source: z.string().optional(),
  status: z.string().optional(),
});

const listSchema = z.object({
  tenantSlug: z.string().min(1),
  tag: z.string().optional().nullable(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    tenantSlug: url.searchParams.get("tenantSlug"),
    tag: url.searchParams.get("tag") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const contacts = await listContacts(parsed.data);
    const total = await countContacts(parsed.data);
    return NextResponse.json({ contacts, total });
  } catch (error) {
    return handleDatabaseError(error, "Contact list");
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Support both bulk import ({ tenantSlug, contacts: [...] }) and single contact creation
  const hasContactsArray = Array.isArray((body as any).contacts);

  if (hasContactsArray) {
    const parsed = importSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    try {
      const contacts = await insertContacts(
        parsed.data.contacts.map((contact) => ({
          tenantSlug: parsed.data.tenantSlug,
          company: contact.company,
          contactName: contact.contactName,
          contactEmail: contact.contactEmail ?? null,
          contactPhone: contact.contactPhone ?? null,
          source: contact.source,
          status: contact.status,
          tags: contact.tags,
          importedAt: contact.importedAt,
        }))
      );
      return NextResponse.json({ contacts }, { status: 201 });
    } catch (error) {
      return handleDatabaseError(error, "Contact import");
    }
  }

  // Single contact creation
  const parsed = singleContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const contact = await insertContact({
      tenantSlug: parsed.data.tenantSlug,
      company: parsed.data.company,
      contactName: parsed.data.contactName,
      contactEmail: parsed.data.contactEmail ?? null,
      contactPhone: parsed.data.contactPhone ?? null,
      source: parsed.data.source,
      status: parsed.data.status,
    });
    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    return handleDatabaseError(error, "Contact creation");
  }
}
