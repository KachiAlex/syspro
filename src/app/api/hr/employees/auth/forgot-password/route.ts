import { NextRequest, NextResponse } from "next/server";
import { sql as SQL } from "@/lib/sql-client";
import { randomBytes } from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimitAsync, getRateLimitKey } from "@/lib/rate-limit";

/**
 * POST /api/hr/employees/auth/forgot-password
 * Generates a reset token and sends a reset email.
 */
export async function POST(request: NextRequest) {
  // Rate limit: 3 requests per 5 minutes per IP
  const rateKey = `forgot-pw:${getRateLimitKey(request)}`;
  const { allowed, retryAfter } = await checkRateLimitAsync(rateKey, 3, 300_000);
  if (!allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${retryAfter}s.` },
      { status: 429, headers: { "Retry-After": retryAfter.toString() } }
    );
  }

  try {
    const body = await request.json();
    const { tenantSlug, email } = body;

    if (!tenantSlug || !email) {
      return NextResponse.json(
        { error: "tenantSlug and email are required" },
        { status: 400 }
      );
    }

    // Find the employee
    const employees = await SQL`
      select id, name, email from admin_employees
      where tenant_slug = ${tenantSlug} and email = ${email.toLowerCase()} and status = 'active'
      limit 1
    `;

    // Always return success to prevent email enumeration
    if (!employees || employees.length === 0) {
      return NextResponse.json({ success: true });
    }

    const employee = employees[0];

    // Generate a secure token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Store the token
    await SQL`
      insert into admin_password_reset_tokens (tenant_slug, employee_id, token, expires_at, used, created_at)
      values (${tenantSlug}, ${employee.id}, ${token}, ${expiresAt}, false, now())
    `;

    // Build reset URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const resetUrl = `${appUrl}/employee/reset-password?token=${token}&tenant=${tenantSlug}`;

    // Send email
    await sendPasswordResetEmail(employee.email, employee.name, resetUrl);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
