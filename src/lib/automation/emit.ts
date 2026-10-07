import { sql as SQL } from "@/lib/sql-client";
import { executeRulesForEvent } from "./engine";

/**
 * Fire-and-forget automation event emitter. Business flows call this after
 * their own commit so a failing rule engine can never break the primary
 * transaction. Event names must match automation_rules.event_type values —
 * see GET /api/automation/triggers for the advertised catalog.
 */
export function emitAutomationEvent(
  tenantSlug: string,
  type: string,
  payload: Record<string, any> = {},
  actor?: string
): void {
  // Do not await: rule evaluation + queue writes must not add latency or
  // failure modes to the calling workflow.
  Promise.resolve()
    .then(() => executeRulesForEvent(tenantSlug, { type, payload, actor }))
    .catch((err) => {
      console.error(`[automation] event ${type} failed for ${tenantSlug}:`, err);
    });
}

/**
 * Deduplicated emitter for time-based triggers. Cron jobs run repeatedly, so
 * the same source record (bill, project, employee-day) must not re-fire rules
 * on every invocation. The first call for a (tenant, type, key) triple emits;
 * subsequent calls within `cooldownHours` are skipped. Pass cooldownHours=0
 * to emit only once ever.
 */
export async function emitAutomationEventOnce(
  tenantSlug: string,
  type: string,
  dedupKey: string,
  payload: Record<string, any> = {},
  cooldownHours = 168,
  actor?: string
): Promise<boolean> {
  await SQL`
    create table if not exists automation_event_dedup (
      tenant_slug text not null,
      event_type text not null,
      dedup_key text not null,
      emitted_at timestamptz not null default now(),
      primary key (tenant_slug, event_type, dedup_key)
    )
  `;
  let emitted: boolean;
  if (cooldownHours <= 0) {
    const inserted = (await SQL`
      insert into automation_event_dedup (tenant_slug, event_type, dedup_key)
      values (${tenantSlug}, ${type}, ${dedupKey})
      on conflict (tenant_slug, event_type, dedup_key) do nothing
      returning dedup_key
    `) as any[];
    emitted = inserted.length > 0;
  } else {
    const cutoff = new Date(Date.now() - cooldownHours * 3600_000).toISOString();
    const result = (await SQL`
      insert into automation_event_dedup (tenant_slug, event_type, dedup_key)
      values (${tenantSlug}, ${type}, ${dedupKey})
      on conflict (tenant_slug, event_type, dedup_key) do update
        set emitted_at = case
          when automation_event_dedup.emitted_at < ${cutoff}::timestamptz then now()
          else automation_event_dedup.emitted_at
        end
      returning emitted_at = now() as emitted
    `) as any[];
    emitted = Boolean(result[0]?.emitted);
  }
  if (emitted) {
    emitAutomationEvent(tenantSlug, type, payload, actor);
  }
  return emitted;
}
