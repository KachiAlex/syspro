export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql as SQL } from "@/lib/sql-client";
import bcrypt from "bcryptjs";
import { checkRateLimitAsync, getRateLimitKey } from "@/lib/rate-limit";
import { ensureTenantTable } from "@/lib/tenant/tenant-table";

/**
 * POST /api/auth/reset-password
 * Validates a tenant-admin reset token and sets a new password.
 */
export async function POST(request: NextRequest) {
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
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: "token and newPassword are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    await ensureTenantTable(SQL);

    const tokens = await SQL`
      select id, admin_id from tenant_admin_password_reset_tokens
      where token = ${token}
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
    const hashed = await bcrypt.hash(newPassword, 12);

    await SQL`
      update tenant_admins
      set password_hash = ${hashed}, updated_at = now()
      where id = ${resetToken.admin_id}
    `;

    await SQL`
      update tenant_admin_password_reset_tokens
      set used = true, used_at = now()
      where id = ${resetToken.id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
