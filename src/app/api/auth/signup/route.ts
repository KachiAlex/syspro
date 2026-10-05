import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, sql as SQL } from "@/lib/sql-client";
import { ensureTenantTable } from "@/lib/tenant/tenant-table";
import { signSession } from "@/lib/session";
import { checkRateLimitAsync, getRateLimitKey } from "@/lib/rate-limit";
import { getTableColumns, insertRow } from "@/lib/schema-inspect";

const signupSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  slug: z
    .string()
    .min(2, "Workspace name must be at least 2 characters")
    .max(48)
    .regex(/^[a-z0-9-]+$/, "Workspace URL can only contain lowercase letters, numbers, and hyphens"),
  adminName: z.string().min(2, "Your name must be at least 2 characters"),
  adminEmail: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

async function generateUniqueTenantCode(slug: string) {
  const base = slug.toUpperCase();
  let candidate = base;
  let counter = 1;
  while (counter < 1000) {
    const existing = await SQL`select 1 from tenants where code = ${candidate} limit 1`;
    if (Array.isArray(existing) && existing.length === 0) {
      return candidate;
    }
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  throw new Error("Unable to generate unique tenant code");
}

export async function POST(request: NextRequest) {
  const rateKey = `signup:${getRateLimitKey(request)}`;
  const { allowed, retryAfter } = await checkRateLimitAsync(rateKey, 5, 60 * 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: `Too many signup attempts. Try again in ${retryAfter}s.` },
      { status: 429, headers: { "Retry-After": retryAfter.toString() } }
    );
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Signup is unavailable in this environment." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { companyName, slug, adminName, adminEmail, password } = parsed.data;
    const lowerEmail = adminEmail.toLowerCase();

    await ensureTenantTable(SQL);

    // Reject slug conflicts outright — unlike the superadmin route, a public
    // endpoint must never update an existing tenant's row.
    const slugTaken = await SQL`select 1 from tenants where slug = ${slug} limit 1`;
    if (slugTaken.length > 0) {
      return NextResponse.json(
        { error: "That workspace URL is already taken. Please choose another." },
        { status: 409 }
      );
    }

    // Login resolves an email to a single tenant_admin row, so the same email
    // cannot be reused across workspaces.
    const emailTaken = await SQL`select 1 from tenant_admins where email = ${lowerEmail} limit 1`;
    if (emailTaken.length > 0) {
      return NextResponse.json(
        { error: "An account with this email already exists. Try signing in instead." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const tenantCols = await getTableColumns("tenants");
    const tenantIdIsUuid = tenantCols.get("id")?.dataType === "uuid";

    const tenantValues: Record<string, unknown> = {
      name: companyName,
      slug,
      "isActive": true,
      status: "Active",
      settings: JSON.stringify({}),
      seats: 3,
      admin_name: adminName,
      admin_email: lowerEmail,
      admin_password_hash: passwordHash,
      default_region_id: `${slug}-region-default`,
      default_region_name: "Primary Region",
      default_branch_id: `${slug}-branch-hq`,
      default_branch_name: "Headquarters",
      industry_profiles: JSON.stringify([]),
    };
    if (tenantIdIsUuid) tenantValues.id = randomUUID();
    if (tenantCols.has("code")) tenantValues.code = await generateUniqueTenantCode(slug);
    if (tenantCols.has("domain")) tenantValues.domain = `${slug}.pisairtel.local`;
    if (tenantCols.has("schemaName")) tenantValues.schemaName = `${slug.replace(/-/g, "_")}_schema`;

    const { row: tenantRow } = await insertRow("tenants", tenantValues);
    const tenantId = tenantRow.id;

    const adminCols = await getTableColumns("tenant_admins");
    const adminValues: Record<string, unknown> = {
      tenant_id: tenantId,
      email: lowerEmail,
      name: adminName,
      role: "admin",
      password_hash: passwordHash,
    };
    if (adminCols.has("tenant_slug")) adminValues.tenant_slug = slug;

    const { row: adminRow } = await insertRow("tenant_admins", adminValues);
    const adminId = String(adminRow?.id ?? tenantId);

    // Auto-login: same session shape and cookie set as /api/auth/login.
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60;
    const token = signSession({
      id: adminId,
      email: lowerEmail,
      name: adminName,
      tenantSlug: slug,
      roleId: "admin",
      iat: now,
      exp: now + maxAge * 1000,
    });

    const response = NextResponse.json(
      { success: true, tenantSlug: slug },
      { status: 201 }
    );

    const cookieOpts = { httpOnly: true, path: "/", sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", maxAge };
    response.cookies.set("pisairtel_session", token, cookieOpts);
    response.cookies.set("tenantSlug", slug, { ...cookieOpts, httpOnly: false });
    response.cookies.set("X-User-Id", adminId, { ...cookieOpts, httpOnly: false });
    response.cookies.set("X-User-Email", encodeURIComponent(lowerEmail), { ...cookieOpts, httpOnly: false });
    response.cookies.set("X-Role-Id", "admin", { ...cookieOpts, httpOnly: false });
    response.cookies.set("employee_session", "", { path: "/", maxAge: 0 });

    return response;
  } catch (error: any) {
    // Unique-violation: slug raced past the pre-check, or email collided.
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "That workspace URL or email is already taken." },
        { status: 409 }
      );
    }
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Signup failed. Please try again." }, { status: 500 });
  }
}
