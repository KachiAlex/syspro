/**
 * Process run audit logs — mirrors ERPNext's process_* doctypes
 * (process_deferred_accounting, process_subscription, process_statement_of_
 * accounts, process_payment_reconciliation). Every mass-process action
 * records a row: what ran, params, outcome, who ran it, how long it took.
 */

import { sql as SQL } from "../sql-client";
import { ensureOnce } from "@/lib/ensure-once";

export function ensureProcessLogTables() {
  return ensureOnce("finance/process-log:tables", run);
}

async function run() {
  const sql = SQL;
  await sql`create table if not exists process_run_logs (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    process text not null,               -- e.g. 'deferred-recognition', 'subscription-invoices'
    params jsonb,
    result jsonb,
    item_count integer,
    status text not null check (status in ('success','partial','failed')),
    error text,
    duration_ms integer,
    run_by text,
    created_at timestamptz not null default now()
  )`;
  await sql`create index if not exists process_run_logs_idx
    on process_run_logs (tenant_slug, process, created_at desc)`;
}

/**
 * Wrap a mass-process action with audit logging. The wrapped function's
 * return value is recorded as `result` (truncated to 4KB) and item_count is
 * inferred from common shapes (array length, .posted/.generated length).
 * Never throws — logging failure must not break the process itself.
 */
export async function withProcessLog<T>(
  process: string,
  input: { tenantSlug: string; params?: Record<string, unknown>; userId?: string },
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    void recordRun(process, {
      ...input, status: "success",
      itemCount: inferCount(result),
      result: truncate(result),
      durationMs: Date.now() - start,
    });
    return result;
  } catch (e: any) {
    void recordRun(process, {
      ...input, status: "failed", error: e?.message ?? String(e),
      durationMs: Date.now() - start,
    });
    throw e;
  }
}

function inferCount(result: unknown): number | null {
  if (Array.isArray(result)) return result.length;
  if (result && typeof result === "object") {
    const r = result as any;
    for (const key of ["posted", "generated", "processed", "invoices", "items"]) {
      if (Array.isArray(r[key])) return r[key].length;
    }
    if (typeof r.count === "number") return r.count;
  }
  return null;
}

function truncate(result: unknown): string | null {
  if (result === undefined || result === null) return null;
  const s = JSON.stringify(result);
  return s.length > 4000 ? s.slice(0, 4000) + "…" : s;
}

export async function recordRun(
  process: string,
  input: {
    tenantSlug: string; params?: Record<string, unknown>; result?: unknown;
    itemCount?: number | null; status: "success" | "partial" | "failed";
    error?: string; durationMs?: number; userId?: string;
  },
) {
  try {
    await ensureProcessLogTables();
    await SQL`
      insert into process_run_logs
        (tenant_slug, process, params, result, item_count, status, error, duration_ms, run_by)
      values (${input.tenantSlug}, ${process}, ${input.params ? JSON.stringify(input.params) : null}::jsonb,
              ${typeof input.result === "string" ? input.result : input.result ? JSON.stringify(input.result) : null},
              ${input.itemCount ?? null}, ${input.status}, ${input.error ?? null},
              ${input.durationMs ?? null}, ${input.userId ?? null})
    `;
  } catch { /* audit must never break the process */ }
}

export async function listProcessRuns(input: {
  tenantSlug: string; process?: string; limit?: number;
}) {
  await ensureProcessLogTables();
  return (await SQL`
    select id, process, params, item_count, status, error, duration_ms, run_by, created_at::text
    from process_run_logs
    where tenant_slug = ${input.tenantSlug}
      ${input.process ? SQL`and process = ${input.process}` : SQL``}
    order by created_at desc limit ${input.limit ?? 100}
  `) as any[];
}
