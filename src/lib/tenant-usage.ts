/**
 * Tenant usage metering & summary.
 *
 * `recordUsageMetric` increments daily counters in `tenant_usage_daily`
 * (fire-and-forget — callers must not await on the request path).
 * `getTenantUsageSummary` aggregates seats, API-call counters, per-module
 * record counts, and AI-agent usage for the billing/usage dashboard.
 */

import { sql as SQL, db } from "./sql-client";
import { ensureOnce } from "./ensure-once";
import { getUsageStats, checkQuota, type UsageStats, type QuotaStatus } from "./ai/usage-log";

export interface TenantUsageSummary {
  tenantSlug: string;
  seats: { used: number; limit: number | null };
  apiCalls: {
    last24h: number;
    last7d: number;
    last30d: number;
    byModule: Record<string, number>;
  };
  records: Record<string, number>;
  ai: { stats: UsageStats; quota: QuotaStatus };
  generatedAt: string;
}

let countersEnsured = false;

export function ensureUsageCountersTable() {
  return ensureOnce("tenant-usage:ensureUsageCountersTable", async () => {
    if (countersEnsured) return;
    try {
      await SQL`
        create table if not exists tenant_usage_daily (
          tenant_slug text not null,
          usage_date date not null default current_date,
          metric text not null,
          value bigint not null default 0,
          primary key (tenant_slug, usage_date, metric)
        )
      `;
      await SQL`create index if not exists tenant_usage_daily_date_idx on tenant_usage_daily(usage_date)`;
      countersEnsured = true;
    } catch (err) {
      console.error("[tenant-usage] Failed to ensure tenant_usage_daily:", err);
    }
  });
}

/**
 * Increment a daily usage counter. Fire-and-forget safe: never throws.
 */
export async function recordUsageMetric(
  tenantSlug: string,
  metric: string,
  amount = 1
): Promise<void> {
  try {
    await ensureUsageCountersTable();
    await SQL`
      insert into tenant_usage_daily (tenant_slug, usage_date, metric, value)
      values (${tenantSlug}, current_date, ${metric}, ${amount})
      on conflict (tenant_slug, usage_date, metric)
      do update set value = tenant_usage_daily.value + excluded.value
    `;
  } catch {
    // Metering must never break the request it measures.
  }
}

/**
 * Meter an authenticated module-gated API call. Fire-and-forget.
 */
export function meterApiCall(tenantSlug: string, module: string): void {
  void recordUsageMetric(tenantSlug, "api_call").catch(() => {});
  void recordUsageMetric(tenantSlug, `api_call:${module}`).catch(() => {});
}

// Per-module record-count probes. Table names are compile-time constants —
// never interpolate request input here.
const RECORD_PROBES: Array<{ key: string; table: string }> = [
  { key: "employees", table: "admin_employees" },
  { key: "crm_contacts", table: "crm_contacts" },
  { key: "crm_leads", table: "crm_leads" },
  { key: "crm_deals", table: "crm_deals" },
  { key: "crm_customers", table: "crm_customers" },
  { key: "invoices", table: "finance_invoices" },
  { key: "bills", table: "bills" },
  { key: "support_tickets", table: "support_tickets" },
  { key: "sales_orders", table: "sales_orders" },
  { key: "inventory_products", table: "inventory_products" },
  { key: "purchase_orders", table: "purchase_orders" },
  { key: "projects", table: "workstreams" },
  { key: "work_orders", table: "work_orders" },
];

async function countTenantRows(table: string, tenantSlug: string): Promise<number> {
  const res = await db.query(
    `select count(*)::int as cnt from ${table} where tenant_slug = $1`,
    [tenantSlug]
  );
  return res.rows?.[0]?.cnt ?? 0;
}

export async function getTenantUsageSummary(tenantSlug: string): Promise<TenantUsageSummary> {
  await ensureUsageCountersTable();

  // Seats: tenant admins + employees vs subscription seat limit
  let seatsUsed = 0;
  let seatsLimit: number | null = null;
  try {
    const adminRows = (await SQL`select count(*)::int as cnt from tenant_admins where tenant_slug = ${tenantSlug}`) as any[];
    const empRows = (await SQL`select count(*)::int as cnt from admin_employees where tenant_slug = ${tenantSlug}`) as any[];
    seatsUsed = (adminRows?.[0]?.cnt ?? 0) + (empRows?.[0]?.cnt ?? 0);
  } catch {}
  try {
    const subRows = (await SQL`
      select seats from finance_subscriptions
      where tenant_slug = ${tenantSlug} and status in ('active', 'trial')
      order by updated_at desc limit 1
    `) as any[];
    seatsLimit = subRows?.[0]?.seats ?? null;
  } catch {}

  // API-call counters
  let last24h = 0, last7d = 0, last30d = 0;
  const byModule: Record<string, number> = {};
  try {
    const totalRows = (await SQL`
      select
        coalesce(sum(value) filter (where usage_date >= current_date - 1), 0)::bigint as d1,
        coalesce(sum(value) filter (where usage_date >= current_date - 7), 0)::bigint as d7,
        coalesce(sum(value) filter (where usage_date >= current_date - 30), 0)::bigint as d30
      from tenant_usage_daily
      where tenant_slug = ${tenantSlug} and metric = 'api_call'
    `) as any[];
    last24h = Number(totalRows?.[0]?.d1 ?? 0);
    last7d = Number(totalRows?.[0]?.d7 ?? 0);
    last30d = Number(totalRows?.[0]?.d30 ?? 0);

    const moduleRows = (await SQL`
      select metric, coalesce(sum(value), 0)::bigint as cnt
      from tenant_usage_daily
      where tenant_slug = ${tenantSlug}
        and metric like 'api_call:%'
        and usage_date >= current_date - 30
      group by metric
      order by cnt desc
    `) as any[];
    for (const row of moduleRows ?? []) {
      byModule[String(row.metric).slice("api_call:".length)] = Number(row.cnt);
    }
  } catch {}

  // Per-module record counts — a missing table must not fail the summary
  const records: Record<string, number> = {};
  await Promise.all(
    RECORD_PROBES.map(async ({ key, table }) => {
      try {
        records[key] = await countTenantRows(table, tenantSlug);
      } catch {
        records[key] = 0;
      }
    })
  );

  const [stats, quota] = await Promise.all([
    getUsageStats(tenantSlug).catch(() => null),
    checkQuota(tenantSlug).catch(() => null),
  ]);

  return {
    tenantSlug,
    seats: { used: seatsUsed, limit: seatsLimit },
    apiCalls: { last24h, last7d, last30d, byModule },
    records,
    ai: {
      stats: stats ?? {
        tenantSlug, totalCalls: 0, aiCalls: 0, deterministicCalls: 0,
        failedCalls: 0, callsByCapability: {}, callsBySource: {},
        avgDurationMs: 0, last24h: 0, last7d: 0, last30d: 0,
      },
      quota: quota ?? {
        tenantSlug, dailyLimit: 0, dailyUsed: 0, dailyRemaining: 0,
        monthlyLimit: 0, monthlyUsed: 0, monthlyRemaining: 0, exceeded: false,
      },
    },
    generatedAt: new Date().toISOString(),
  };
}
