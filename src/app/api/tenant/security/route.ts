import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  validateTenantContext,
  parseJsonRequest,
  errorResponse,
  handleTenantAdminError,
  checkRateLimit,
} from "@/lib/tenant-admin/utils";
import { sql as SQL } from "@/lib/sql-client";
import { ensureTenantTable } from "@/lib/tenant/tenant-table";
import { setupTenantAdminSchema } from "@/lib/tenant-admin/schema";
import { z } from "zod";

export const dynamic = "force-dynamic";

const SecurityPolicySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  enabled: z.boolean().default(true),
  rules: z.record(z.any()).optional(),
});

const MfaUpdateSchema = z.object({
  mfaUpdates: z.object({
    enforcement: z.enum(["optional", "required"]).optional(),
    methods: z.array(z.string()).optional(),
  }),
});

const DEFAULT_POLICIES: Array<{
  name: string;
  description: string;
  severity: string;
}> = [
  {
    name: "Password Policy",
    description: "Require strong passwords (min 8 characters) for all user accounts",
    severity: "high",
  },
  {
    name: "Session Timeout",
    description: "Automatically expire inactive sessions after 12 hours",
    severity: "medium",
  },
  {
    name: "Failed Login Lockout",
    description: "Temporarily lock accounts after repeated failed login attempts",
    severity: "high",
  },
  {
    name: "Audit Logging",
    description: "Record administrative actions for review",
    severity: "low",
  },
];

const TIME_RANGES: Record<string, string> = {
  "1h": "1 hour",
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
};

async function ensureSecurityData(tenantSlug: string) {
  await ensureTenantTable(SQL);
  await setupTenantAdminSchema(SQL);

  // Seed sensible default policies the first time a tenant opens this page.
  const existing = await SQL`
    select count(*)::int as count from admin_security_policies where tenant_slug = ${tenantSlug}
  `;
  if (!existing[0] || existing[0].count === 0) {
    for (const policy of DEFAULT_POLICIES) {
      await SQL`
        insert into admin_security_policies (id, tenant_slug, name, description, rules, is_active)
        values (${`sec-${randomUUID()}`}, ${tenantSlug}, ${policy.name}, ${policy.description},
                ${JSON.stringify({ severity: policy.severity })}, true)
        on conflict (id) do nothing
      `;
    }
  }
}

