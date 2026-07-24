import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { insertContact, insertContacts, listContacts, countContacts } from "@/lib/crm/db";
import { handleDatabaseError } from "@/lib/api-errors";
import { resolveCrmAuth } from "@/lib/crm/auth";
import { sql as SQL, db } from "@/lib/sql-client";

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

async function getTeamMemberIds(tenantSlug: string, departmentId: string): Promise<string[]> {
  if (!departmentId) return [];
  const sql = SQL;
  const rows = await sql`
    select id from admin_employees
    where tenant_slug = ${tenantSlug} and department_id = ${departmentId} and status = 'active'
  `;
  return (rows as any[]).map(r => r.id);
}

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

  const viewMode = url.searchParams.get("viewMode") || undefined;
  const auth = await resolveCrmAuth(request);

  try {
    let filterCreatedBy: string | undefined;

    if (auth && auth.session.tenantSlug === parsed.data.tenantSlug) {
      if (viewMode === "mine" || (!viewMode && auth.scope === "mine")) {
        filterCreatedBy = auth.employeeId;
      } else if (viewMode === "team" || (!viewMode && auth.scope === "team")) {
        const teamIds = await getTeamMemberIds(auth.session.tenantSlug, auth.departmentId);
        if (teamIds.length > 0) {
          const placeholders = teamIds.map((_, i) => `$${i + 2}`).join(",");
          const rows = (await db.query(
            `select * from crm_contacts where tenant_slug = $1 and created_by in (${placeholders}) order by created_at desc`,
            [parsed.data.tenantSlug, ...teamIds]
          )).rows as any[];
          const contacts = rows.map((r) => ({
            id: r.id, tenantSlug: r.tenant_slug, company: r.company, contactName: r.contact_name,
            contactEmail: r.contact_email, contactPhone: r.contact_phone, source: r.source,
            status: r.status, tags: Array.isArray(r.tags) ? r.tags : [],
            importedAt: r.imported_at ?? r.created_at, createdBy: r.created_by ?? null,
            createdAt: r.created_at, updatedAt: r.updated_at,
          }));
          return NextResponse.json({ contacts, total: contacts.length });
        }
        filterCreatedBy = auth.employeeId;
      }
    }

    const contacts = await listContacts({ ...parsed.data, createdBy: filterCreatedBy });
    const total = await countContacts({ ...parsed.data, createdBy: filterCreatedBy });
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

  const auth = await resolveCrmAuth(request);
  const createdBy = auth?.employeeId;

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
          createdBy,
        }))
      );
      return NextResponse.json({ contacts }, { status: 201 });
    } catch (error) {
      return handleDatabaseError(error, "Contact import");
    }
  }

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
      createdBy,
    });
    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    return handleDatabaseError(error, "Contact creation");
  }
}
