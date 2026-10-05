import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, sql as SQL, SqlClient } from "@/lib/sql-client";
import { ensureTenantTable } from "@/lib/tenant/tenant-table";
import fs from "fs";
import path from "path";
import { requireSuperAdmin } from "@/lib/api-auth";
import { getTableColumns } from "@/lib/schema-inspect";

export type TenantRow = {
  name: string;
  slug: string;
  region: string | null;
  status: string;
  ledger_delta: string;
  seats: number | null;
  admin_email?: string | null;
  default_region_id?: string | null;
  default_region_name?: string | null;
  default_branch_id?: string | null;
  default_branch_name?: string | null;
};

const payloadSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  companySlug: z
    .string()
    .min(2, "Tenant slug must be at least 2 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  region: z.string().min(2, "Region is required"),
  industry: z.string().min(2, "Industry is required"),
  industryProfiles: z.array(z.enum(["services", "trading", "manufacturing", "mixed"])).optional(),
  seats: z.number().int().positive().nullable().optional(),
  adminName: z.string().min(2, "Admin name must be at least 2 characters"),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8, "Admin password must be at least 8 characters"),
  adminNotes: z.string().optional().default(""),
  defaultRegionId: z.string().min(1).optional(),
  defaultRegionName: z.string().min(1).optional(),
  defaultBranchId: z.string().min(1).optional(),
  defaultBranchName: z.string().min(1).optional(),
});

export async function GET(request: NextRequest) {
    const _auth = await requireSuperAdmin(request);
    if (!_auth.ok) return _auth.response;

  try {
    const sql = SQL;
    
    try {
      await ensureTenantTable(sql);

      const rows = (await sql`
        select name, slug, region, status, ledger_delta, seats, admin_email,
               default_region_id, default_region_name, default_branch_id, default_branch_name,
               "isActive" as is_active, "schemaName" as schema_name
        from tenants
        where "deletedAt" is null
        order by "createdAt" desc nulls last
      `) as any[];

      return NextResponse.json({ tenants: rows.map(mapTenantRow) });
    } catch (dbError) {
      // In production the DB is the source of truth — fail loudly instead of
      // serving an empty/dev fallback that masks the outage.
      if (process.env.DATABASE_URL) {
        console.error("Tenant list query failed:", dbError);
        return NextResponse.json({ error: "Unable to fetch tenants" }, { status: 500 });
      }
      // Dev-only file-backed fallback for local development without a DB.
      console.warn("Database query failed, using file-backed fallback:", dbError);
      const devPath = path.join(process.cwd(), "dev-data");
      const file = path.join(devPath, "tenants.json");
      try {
        await fs.promises.mkdir(devPath, { recursive: true });
        const content = await fs.promises.readFile(file, "utf8").catch(() => "[]");
        const rows = JSON.parse(content || "[]");
        return NextResponse.json({ tenants: Array.isArray(rows) ? rows : [] });
      } catch (e) {
        console.error("Dev tenants fallback failed", e);
        return NextResponse.json({ tenants: [] });
      }
    }
  } catch (error) {
    console.error("Failed to fetch tenants", error);
    return NextResponse.json({ error: "Unable to fetch tenants" }, { status: 500 });
  }
}