function mapPolicy(row: any) {
  const rules = typeof row.rules === "string" ? JSON.parse(row.rules || "{}") : row.rules || {};
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    enabled: row.is_active,
    severity: rules.severity || "medium",
    lastModified: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function mapLog(row: any) {
  const changes = typeof row.changes === "string" ? JSON.parse(row.changes || "{}") : row.changes || {};
  return {
    id: row.id,
    actor: row.actor || row.user_id || "system",
    action: row.action,
    resource: row.resource,
    timestamp: row.created_at ? new Date(row.created_at).toISOString() : null,
    status: changes.status || "success",
    details: changes.details || row.resource_id || undefined,
    ipAddress: row.ip_address || undefined,
    userAgent: row.user_agent || undefined,
  };
}

/**
 * GET /api/tenant/security?tenantSlug=&limit=&timeRange=
 * Returns audit logs, MFA settings, security metrics, and security policies.
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`sec-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    await ensureSecurityData(context.tenantSlug);

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 500);
    const interval = TIME_RANGES[url.searchParams.get("timeRange") || "24h"] || "24 hours";

    const [logs, policies, settingsRows, metricRows, userRows] = await Promise.all([
      SQL`
        select id, user_id, action, resource, resource_id, changes, ip_address, user_agent, created_at
        from admin_audit_logs
        where tenant_slug = ${context.tenantSlug}
          and created_at > now() - ${interval}::interval
        order by created_at desc
        limit ${limit}
      `,
      SQL`
        select * from admin_security_policies
        where tenant_slug = ${context.tenantSlug}
        order by created_at asc
      `,
      SQL`
        select mfa_settings, security_metrics from tenant_security_settings
        where tenant_slug = ${context.tenantSlug}
        limit 1
      `,
      SQL`
        select
          count(*) filter (where action = 'login')::int as total_logins,
          count(*) filter (where action = 'login_failed' or changes->>'status' = 'failure')::int as failed_logins,
          count(*) filter (where action = 'account_locked')::int as blocked_attempts
        from admin_audit_logs
        where tenant_slug = ${context.tenantSlug}
          and created_at > now() - ${interval}::interval
      `,
      SQL`
        select
          (select count(*) from tenant_admins where tenant_slug = ${context.tenantSlug}) +
          (select count(*) from admin_employees where tenant_slug = ${context.tenantSlug}) as total_users
      `,
    ]);

    const storedMfa = settingsRows[0]?.mfa_settings;
    const storedMetrics = settingsRows[0]?.security_metrics;
    const mfa = typeof storedMfa === "string" ? JSON.parse(storedMfa || "{}") : storedMfa || {};
    const metrics = typeof storedMetrics === "string" ? JSON.parse(storedMetrics || "{}") : storedMetrics || {};

    const totalUsers = Number(userRows[0]?.total_users ?? 0);

    return NextResponse.json({
      success: true,
      auditLogs: (Array.isArray(logs) ? logs : []).map(mapLog),
      mfaSettings: {
        enforcement: mfa.enforcement || "optional",
        methods: Array.isArray(mfa.methods) && mfa.methods.length ? mfa.methods : ["totp", "email"],
        enabledUsers: mfa.enabledUsers ?? 0,
        totalUsers,
      },
      securityMetrics: {
        totalLogins: metricRows[0]?.total_logins ?? 0,
        failedLogins: metricRows[0]?.failed_logins ?? 0,
        suspiciousActivity: metricRows[0]?.failed_logins ?? 0,
        activeSessions: 0,
        blockedAttempts: metricRows[0]?.blocked_attempts ?? 0,
        passwordStrength: metrics.passwordStrength ?? 0,
        lastSecurityScan: metrics.lastSecurityScan ?? null,
        vulnerabilities: metrics.vulnerabilities ?? 0,
      },
      securityPolicies: (Array.isArray(policies) ? policies : []).map(mapPolicy),
    });
  } catch (error) {
    console.error("Security GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/security
 * Create a security policy.
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");

    const parsed = await parseJsonRequest(request, SecurityPolicySchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    await ensureSecurityData(context.tenantSlug);

    const id = `sec-${randomUUID()}`;
    const rules = { ...(parsed.data.rules || {}), severity: parsed.data.severity };
    const rows = await SQL`
      insert into admin_security_policies (id, tenant_slug, name, description, rules, is_active, created_by, updated_by)
      values (${id}, ${context.tenantSlug}, ${parsed.data.name}, ${parsed.data.description || null},
              ${JSON.stringify(rules)}, ${parsed.data.enabled}, ${context.userId}, ${context.userId})
      returning *
    `;

    await SQL`
      insert into admin_audit_logs (id, tenant_slug, user_id, action, resource, resource_id, changes, ip_address, created_at)
      values (${randomUUID()}, ${context.tenantSlug}, ${context.userId}, 'create', 'security_policy',
              ${id}, ${JSON.stringify({ status: "success", details: parsed.data.name })},
              ${request.headers.get("x-forwarded-for") || null}, now())
    `;

    return NextResponse.json(
      { success: true, data: mapPolicy(rows[0]), message: "Security policy created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Security POST error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * PATCH /api/tenant/security?tenantSlug=
 * Updates MFA settings ({ mfaUpdates: { enforcement, methods } }) or, when an
 * `id` param is supplied, toggles a security policy.
 */
export async function PATCH(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    await ensureSecurityData(context.tenantSlug);

    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      const body = await request.json().catch(() => ({}));
      const enabled = body?.enabled === undefined ? undefined : !!body.enabled;
      if (enabled === undefined) {
        return errorResponse("'enabled' is required", 400);
      }
      const rows = await SQL`
        update admin_security_policies
        set is_active = ${enabled}, updated_at = now(), updated_by = ${context.userId}
        where id = ${id} and tenant_slug = ${context.tenantSlug}
        returning *
      `;
      if (!rows.length) return errorResponse("Security policy not found", 404);

      await SQL`
        insert into admin_audit_logs (id, tenant_slug, user_id, action, resource, resource_id, changes, ip_address, created_at)
        values (${randomUUID()}, ${context.tenantSlug}, ${context.userId}, 'update', 'security_policy',
                ${id}, ${JSON.stringify({ status: "success", details: `${enabled ? "Enabled" : "Disabled"} policy` })},
                ${request.headers.get("x-forwarded-for") || null}, now())
      `;

      return NextResponse.json({
        success: true,
        data: mapPolicy(rows[0]),
        message: "Security policy updated successfully",
      });
    }

    const parsed = await parseJsonRequest(request, MfaUpdateSchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    const updates = parsed.data.mfaUpdates;
    await SQL`
      insert into tenant_security_settings (tenant_slug, mfa_settings, updated_at)
      values (${context.tenantSlug}, ${JSON.stringify(updates)}, now())
      on conflict (tenant_slug) do update set
        mfa_settings = tenant_security_settings.mfa_settings || ${JSON.stringify(updates)}::jsonb,
        updated_at = now()
    `;

    await SQL`
      insert into admin_audit_logs (id, tenant_slug, user_id, action, resource, resource_id, changes, ip_address, created_at)
      values (${randomUUID()}, ${context.tenantSlug}, ${context.userId},
              ${updates.enforcement === "required" ? "mfa_enable" : "mfa_disable"},
              'mfa_settings', ${context.tenantSlug},
              ${JSON.stringify({ status: "success", details: `MFA enforcement set to ${updates.enforcement ?? "updated"}` })},
              ${request.headers.get("x-forwarded-for") || null}, now())
    `;

    return NextResponse.json({ success: true, message: "Security settings updated successfully" });
  } catch (error) {
    console.error("Security PATCH error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * DELETE /api/tenant/security?id=<id>
 * Delete a security policy.
 */
export async function DELETE(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "delete");
    const id = new URL(request.url).searchParams.get("id");

    if (!id) {
      return errorResponse("Security policy ID is required", 400);
    }

    await ensureSecurityData(context.tenantSlug);

    const rows = await SQL`
      delete from admin_security_policies
      where id = ${id} and tenant_slug = ${context.tenantSlug}
      returning id
    `;
    if (!rows.length) return errorResponse("Security policy not found", 404);

    await SQL`
      insert into admin_audit_logs (id, tenant_slug, user_id, action, resource, resource_id, changes, ip_address, created_at)
      values (${randomUUID()}, ${context.tenantSlug}, ${context.userId}, 'delete', 'security_policy',
              ${id}, ${JSON.stringify({ status: "success" })},
              ${request.headers.get("x-forwarded-for") || null}, now())
    `;

    return NextResponse.json({ success: true, message: "Security policy deleted successfully" });
  } catch (error) {
    console.error("Security DELETE error:", error);
    return handleTenantAdminError(error);
  }
}
