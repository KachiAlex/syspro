import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { signSession } from "@/lib/session";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

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

    // TODO: Replace with real DB-backed authentication.
    // For now, derive a dev user from the email domain.
    // In production, validate against admin_employees or a tenant_admins table.
    const isDev = process.env.NODE_ENV !== "production";

    if (!isDev) {
      // In production, we need real credential validation.
      // For now, reject — until a proper auth table is in place.
      return NextResponse.json(
        { error: "Server-side authentication not yet configured for production" },
        { status: 501 }
      );
    }

    const devId = "dev-user-" + Date.now();
    const derivedTenant = email.split("@")[1]?.replace(/\./g, "-") || "unknown";
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds

    const payload = {
      id: devId,
      email,
      name: email.split("@")[0],
      tenantSlug: derivedTenant,
      roleId: "admin",
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
    cookieStore.set("tenantSlug", derivedTenant, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge,
    });
    cookieStore.set("X-User-Id", devId, {
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
    cookieStore.set("X-Role-Id", "admin", {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge,
    });

    return NextResponse.json({
      success: true,
      tenantSlug: derivedTenant,
      user: { id: devId, email, name: payload.name, roleId: "admin" },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
