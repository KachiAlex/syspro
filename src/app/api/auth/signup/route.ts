import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { sql as SQL } from "@/lib/sql-client";
import { ensureTenantTable } from "@/lib/tenant/tenant-table";
import { signSession } from "@/lib/session";
import { checkRateLimitAsync, getRateLimitKey } from "@/lib/rate-limit";

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

    const tenantId = randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);
    const computedCode = await generateUniqueTenantCode(slug);
    const computedDomain = `${slug}.pisairtel.local`;
    const computedSchema = `${slug.replace(/-/g, "_")}_schema`;
    const defaultRegionId = `${slug}-region-default`;
    const defaultBranchId = `${slug}-branch-hq`;

    await SQL`
      insert into tenants (
        id, name, slug, code, domain, "isActive", status, settings,
        "schemaName", seats,
        admin_name, admin_email, admin_password_hash,
        default_region_id, default_region_name,
        default_branch_id, default_branch_name,
        industry_profiles
      )
      values (
        ${tenantId},
        ${companyName},
        ${slug},
        ${computedCode},
        ${computedDomain},
        ${true},
        ${"Active"},
        ${JSON.stringify({})},
        ${computedSchema},
        ${5},
        ${adminName},
        ${lowerEmail},
        ${passwordHash},
        ${defaultRegionId},
        ${"Primary Region"},
        ${defaultBranchId},
        ${"Headquarters"},
        ${JSON.stringify([])}
      )
    `;

    const adminRows = await SQL`
      insert into tenant_admins (tenant_id, tenant_slug, email, name, role, password_hash)
      values (${tenantId}, ${slug}, ${lowerEmail}, ${adminName}, 'admin', ${passwordHash})
      returning id
    `;
    const adminId = String(adminRows[0]?.id ?? tenantId);

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
