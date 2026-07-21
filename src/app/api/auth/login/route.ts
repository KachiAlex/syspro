import { NextRequest, NextResponse } from "next/server";
import { signSession } from "@/lib/session";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { sql as SQL } from "@/lib/sql-client";
import { authenticateEmployee, createEmployeeToken } from "@/lib/hr/auth";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  const rateKey = `login:${getRateLimitKey(request)}`;
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
    const lowerEmail = email.toLowerCase();

    // ── 1. Try tenant admin ──
    const adminRows = await sql`
      SELECT ta.id, ta.email, ta.name, ta.password_hash, ta.role, ta.tenant_id,
             t.slug as tenant_slug
      FROM tenant_admins ta
      JOIN tenants t ON t.id = ta.tenant_id
      WHERE ta.email = ${lowerEmail}
      LIMIT 1
    `;

    if (adminRows.length > 0) {
      const admin = adminRows[0] as any;

      if (admin.password_hash) {
        const isValid = await bcrypt.compare(password, admin.password_hash);
        if (!isValid) {
          return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }
      } else if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { error: "Password not set for this account. Please contact your superadmin." },
          { status: 403 }
        );
      }

      const tenantSlug = admin.tenant_slug;
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60;

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

      const response = NextResponse.json({
        success: true,
        role: "tenant_admin",
        tenantSlug,
        user: { id: String(admin.id), email: admin.email, name: admin.name, roleId: admin.role || "admin" },
      });

      const cookieOpts = { httpOnly: true, path: "/", sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", maxAge };
      response.cookies.set("syspro_session", token, cookieOpts);
      response.cookies.set("tenantSlug", tenantSlug, { ...cookieOpts, httpOnly: false });
      response.cookies.set("X-User-Id", String(admin.id), { ...cookieOpts, httpOnly: false });
      response.cookies.set("X-User-Email", encodeURIComponent(email), { ...cookieOpts, httpOnly: false });
      response.cookies.set("X-Role-Id", admin.role || "admin", { ...cookieOpts, httpOnly: false });

      return response;
    }

    // ── 2. Try employee ──
    const empRows = await sql`
      SELECT tenant_slug FROM admin_employees
      WHERE email = ${lowerEmail} AND is_portal_active = true
      LIMIT 1
    `;

    if (empRows.length > 0) {
      const empTenantSlug = (empRows[0] as any).tenant_slug;
      const session = await authenticateEmployee(empTenantSlug, lowerEmail, password);

      if (session) {
        const token = createEmployeeToken(session);
        const maxAge = 60 * 60 * 12;

        const response = NextResponse.json({
          success: true,
          role: "employee",
          tenantSlug: session.tenantSlug,
          token,
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

    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
