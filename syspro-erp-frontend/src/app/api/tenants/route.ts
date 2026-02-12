import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, sql as SQL, SqlClient } from "@/lib/sql-client";

export type TenantRow = {
  name: string;
  slug: string;
  region: string;
  status: string;
  ledger_delta: string;
  seats: number | null;
  admin_email?: string | null;
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

export async function ensureTenantTable(sql: SqlClient) {
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

export async function GET() {
  try {
    const sql = SQL;
    await ensureTenantTable(sql);

    const rows = (await sql`
      select name, slug, region, status, ledger_delta, seats, admin_email from tenants order by "createdAt" desc nulls last
    `) as TenantRow[];

    return NextResponse.json({ tenants: rows.map(mapTenantRow) });
  } catch (error) {
    console.error("Failed to fetch tenants", error);
    return NextResponse.json({ error: "Unable to fetch tenants" }, { status: 500 });
  }
}

export function mapTenantRow(row: TenantRow) {
  return {
    name: row.name as string,
    slug: row.slug as string,
    region: row.region as string,
    status: row.status as string,
    ledger: row.ledger_delta ?? "₦0",
    seats: typeof row.seats === "number" ? row.seats : 0,
    admin_email: (row as any).admin_email ?? null,
  };
}

async function generateUniqueTenantCode(sql: SqlClient, slug: string) {
  const base = slug.toUpperCase();
  let candidate = base;
  let counter = 1;

  // Try a bounded number of attempts to avoid infinite loops in pathological cases
  while (counter < 1000) {
    const existing = await sql`select 1 from tenants where code = ${candidate} limit 1`;
    if (Array.isArray(existing) && existing.length === 0) {
      return candidate;
    }

    candidate = `${base}-${counter}`;
    counter += 1;
  }

  throw new Error("Unable to generate unique tenant code after multiple attempts");
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
    const computedDomain = `${payload.companySlug}.syspro.local`;
    const computedSchema = `${payload.companySlug.replace(/-/g, "_")}_schema`;
    const sql = SQL;
    await ensureTenantTable(sql);
    const computedCode = await generateUniqueTenantCode(sql, payload.companySlug);

    const tenantId = randomUUID();
    const passwordHash = await bcrypt.hash(payload.adminPassword, 12);

    const tenantRes = await SQL`
      insert into tenants (
        id,
        name,
        slug,
        code,
        domain,
        "isActive",
        settings,
        "schemaName",
        region,
        industry,
        seats,
        admin_name,
        admin_email,
        admin_password_hash,
        admin_notes
      )
      values (
        ${tenantId},
        ${payload.companyName},
        ${payload.companySlug},
        ${computedCode},
        ${computedDomain},
        ${false},
        ${JSON.stringify({})},
        ${computedSchema},
        ${payload.region},
        ${payload.industry},
        ${payload.seats ?? null},
        ${payload.adminName},
        ${payload.adminEmail.toLowerCase()},
        ${passwordHash},
        ${payload.adminNotes ?? ""}
      )
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
      returning name, slug, region, status, ledger_delta, seats
    `;

    const tenantSummary = mapTenantRow(tenantRes.rows[0]);

    return NextResponse.json(
      {
        tenantId,
        tenantSummary,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Tenant creation failed", error);
    const message = error instanceof Error ? error.message : String(error);
    // Return the error message to the client to aid debugging (safe in dev).
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