export function mapTenantRow(row: TenantRow) {
  const fallbackRegionName = row.region || row.default_region_name || "Primary Region";
  const fallbackBranchName = row.default_branch_name || "Headquarters";
  return {
    name: row.name as string,
    slug: row.slug as string,
    region: row.region as string | null,
    status: (row as any).status as string,
    ledger: (row as any).ledger_delta ?? "₦0",
    seats: typeof (row as any).seats === "number" ? (row as any).seats : 0,
    admin_email: (row as any).admin_email ?? null,
    default_region_id: row.default_region_id ?? null,
    default_region_name: row.default_region_name ?? fallbackRegionName,
    default_branch_id: row.default_branch_id ?? null,
    default_branch_name: fallbackBranchName,
    // Consider a tenant persisted if it has an active flag OR a schema name.
    // Use logical OR because `is_active` can be `false` while a created
    // `schema_name` still indicates persistence (previous code used ??
    // which preferred `false` over the schema name).
    persisted: !!((row as any).is_active || (row as any).schema_name),
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
    const _auth = await requireSuperAdmin(request);
    if (!_auth.ok) return _auth.response;

  try {
    const rawBody = await request.text();
    if (!rawBody) {
      return NextResponse.json({ error: "Request body cannot be empty" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.error("Tenant payload JSON parse failed", parseError);
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const parsed = payloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const payload = parsed.data;
    const computedDomain = `${payload.companySlug}.pisairtel.local`;
    const computedSchema = `${payload.companySlug.replace(/-/g, "_")}_schema`;
    const defaultRegionId = payload.defaultRegionId || `${payload.companySlug}-region-default`;
    const defaultRegionName = payload.defaultRegionName || payload.region;
    const defaultBranchId = payload.defaultBranchId || `${payload.companySlug}-branch-hq`;
    const defaultBranchName = payload.defaultBranchName || "Headquarters";
    // If no DATABASE_URL, persist tenants to a local dev JSON file so they
    // survive page refreshes during development.
    if (!process.env.DATABASE_URL) {
      const devPath = path.join(process.cwd(), "dev-data");
      const file = path.join(devPath, "tenants.json");
      await fs.promises.mkdir(devPath, { recursive: true });
      const current = await fs.promises.readFile(file, "utf8").catch(() => "[]");
      const arr = Array.isArray(JSON.parse(current || "[]")) ? JSON.parse(current || "[]") : [];

      // Upsert by slug
      const existingIndex = arr.findIndex((t: any) => t.slug === payload.companySlug);
      const tenantId = randomUUID();
      const passwordHash = await bcrypt.hash(payload.adminPassword, 12);

      const tenantSummary = {
        name: payload.companyName,
        slug: payload.companySlug,
        region: payload.region,
        status: "active",
        ledger: "₦0",
        seats: payload.seats ?? 0,
        admin_email: payload.adminEmail.toLowerCase(),
        default_region_id: defaultRegionId,
        default_region_name: defaultRegionName,
        default_branch_id: defaultBranchId,
        default_branch_name: defaultBranchName,
        persisted: true,
      };

      if (existingIndex >= 0) {
        arr[existingIndex] = tenantSummary;
      } else {
        arr.unshift(tenantSummary);
      }

      await fs.promises.writeFile(file, JSON.stringify(arr, null, 2), "utf8");

      return NextResponse.json({ tenantId, tenantSummary }, { status: 201 });
    }

    const sql = SQL;
    await ensureTenantTable(sql);
    const computedCode = await generateUniqueTenantCode(sql, payload.companySlug);

    const passwordHash = await bcrypt.hash(payload.adminPassword, 12);

    const tenantCols = await getTableColumns("tenants");
    const tenantValues: Record<string, unknown> = {
      name: payload.companyName,
      slug: payload.companySlug,
      code: computedCode,
      domain: computedDomain,
      "isActive": false,
      settings: JSON.stringify({ industryProfiles: payload.industryProfiles ?? [] }),
      "schemaName": computedSchema,
      region: payload.region,
      industry: payload.industry,
      seats: payload.seats ?? null,
      admin_name: payload.adminName,
      admin_email: payload.adminEmail.toLowerCase(),
      admin_password_hash: passwordHash,
      admin_notes: payload.adminNotes ?? "",
      default_region_id: defaultRegionId,
      default_region_name: defaultRegionName,
      default_branch_id: defaultBranchId,
      default_branch_name: defaultBranchName,
      industry_profiles: JSON.stringify(payload.industryProfiles ?? []),
    };
    if (tenantCols.get("id")?.dataType === "uuid") tenantValues.id = randomUUID();

    const existing = await SQL`select id from tenants where slug = ${payload.companySlug} limit 1`;

    let tenantId: unknown;
    let returnedRows: any[];
    if (existing.length > 0) {
      tenantId = existing[0].id;
      const entries = Object.entries(tenantValues).filter(([c]) => c !== "id" && tenantCols.has(c));
      const setList = entries.map(([c], i) => `"${c}" = $${i + 2}`).join(", ");
      const params = [payload.companySlug, ...entries.map(([, v]) => v)];
      const res = await db.query<any>(
        `update tenants set ${setList}, "updatedAt" = now() where slug = $1 returning *`,
        params
      );
      returnedRows = res.rows;
    } else {
      const entries = Object.entries(tenantValues).filter(([c]) => tenantCols.has(c));
      const colList = entries.map(([c]) => `"${c}"`).join(", ");
      const placeholders = entries.map((_, i) => `$${i + 1}`).join(", ");
      const res = await db.query<any>(
        `insert into tenants (${colList}) values (${placeholders}) returning *`,
        entries.map(([, v]) => v)
      );
      returnedRows = res.rows;
      tenantId = returnedRows[0]?.id;
    }

    const tenantSummary = mapTenantRow(returnedRows[0]);

    // Also upsert a tenant_admins row so the admin can log in immediately
    const adminCols = await getTableColumns("tenant_admins");
    const adminValues: Record<string, unknown> = {
      tenant_id: tenantId,
      email: payload.adminEmail.toLowerCase(),
      name: payload.adminName,
      role: "admin",
      password_hash: passwordHash,
      tenant_slug: payload.companySlug,
    };
    const existingAdmin = await SQL`
      select 1 from tenant_admins where tenant_id = ${tenantId as string} and email = ${payload.adminEmail.toLowerCase()} limit 1
    `;
    if (existingAdmin.length === 0) {
      const entries = Object.entries(adminValues).filter(([c]) => adminCols.has(c));
      const colList = entries.map(([c]) => `"${c}"`).join(", ");
      const placeholders = entries.map((_, i) => `$${i + 1}`).join(", ");
      await db.query(
        `insert into tenant_admins (${colList}) values (${placeholders})`,
        entries.map(([, v]) => v)
      );
    }

    return NextResponse.json(
      {
        tenantId,
        tenantSummary,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Tenant creation failed", error);
    return NextResponse.json({ error: "Failed to create tenant" }, { status: 500 });
  }
}
