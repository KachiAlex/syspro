import { NextRequest, NextResponse } from "next/server";
import { sql as SQL } from "@/lib/sql-client";
import { hashPassword } from "@/lib/hr/auth";
import { checkRateLimitAsync, getRateLimitKey } from "@/lib/rate-limit";

/**
 * POST /api/hr/employees/auth/reset-password
 * Validates a reset token and sets a new password.
 */
export async function POST(request: NextRequest) {
  // Rate limit: 5 requests per 5 minutes per IP
  const rateKey = `reset-pw:${getRateLimitKey(request)}`;
  const { allowed, retryAfter } = await checkRateLimitAsync(rateKey, 5, 300_000);
  if (!allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${retryAfter}s.` },
      { status: 429, headers: { "Retry-After": retryAfter.toString() } }
    );
  }

  try {
    const body = await request.json();
    const { token, tenantSlug, newPassword } = body;

    if (!token || !tenantSlug || !newPassword) {
      return NextResponse.json(
        { error: "token, tenantSlug, and newPassword are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Find a valid, unused, non-expired token
    const tokens = await SQL`
      select id, employee_id from admin_password_reset_tokens
      where tenant_slug = ${tenantSlug}
        and token = ${token}
        and used = false
        and expires_at > now()
      limit 1
    `;

    if (!tokens || tokens.length === 0) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 }
      );
    }

    const resetToken = tokens[0];

    // Hash the new password
    const hashed = await hashPassword(newPassword);

    // Update the employee's password
    await SQL`
      update admin_employees
      set password_hash = ${hashed}, updated_at = now()
      where id = ${resetToken.employee_id} and tenant_slug = ${tenantSlug}
    `;

    // Mark token as used
    await SQL`
      update admin_password_reset_tokens
      set used = true, used_at = now()
      where id = ${resetToken.id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
