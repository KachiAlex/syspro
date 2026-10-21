import { db } from "@/lib/sql-client";
import { insertLead } from "@/lib/crm/db";
import { createTicket } from "@/lib/support-db";

// Schema-driven public web forms → creates CRM/support records.

export async function listWebForms(tenantSlug: string) {
  return (await db.query<any>(
    `select id, name, slug, target_entity, is_active, submit_count, created_at
     from web_forms where tenant_slug = $1 order by name`,
    [tenantSlug]
  )).rows;
}

export async function getWebFormBySlug(tenantSlug: string, slug: string) {
  return (await db.query<any>(
    `select * from web_forms where tenant_slug = $1 and slug = $2 and is_active`,
    [tenantSlug, slug]
  )).rows[0] ?? null;
}

export async function createWebForm(input: {
  tenantSlug: string;
  name: string;
  slug: string;
  targetEntity: string;
  schema: { name: string; label: string; type: string; required?: boolean; options?: string[] }[];
  successMessage?: string;
  notifyEmail?: string;
}) {
  if (!["lead", "ticket", "customer"].includes(input.targetEntity))
    throw new Error("target_entity must be lead|ticket|customer");
  if (!/^[a-z0-9-]+$/.test(input.slug))
    throw new Error("slug must be lowercase letters, digits, hyphens");
  return (await db.query<any>(
    `insert into web_forms (tenant_slug, name, slug, target_entity, schema,
       success_message, notify_email)
     values ($1,$2,$3,$4,$5,$6,$7) returning id, slug`,
    [input.tenantSlug, input.name, input.slug, input.targetEntity,
     JSON.stringify(input.schema), input.successMessage ?? null,
     input.notifyEmail ?? null]
  )).rows[0];
}

export async function updateWebForm(input: {
  tenantSlug: string; id: string; isActive?: boolean;
  schema?: any[]; name?: string; notifyEmail?: string;
}) {
  return (await db.query<any>(
    `update web_forms set
       is_active = coalesce($3, is_active),
       schema = coalesce($4, schema),
       name = coalesce($5, name),
       notify_email = coalesce($6, notify_email)
     where id = $1 and tenant_slug = $2 returning id`,
    [input.id, input.tenantSlug, input.isActive ?? null,
     input.schema ? JSON.stringify(input.schema) : null,
     input.name ?? null, input.notifyEmail ?? null]
  )).rows[0];
}

/** Public submit — validates against the form schema then creates the record. */
export async function submitWebForm(input: {
  tenantSlug: string;
  slug: string;
  data: Record<string, any>;
  ip?: string;
}) {
  const form = await getWebFormBySlug(input.tenantSlug, input.slug);
  if (!form) throw new Error("Form not found or inactive");

  const schema = form.schema as { name: string; type: string; required?: boolean }[];
  for (const field of schema) {
    if (field.required && !input.data[field.name])
      throw new Error(`Field '${field.name}' is required`);
  }

  let recordType: string | null = null;
  let recordId: string | null = null;
  const d = input.data;

  if (form.target_entity === "lead") {
    const lead = await insertLead({
      tenantSlug: input.tenantSlug,
      regionId: d.region_id ?? null,
      branchId: d.branch_id ?? null,
      companyName: String(d.company ?? d.name ?? "Web lead"),
      contactName: String(d.contact_name ?? d.name ?? ""),
      contactEmail: d.email ?? undefined,
      contactPhone: d.phone ?? undefined,
      source: "website",
      stage: "new",
      notes: `webform:${form.slug}${d.message ? ` — ${d.message}` : ""}`,
    });
    recordType = "lead"; recordId = lead.id;
  } else if (form.target_entity === "ticket") {
    const ticket = await createTicket({
      tenantSlug: input.tenantSlug,
      title: String(d.subject ?? d.title ?? "Web form ticket"),
      description: `${d.message ?? d.description ?? ""}${d.email ? `\n\nFrom: ${d.name ?? ""} <${d.email}>` : ""}`,
      ticketType: "customer",
      source: "api",
      impactLevel: "medium",
      priority: ["critical", "high", "medium", "low"].includes(d.priority) ? d.priority : "medium",
    });
    recordType = "ticket"; recordId = ticket.id;
  } else {
    // customer — insert as a CRM contact tagged with the form source
    const { randomUUID } = await import("crypto");
    const id = randomUUID();
    await db.query(
      `insert into crm_contacts (id, tenant_slug, company, contact_name,
         contact_email, contact_phone, source, tags)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, input.tenantSlug, String(d.company ?? d.name ?? "Web customer"),
       String(d.contact_name ?? d.name ?? ""), d.email ?? null, d.phone ?? null,
       "website", [`webform:${form.slug}`]]
    );
    recordType = "customer"; recordId = id;
  }

  await db.query(
    `insert into web_form_submissions (form_id, tenant_slug, data, record_type,
       record_id, ip) values ($1,$2,$3,$4,$5,$6)`,
    [form.id, input.tenantSlug, JSON.stringify(d), recordType, recordId,
     input.ip ?? null]
  );
  await db.query(
    `update web_forms set submit_count = submit_count + 1 where id = $1`,
    [form.id]
  );
  return { ok: true, message: form.success_message, recordType, recordId };
}

export async function listSubmissions(tenantSlug: string, formId: string, limit = 50) {
  return (await db.query<any>(
    `select id, data, record_type, record_id, created_at
     from web_form_submissions
     where tenant_slug = $1 and form_id = $2 order by created_at desc limit $3`,
    [tenantSlug, formId, limit]
  )).rows;
}
