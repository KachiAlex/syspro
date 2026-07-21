import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { signSession } from "@/lib/session";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { sql as SQL } from "@/lib/sql-client";
import { authenticateEmployee, createEmployeeToken } from "@/lib/hr/auth";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  // Rate limit: 5 login attempts per minute per IP
  const rateKey = `tenant-login:${getRateLimitKey(request)}`;
  const { allowed, retryAfter } = checkRateLimit(rateKey, 5, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: `Too many login attempts. Try again in ${retryAfter}s.` },
      { status: 429, headers: { "Retry-After": retryAfter.toString() } }
    );
  }

  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const sql = SQL;

    // Look up tenant admin by email in tenant_admins table
    const adminRows = await sql`
      SELECT ta.id, ta.email, ta.name, ta.password_hash, ta.role, ta.tenant_id,
             t.slug as tenant_slug, t.name as tenant_name
      FROM tenant_admins ta
      JOIN tenants t ON t.id = ta.tenant_id
      WHERE ta.email = ${email.toLowerCase()}
      LIMIT 1
    `;

    if (adminRows.length === 0) {
      // Fallback: try employee login
      // First, find the employee to get their tenant_slug
      const empRows = await sql`
        SELECT tenant_slug FROM admin_employees
        WHERE email = ${email.toLowerCase()} AND is_portal_active = true
        LIMIT 1
      `;

      if (empRows.length > 0) {
        const empTenantSlug = (empRows[0] as any).tenant_slug;
        const session = await authenticateEmployee(empTenantSlug, email.toLowerCase(), password);

        if (session) {
          const token = createEmployeeToken(session);
          const maxAge = 60 * 60 * 12; // 12 hours

          const response = NextResponse.json({
            success: true,
            tenantSlug: session.tenantSlug,
            isEmployee: true,
            user: {
              id: session.id,
              email: session.email,
              name: session.name,
              role: session.role,
            },
          });
          response.cookies.set("employee_session", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge,
            path: "/",
          });
          response.cookies.set("employee_tenant", session.tenantSlug, {
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge,
            path: "/",
          });
          return response;
        }
      }

      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const admin = adminRows[0] as any;

    // Verify password if hash exists
    if (admin.password_hash) {
      const isValid = await bcrypt.compare(password, admin.password_hash);
      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid credentials" },
          { status: 401 }
        );
      }
    } else {
      // No password hash set yet — reject in production, allow in dev
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { error: "Password not set for this account. Please contact your superadmin." },
          { status: 403 }
        );
      }
    }

    const tenantSlug = admin.tenant_slug;
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds

    const payload = {
      id: String(admin.id),
      email: admin.email,
      name: admin.name,
      tenantSlug,
      roleId: admin.role || "admin",
      iat: now,
      exp: now + maxAge * 1000,
    };

    const token = signSession(payload);

    const cookieStore = await cookies();
    cookieStore.set("syspro_session", token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge,
    });
    cookieStore.set("tenantSlug", tenantSlug, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge,
    });
    cookieStore.set("X-User-Id", String(admin.id), {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge,
    });
    cookieStore.set("X-User-Email", encodeURIComponent(email), {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge,
    });
    cookieStore.set("X-Role-Id", admin.role || "admin", {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge,
    });

    return NextResponse.json({
      success: true,
      tenantSlug,
      user: { id: String(admin.id), email: admin.email, name: admin.name, roleId: admin.role || "admin" },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
