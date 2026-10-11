export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql as SQL } from "@/lib/sql-client";
import { randomBytes } from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimitAsync, getRateLimitKey } from "@/lib/rate-limit";
import { ensureTenantTable } from "@/lib/tenant/tenant-table";

/**
 * POST /api/auth/forgot-password
 * Unified reset entry point: tenant admins first, then employee portal accounts.
 * Always returns success to prevent account enumeration.
 */
export async function POST(request: NextRequest) {
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
    const { email, tenantSlug } = body;

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    await ensureTenantTable(SQL);
    const lowerEmail = String(email).toLowerCase();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // ── 1. Tenant admin ──
    const admins = await SQL`
      select id, email, name from tenant_admins
      where lower(email) = ${lowerEmail}
      limit 1
    `;

    if (admins && admins.length > 0) {
      const admin = admins[0];
      await SQL`
        insert into tenant_admin_password_reset_tokens (admin_id, email, token, expires_at, used, created_at)
        values (${admin.id}, ${lowerEmail}, ${token}, ${expiresAt}, false, now())
      `;
      const resetUrl = `${appUrl}/reset-password?token=${token}`;
      const sendResult = await sendPasswordResetEmail(admin.email, admin.name, resetUrl);
      if (!sendResult.success) {
        console.error("Password reset email failed:", sendResult.error);
      }
      return NextResponse.json({ success: true });
    }

    // ── 2. Employee portal account ──
    const employees = tenantSlug
      ? await SQL`
          select id, name, email, tenant_slug from admin_employees
          where lower(email) = ${lowerEmail} and tenant_slug = ${tenantSlug} and status = 'active'
          limit 1
        `
      : await SQL`
          select id, name, email, tenant_slug from admin_employees
          where lower(email) = ${lowerEmail} and status = 'active' and is_portal_active = true
          limit 1
        `;

    if (employees && employees.length > 0) {
      const employee = employees[0];
      await SQL`
        insert into admin_password_reset_tokens (tenant_slug, employee_id, token, expires_at, used, created_at)
        values (${employee.tenant_slug}, ${employee.id}, ${token}, ${expiresAt}, false, now())
      `;
      const resetUrl = `${appUrl}/employee/reset-password?token=${token}&tenant=${employee.tenant_slug}`;
      const sendResult = await sendPasswordResetEmail(employee.email, employee.name, resetUrl);
      if (!sendResult.success) {
        console.error("Password reset email failed:", sendResult.error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
