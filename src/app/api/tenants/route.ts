import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getSql } from "@/lib/db";

type TenantRow = {
  name: string;
  region: string;
  status: string;
  ledger_delta: string;
  seats: number | null;
};

const payloadSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  companySlug: z
    .string()
    .min(2, "Tenant slug must be at least 2 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  region: z.string().min(2, "Region is required"),
  industry: z.string().min(2, "Industry is required"),
  seats: z.number().int().positive().nullable().optional(),
  adminName: z.string().min(2, "Admin name must be at least 2 characters"),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8, "Admin password must be at least 8 characters"),
  adminNotes: z.string().optional().default(""),
});

async function ensureTenantTable(sql: ReturnType<typeof getSql>) {
  await sql`
    create table if not exists tenants (
      id uuid primary key,
      name text not null,
      code text,
      domain text,
      "isActive" boolean default false,
      settings jsonb,
      "schemaName" text,
      "createdAt" timestamptz default now(),
      "updatedAt" timestamptz default now(),
      "deletedAt" timestamptz
    )
  `;

  await sql`alter table tenants add column if not exists slug text`;
  await sql`alter table tenants add column if not exists region text`;
  await sql`alter table tenants add column if not exists industry text`;
  await sql`alter table tenants add column if not exists seats integer`;
  await sql`alter table tenants add column if not exists status text default 'Pending'`;
  await sql`alter table tenants add column if not exists ledger_delta text default '₦0'`;
  await sql`alter table tenants add column if not exists admin_name text`;
  await sql`alter table tenants add column if not exists admin_email text`;
  await sql`alter table tenants add column if not exists admin_password_hash text`;
  await sql`alter table tenants add column if not exists admin_notes text`;
  await sql`create unique index if not exists tenants_slug_key on tenants(slug)`;
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!rawBody) {
      return NextResponse.json({ error: "Request body cannot be empty" }, { status: 400 });
    }

    let body: unknown;
    try {
      console.log("Tenant payload content-type", request.headers.get("content-type"));
      console.log("Tenant payload raw body", rawBody);
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.error("Tenant payload JSON parse failed", parseError, rawBody);
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const parsed = payloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const payload = parsed.data;
    const computedCode = payload.companySlug.toUpperCase();
    const computedDomain = `${payload.companySlug}.syspro.local`;
    const computedSchema = `${payload.companySlug.replace(/-/g, "_")}_schema`;
    const sql = getSql();
    await ensureTenantTable(sql);

    const tenantId = randomUUID();
    const passwordHash = await bcrypt.hash(payload.adminPassword, 12);

    const tenantRows = (await sql(
      `
        insert into tenants (
          id,
          name,
          code,
          domain,
          "isActive",
          settings,
          "schemaName",
          slug,
          region,
          industry,
          seats,
          admin_name,
          admin_email,
          admin_password_hash,
          admin_notes
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        on conflict (slug) do update set
          name = excluded.name,
          code = excluded.code,
          domain = excluded.domain,
          "isActive" = excluded."isActive",
          settings = excluded.settings,
          "schemaName" = excluded."schemaName",
          region = excluded.region,
          industry = excluded.industry,
          seats = excluded.seats,
          admin_name = excluded.admin_name,
          admin_email = excluded.admin_email,
          admin_password_hash = excluded.admin_password_hash,
          admin_notes = excluded.admin_notes
        returning name, region, status, ledger_delta, seats
      `,
      [
        tenantId,
        payload.companyName,
        computedCode,
        computedDomain,
        false,
        JSON.stringify({}),
        computedSchema,
        payload.companySlug,
        payload.region,
        payload.industry,
        payload.seats ?? null,
        payload.adminName,
        payload.adminEmail.toLowerCase(),
        passwordHash,
        payload.adminNotes ?? "",
      ]
    )) as TenantRow[];

    const tenant = tenantRows[0];

    return NextResponse.json(
      {
        tenantId,
        tenantSummary: {
          name: tenant.name as string,
          region: tenant.region as string,
          status: tenant.status as string,
          ledger: tenant.ledger_delta as string,
          seats: typeof tenant.seats === "number" ? tenant.seats : 0,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Tenant creation failed", error);
    return NextResponse.json({ error: "Unable to create tenant" }, { status: 500 });
  }
}
