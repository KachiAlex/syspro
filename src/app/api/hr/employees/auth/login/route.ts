import { NextRequest, NextResponse } from "next/server";
import { authenticateEmployee, createEmployeeToken } from "@/lib/hr/auth";
import { checkRateLimitAsync, getRateLimitKey } from "@/lib/rate-limit";

export async function GET() {
  return NextResponse.json({ status: "ok", message: "Employee login API is available." });
}

export async function POST(request: NextRequest) {
  const rateKey = `emp-login:${getRateLimitKey(request)}`;
  const { allowed, retryAfter } = await checkRateLimitAsync(rateKey, 5, 60_000);
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

    const token = createEmployeeToken(session);
    const maxAge = 60 * 60 * 12;

    const response = NextResponse.json({
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
  } catch (error) {
    console.error("Employee login error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
