/**
 * AI Agent Usage Logging & Quota Tracking
 *
 * Logs every agent call to the `ai_usage_log` table for per-tenant
 * usage analytics and quota enforcement.
 */

import { getSql } from "@/lib/db";

// ─── Types ───

export interface UsageLogEntry {
  id: string;
  tenantSlug: string;
  capability: string;
  source: string;
  success: boolean;
  durationMs: number;
  model: string | null;
  conversationId: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface UsageStats {
  tenantSlug: string;
  totalCalls: number;
  aiCalls: number;
  deterministicCalls: number;
  failedCalls: number;
  callsByCapability: Record<string, number>;
  callsBySource: Record<string, number>;
  avgDurationMs: number;
  last24h: number;
  last7d: number;
  last30d: number;
}

export interface QuotaStatus {
  tenantSlug: string;
  dailyLimit: number;
  dailyUsed: number;
  dailyRemaining: number;
  monthlyLimit: number;
  monthlyUsed: number;
  monthlyRemaining: number;
  exceeded: boolean;
}

// ─── Defaults ───

const DEFAULT_DAILY_LIMIT = 100;
const DEFAULT_MONTHLY_LIMIT = 2000;

// ─── Table Initialization ───

let tableEnsured = false;

export async function ensureUsageTable(): Promise<void> {
  if (tableEnsured) return;
  const sql = getSql();
  try {
    await sql`
      create table if not exists ai_usage_log (
        id text primary key,
        tenant_slug text not null,
        capability text not null,
        source text not null,
        success boolean not null default true,
        duration_ms integer not null default 0,
        model text,
        conversation_id text,
        error_message text,
        created_at timestamptz not null default now()
      )
    `;
    await sql`create index if not exists ai_usage_log_tenant_idx on ai_usage_log(tenant_slug)`;
    await sql`create index if not exists ai_usage_log_created_idx on ai_usage_log(created_at)`;
    await sql`create index if not exists ai_usage_log_capability_idx on ai_usage_log(capability)`;
    tableEnsured = true;
  } catch (err) {
    console.error("[ai/usage-log] Failed to ensure ai_usage_log table:", err);
  }
}

// ─── Logging ───

export async function logAgentCall(params: {
  tenantSlug: string;
  capability: string;
  source: string;
  success: boolean;
  durationMs: number;
  model: string | null;
  conversationId?: string;
  errorMessage?: string;
}): Promise<void> {
  try {
    await ensureUsageTable();
    const sql = getSql();
    const id = `aul_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await sql`
      insert into ai_usage_log (id, tenant_slug, capability, source, success, duration_ms, model, conversation_id, error_message)
      values (${id}, ${params.tenantSlug}, ${params.capability}, ${params.source}, ${params.success}, ${params.durationMs}, ${params.model || null}, ${params.conversationId || null}, ${params.errorMessage || null})
    `;
  } catch (err) {
    console.error("[ai/usage-log] Failed to log agent call:", err);
  }
}

// ─── Quota Checking ───

export async function checkQuota(tenantSlug: string): Promise<QuotaStatus> {
  await ensureUsageTable();
  const sql = getSql();

  const dailyLimit = DEFAULT_DAILY_LIMIT;
  const monthlyLimit = DEFAULT_MONTHLY_LIMIT;

  try {
    const dailyRows = await sql`
      select count(*)::int as cnt from ai_usage_log
      where tenant_slug = ${tenantSlug}
        and created_at >= now() - interval '24 hours'
    `;
    const monthlyRows = await sql`
      select count(*)::int as cnt from ai_usage_log
      where tenant_slug = ${tenantSlug}
        and created_at >= now() - interval '30 days'
    `;

    const dailyUsed = (dailyRows as any[])?.[0]?.cnt ?? 0;
    const monthlyUsed = (monthlyRows as any[])?.[0]?.cnt ?? 0;

    return {
      tenantSlug,
      dailyLimit,
      dailyUsed,
      dailyRemaining: Math.max(0, dailyLimit - dailyUsed),
      monthlyLimit,
      monthlyUsed,
      monthlyRemaining: Math.max(0, monthlyLimit - monthlyUsed),
      exceeded: dailyUsed >= dailyLimit || monthlyUsed >= monthlyLimit,
    };
  } catch {
    return {
      tenantSlug,
      dailyLimit,
      dailyUsed: 0,
      dailyRemaining: dailyLimit,
      monthlyLimit,
      monthlyUsed: 0,
      monthlyRemaining: monthlyLimit,
      exceeded: false,
    };
  }
}

// ─── Stats ───

export async function getUsageStats(tenantSlug: string): Promise<UsageStats> {
  await ensureUsageTable();
  const sql = getSql();

  try {
    const totalRows = await sql`
      select
        count(*)::int as total_calls,
        count(*) filter (where source = 'ai')::int as ai_calls,
        count(*) filter (where source != 'ai')::int as det_calls,
        count(*) filter (where success = false)::int as failed_calls,
        coalesce(avg(duration_ms), 0)::float8 as avg_duration,
        count(*) filter (where created_at >= now() - interval '24 hours')::int as last_24h,
        count(*) filter (where created_at >= now() - interval '7 days')::int as last_7d,
        count(*) filter (where created_at >= now() - interval '30 days')::int as last_30d
      from ai_usage_log
      where tenant_slug = ${tenantSlug}
    `;

    const capRows = await sql`
      select capability, count(*)::int as cnt
      from ai_usage_log
      where tenant_slug = ${tenantSlug}
      group by capability
    `;

    const srcRows = await sql`
      select source, count(*)::int as cnt
      from ai_usage_log
      where tenant_slug = ${tenantSlug}
      group by source
    `;

    const totals = (totalRows as any[])?.[0] ?? {};
    const callsByCapability: Record<string, number> = {};
    for (const row of (capRows as any[]) ?? []) {
      callsByCapability[row.capability] = row.cnt;
    }
    const callsBySource: Record<string, number> = {};
    for (const row of (srcRows as any[]) ?? []) {
      callsBySource[row.source] = row.cnt;
    }

    return {
      tenantSlug,
      totalCalls: totals.total_calls ?? 0,
      aiCalls: totals.ai_calls ?? 0,
      deterministicCalls: totals.det_calls ?? 0,
      failedCalls: totals.failed_calls ?? 0,
      callsByCapability,
      callsBySource,
      avgDurationMs: Math.round(totals.avg_duration ?? 0),
      last24h: totals.last_24h ?? 0,
      last7d: totals.last_7d ?? 0,
      last30d: totals.last_30d ?? 0,
    };
  } catch (err) {
    console.error("[ai/usage-log] Failed to get usage stats:", err);
    return {
      tenantSlug,
      totalCalls: 0,
      aiCalls: 0,
      deterministicCalls: 0,
      failedCalls: 0,
      callsByCapability: {},
      callsBySource: {},
      avgDurationMs: 0,
      last24h: 0,
      last7d: 0,
      last30d: 0,
    };
  }
}

// ─── Recent Logs ───

export async function getRecentLogs(tenantSlug: string, limit = 50): Promise<UsageLogEntry[]> {
  await ensureUsageTable();
  const sql = getSql();

  try {
    const rows = await sql`
      select id, tenant_slug, capability, source, success, duration_ms, model, conversation_id, error_message, created_at
      from ai_usage_log
      where tenant_slug = ${tenantSlug}
      order by created_at desc
      limit ${limit}
    `;
    return ((rows as any[]) ?? []).map((r) => ({
      id: r.id,
      tenantSlug: r.tenant_slug,
      capability: r.capability,
      source: r.source,
      success: r.success,
      durationMs: r.duration_ms,
      model: r.model,
      conversationId: r.conversation_id,
      errorMessage: r.error_message,
      createdAt: r.created_at?.toISOString?.() ?? String(r.created_at),
    }));
  } catch {
    return [];
  }
}
