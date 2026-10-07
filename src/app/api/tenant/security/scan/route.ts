import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  validateTenantContext,
  errorResponse,
  handleTenantAdminError,
  checkRateLimit,
} from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";
import { sql as SQL } from "@/lib/sql-client";
import { ensureTenantTable } from "@/lib/tenant/tenant-table";
import { setupTenantAdminSchema } from "@/lib/tenant-admin/schema";

export const dynamic = "force-dynamic";

/**
 * POST /api/tenant/security/scan?tenantSlug=
 * Runs a lightweight security posture scan for the tenant: checks how many
 * policies are enabled, whether MFA is enforced, and how many failed logins
 * were recorded recently. Results are stored in tenant_security_settings and
 * an audit-log entry is written.
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const _gate1 = await requireModuleGate(request, "admin", "write");
    if (_gate1) return _gate1;

    if (!checkRateLimit(`sec-scan-${context.tenantSlug}`, 5, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    await ensureTenantTable(SQL);
    await setupTenantAdminSchema(SQL);

    const [policyRows, failedRows, settingsRows] = await Promise.all([
      SQL`
        select count(*)::int as total,
               count(*) filter (where is_active)::int as enabled
        from admin_security_policies where tenant_slug = ${context.tenantSlug}
      `,
      SQL`
        select count(*)::int as failed
        from admin_audit_logs
        where tenant_slug = ${context.tenantSlug}
          and (action = 'login_failed' or changes->>'status' = 'failure')
          and created_at > now() - interval '7 days'
      `,
      SQL`
        select mfa_settings, security_metrics from tenant_security_settings
        where tenant_slug = ${context.tenantSlug}
        limit 1
      `,
    ]);

    const disabledPolicies = Math.max(
      0,
      (policyRows[0]?.total ?? 0) - (policyRows[0]?.enabled ?? 0)
    );
    const mfa = settingsRows[0]?.mfa_settings
      ? typeof settingsRows[0].mfa_settings === "string"
        ? JSON.parse(settingsRows[0].mfa_settings)
        : settingsRows[0].mfa_settings
      : {};
    const mfaOptional = mfa.enforcement !== "required" ? 1 : 0;
    const recentFailures = failedRows[0]?.failed ?? 0;

    const vulnerabilities = disabledPolicies + mfaOptional + (recentFailures > 10 ? 1 : 0);
    const scanAt = new Date().toISOString();
    const metrics = {
      ...(settingsRows[0]?.security_metrics
        ? typeof settingsRows[0].security_metrics === "string"
          ? JSON.parse(settingsRows[0].security_metrics)
          : settingsRows[0].security_metrics
        : {}),
      lastSecurityScan: scanAt,
      vulnerabilities,
    };

    await SQL`
      insert into tenant_security_settings (tenant_slug, security_metrics, updated_at)
      values (${context.tenantSlug}, ${JSON.stringify(metrics)}, now())
      on conflict (tenant_slug) do update set
        security_metrics = ${JSON.stringify(metrics)}::jsonb,
        updated_at = now()
    `;

    await SQL`
      insert into admin_audit_logs (id, tenant_slug, user_id, action, resource, resource_id, changes, ip_address, created_at)
      values (${randomUUID()}, ${context.tenantSlug}, ${context.userId}, 'security_scan', 'tenant',
              ${context.tenantSlug},
              ${JSON.stringify({
                status: "success",
                details: `Scan complete — ${vulnerabilities} finding${vulnerabilities === 1 ? "" : "s"}`,
                findings: { disabledPolicies, mfaOptional, recentFailures },
              })},
              ${request.headers.get("x-forwarded-for") || null}, now())
    `;

    return NextResponse.json({
      success: true,
      data: {
        completedAt: scanAt,
        vulnerabilities,
        findings: { disabledPolicies, mfaOptional, recentFailures },
      },
      message: "Security scan completed",
    });
  } catch (error) {
    console.error("Security scan error:", error);
    return handleTenantAdminError(error);
  }
}
