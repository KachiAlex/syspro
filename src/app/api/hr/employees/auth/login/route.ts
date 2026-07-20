import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authenticateEmployee, createEmployeeToken } from "@/lib/hr/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

export async function GET() {
  return NextResponse.json({ status: "ok", message: "Employee login API is available." });
}

export async function POST(request: NextRequest) {
  // Rate limit: 5 login attempts per minute per IP
  const rateKey = `emp-login:${getRateLimitKey(request)}`;
  const { allowed, retryAfter } = checkRateLimit(rateKey, 5, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: `Too many login attempts. Try again in ${retryAfter}s.` },
      { status: 429, headers: { "Retry-After": retryAfter.toString() } }
    );
  }

  try {
    const body = await request.json();
    const { tenantSlug, email, password } = body;

    if (!tenantSlug || !email || !password) {
      return NextResponse.json(
        { error: "tenantSlug, email, and password are required" },
        { status: 400 }
      );
    }

    const session = await authenticateEmployee(tenantSlug, email, password);

    if (!session) {
      return NextResponse.json(
        { error: "Invalid credentials or account not activated" },
        { status: 401 }
      );
    }

    // Set secure session cookie
    const token = createEmployeeToken(session);
    const cookieStore = await cookies();
    cookieStore.set("employee_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 12, // 12 hours
      path: "/",
    });

    // Also set a non-httpOnly cookie for client-side access to basic info
    cookieStore.set("employee_tenant", session.tenantSlug, {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 12,
      path: "/",
    });

    return NextResponse.json({
      success: true,
      user: {
        id: session.id,
        name: session.name,
        email: session.email,
        role: session.role,
        departmentId: session.departmentId,
        jobTitle: session.jobTitle,
      },
    });
  } catch (error) {
    console.error("Employee login error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
